import { Router } from "express";
import {
  FieldValue,
  Timestamp,
  type Firestore
} from "firebase-admin/firestore";

import {
  type AuthenticatedRequest,
  requireAdmin,
  requireAuth
} from "../auth.ts";
import { isAdminEmail } from "../adminConfig.ts";
import { canViewAdminPanel, resolveAdminAccess } from "../adminAccess.ts";
import {
  approvalFieldsForCreate,
  approvalFieldsForStatus,
  resolveInitialApprovalStatus
} from "../approvalPolicy.ts";
import {
  canStartDrivingSession,
  drivingStartBlockReason,
  isReservationEffective,
  isReservationInProgress,
  SESSION_STALE_MS,
  toDate,
  type DrivingLogLike,
  type ReservationLike
} from "../drivingLogic.ts";
import { getAdminDb } from "../firebaseAdmin.ts";
import {
  normalizeOfficersInput,
  officerEmailsFromOfficers,
  parseDepartmentOfficers
} from "../../shared/departmentOfficers.ts";
import { collectStaffDepartmentIds } from "../../shared/departmentScope.ts";
import { getFixedAlcoholCheckFields } from "../../shared/alcoholCheckDefaults.ts";
import { trimOperationalData } from "../trimOperationalData.ts";
import {
  normalizeEmployeeSiteStaffPayload,
  requireEmployeeSiteSync
} from "../employeeSiteAuth.ts";
import { bootstrapStaffProfile } from "../staffBootstrap.ts";
import {
  listDepartmentsForEmployeeSite,
  syncStaffFromEmployeeSite
} from "../staffSync.ts";
import {
  canApproveStaffRecord
} from "../officerAuth.ts";
import { requireJobSecret } from "../jobAuth.ts";
import { runMissingReportReminderJob } from "../missingReportReminder.ts";
import {
  notifyOfficersOnEtcSubmitted,
  notifyOfficersOnReportSubmitted
} from "../reportSubmittedNotification.ts";
import { serializeDoc, serializeDocs } from "../serialize.ts";

const router = Router();

function firestoreErrorPayload(error: unknown, fallback: string): {
  status: number;
  body: { error: string; details?: string };
} {
  const message = error instanceof Error ? error.message : String(error);
  const missingCredentials = /Could not load the default credentials|credential/i.test(
    message
  );
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev && missingCredentials) {
    return {
      status: 503,
      body: {
        error:
          "サーバー側の Firebase 認証情報が未設定です。.env に VITE_API_BASE_URL（本番 API）または LOCAL_FIREBASE_ADC=true を設定してください。",
        details: message
      }
    };
  }

  return {
    status: 500,
    body: {
      error: fallback,
      ...(isDev ? { details: message } : {})
    }
  };
}

const ADMIN_COLLECTIONS = new Set([
  "drivingLogs",
  "reservations",
  "refuelingRecords",
  "etcRecords",
  "gpsLogs"
]);

const DELETABLE_ADMIN_COLLECTIONS = new Set([
  "drivingLogs",
  "reservations",
  "refuelingRecords",
  "etcRecords",
  "gpsLogs"
]);

const DELETE_COLLECTION_BATCH_SIZE = 400;

async function deleteAllInCollection(
  db: Firestore,
  name: string
): Promise<number> {
  let deleted = 0;
  while (true) {
    const snap = await db.collection(name).limit(DELETE_COLLECTION_BATCH_SIZE).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
    deleted += snap.size;
  }
  return deleted;
}

function userEmail(req: AuthenticatedRequest): string {
  return req.user.email ?? "";
}

function userUid(req: AuthenticatedRequest): string {
  return req.user.uid;
}

async function completeExpiredReservations(
  db: Firestore,
  options?: { userEmail?: string; admin?: boolean }
): Promise<number> {
  const snap = await db
    .collection("reservations")
    .where("status", "==", "active")
    .get();

  const now = new Date();
  let completed = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data() as ReservationLike & { email?: string };
    const end = toDate(data.endTime);
    if (!end || end > now) continue;

    if (
      options?.userEmail &&
      !options.admin &&
      data.email !== options.userEmail
    ) {
      continue;
    }

    await docSnap.ref.update({ status: "completed" });
    completed++;
  }

  return completed;
}

async function fetchUserReservations(
  db: Firestore,
  email: string
): Promise<Array<ReservationLike & { id: string }>> {
  await completeExpiredReservations(db, { userEmail: email });

  const snap = await db
    .collection("reservations")
    .where("status", "==", "active")
    .get();

  return snap.docs
    .map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as ReservationLike)
    }))
    .filter((r) => r.email === email && isReservationEffective(r))
    .sort((a, b) => {
      const aStart = toDate(a.startTime)?.getTime() ?? 0;
      const bStart = toDate(b.startTime)?.getTime() ?? 0;
      return aStart - bStart;
    });
}

async function fetchActiveReservations(
  db: Firestore
): Promise<Array<ReservationLike & { id: string; email?: string }>> {
  await completeExpiredReservations(db, { admin: true });

  const snap = await db
    .collection("reservations")
    .where("status", "==", "active")
    .get();

  return snap.docs
    .map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as ReservationLike & { email?: string })
    }))
    .filter((r) => isReservationEffective(r))
    .sort((a, b) => {
      const aStart = toDate(a.startTime)?.getTime() ?? 0;
      const bStart = toDate(b.startTime)?.getTime() ?? 0;
      return aStart - bStart;
    });
}

function findActiveReservationForDriving(
  reservations: Array<ReservationLike & { email?: string }>,
  email: string,
  vehicleNumber: string,
  at: Date
): (ReservationLike & { email?: string }) | undefined {
  const normalizedVehicle = vehicleNumber.trim();

  if (normalizedVehicle) {
    const vehicleInProgress = reservations.find(
      (r) =>
        String(r.vehicleNumber ?? "").trim() === normalizedVehicle &&
        isReservationInProgress(r, at)
    );
    if (vehicleInProgress) return vehicleInProgress;
  }

  const userInProgress = reservations.find(
    (r) =>
      r.email === email &&
      isReservationInProgress(r, at)
  );
  if (userInProgress) return userInProgress;

  if (normalizedVehicle) {
    const vehicleEffective = reservations.find(
      (r) =>
        String(r.vehicleNumber ?? "").trim() === normalizedVehicle &&
        isReservationEffective(r, at)
    );
    if (vehicleEffective) return vehicleEffective;
  }

  return reservations.find(
    (r) => r.email === email && isReservationEffective(r, at)
  );
}

/** 分単位に切り捨て（秒未満の差で境界予約が誤検知されないようにする） */
function floorToMinute(date: Date): Date {
  const ms = date.getTime();
  return new Date(ms - (ms % 60_000));
}

/**
 * 時間帯の重複判定（半開区間 [start, end)）。
 * 終了ちょうどからの次予約（例: 〜12:00 の次に 12:00〜）は重複しない。
 */
function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  const a0 = floorToMinute(aStart).getTime();
  const a1 = floorToMinute(aEnd).getTime();
  const b0 = floorToMinute(bStart).getTime();
  const b1 = floorToMinute(bEnd).getTime();
  return a0 < b1 && a1 > b0;
}

// --- Auth bootstrap ---

router.post("/auth/bootstrap", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const email = userEmail(authReq);
    const db = getAdminDb();
    const body = req.body as { name?: string; vehicleNumber?: string };
    const name =
      typeof body.name === "string" ? body.name.trim() : undefined;
    const vehicleNumber =
      typeof body.vehicleNumber === "string"
        ? body.vehicleNumber.trim()
        : "";

    try {
      await bootstrapStaffProfile(db, email, name);
    } catch (error) {
      console.error("auth/bootstrap staff profile error:", error);
    }

    await completeExpiredReservations(db, { userEmail: email });
    const reservations = await fetchUserReservations(db, email);
    const activeReservations = await fetchActiveReservations(db);
    const vehicleReservation = vehicleNumber
      ? findActiveReservationForDriving(
          activeReservations,
          email,
          vehicleNumber,
          new Date()
        )
      : undefined;

    let drivingStatus: "idle" | "driving" | "needs_report" = "idle";
    try {
      const logsSnap = await db
        .collection("drivingLogs")
        .where("email", "==", email)
        .orderBy("startTime", "desc")
        .limit(20)
        .get();

      const unreported = logsSnap.docs.find(
        (docSnap) => (docSnap.data() as { status?: string }).status === "driving"
      );

      if (unreported) {
        const data = unreported.data() as { endTime?: unknown };
        drivingStatus = data.endTime ? "needs_report" : "driving";
      }
    } catch (error) {
      console.error("auth/bootstrap driving logs error:", error);
    }

    res.json({
      hasReservation: reservations.length > 0 || !!vehicleReservation,
      drivingStatus
    });
  } catch (error) {
    console.error("auth/bootstrap error:", error);
    res.status(500).json({ error: "初期化に失敗しました" });
  }
});

router.get("/auth/access-role", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const email = userEmail(authReq);
    const access = await resolveAdminAccess(getAdminDb(), email);
    res.json(access);
  } catch (error) {
    console.error("auth/access-role error:", error);
    res.status(500).json({ error: "権限の確認に失敗しました" });
  }
});

router.get("/staff/display-names", requireAuth, async (_req, res) => {
  try {
    const db = getAdminDb();
    const [staffSnap, deptSnap] = await Promise.all([
      db.collection("staffProfiles").get(),
      db.collection("departments").get()
    ]);
    const sealByDeptId = new Map<string, string>();
    for (const docSnap of deptSnap.docs) {
      const seal = String(
        (docSnap.data() as { sealImageUrl?: string }).sealImageUrl ?? ""
      ).trim();
      if (seal.startsWith("http")) {
        sealByDeptId.set(docSnap.id, seal);
      }
    }

    const names = staffSnap.docs
      .map((docSnap) => {
        const data = docSnap.data() as {
          email?: string;
          name?: string;
          departmentId?: string;
          departmentIds?: string[];
        };
        const email = String(data.email ?? docSnap.id).trim().toLowerCase();
        const name = data.name?.trim() ?? "";
        const departmentIds = collectStaffDepartmentIds(data);
        let sealImageUrl = "";
        for (const deptId of departmentIds) {
          const seal = sealByDeptId.get(deptId);
          if (seal) {
            sealImageUrl = seal;
            break;
          }
        }
        return { email, name, sealImageUrl };
      })
      .filter((entry) => entry.email);

    res.json({ names });
  } catch (error) {
    console.error("staff/display-names error:", error);
    res.status(500).json({ error: "スタッフ氏名の取得に失敗しました" });
  }
});

// --- Sessions ---

router.post("/sessions/claim", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { sessionId, force } = req.body as {
      sessionId?: string;
      force?: boolean;
    };
    if (!sessionId) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    const uid = userUid(authReq);
    const email = userEmail(authReq);
    const db = getAdminDb();
    const ref = db.collection("userSessions").doc(uid);
    const snap = await ref.get();
    const remote = snap.exists ? snap.data() : null;

    if (
      !force &&
      remote?.sessionId &&
      remote.sessionId !== sessionId
    ) {
      const updatedAt = toDate(remote.updatedAt as string);
      if (updatedAt && Date.now() - updatedAt.getTime() <= SESSION_STALE_MS) {
        res.status(409).json({
          error:
            "すでに別の端末でログイン中です。先にそちらでログアウトしてから、再度お試しください。",
          code: "session_blocked"
        });
        return;
      }
    }

    await ref.set(
      { email, sessionId, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    res.json({ ok: true });
  } catch (error) {
    console.error("sessions/claim error:", error);
    res.status(500).json({ error: "セッションの確保に失敗しました" });
  }
});

router.get("/sessions/status", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const sessionId = String(req.query.sessionId ?? "");
    if (!sessionId) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    const db = getAdminDb();
    const snap = await db.collection("userSessions").doc(userUid(authReq)).get();
    if (!snap.exists) {
      res.json({ valid: true });
      return;
    }

    const data = snap.data() as { sessionId?: string };
    res.json({ valid: !data.sessionId || data.sessionId === sessionId });
  } catch (error) {
    console.error("sessions/status error:", error);
    res.status(500).json({ error: "セッション確認に失敗しました" });
  }
});

router.post("/sessions/heartbeat", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    const db = getAdminDb();
    const ref = db.collection("userSessions").doc(userUid(authReq));
    const snap = await ref.get();
    const remote = snap.data();
    if (remote?.sessionId !== sessionId) {
      res.json({ ok: false });
      return;
    }

    await ref.update({ updatedAt: FieldValue.serverTimestamp() });
    res.json({ ok: true });
  } catch (error) {
    console.error("sessions/heartbeat error:", error);
    res.status(500).json({ error: "ハートビートに失敗しました" });
  }
});

router.delete("/sessions", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const sessionId = String(req.query.sessionId ?? req.body?.sessionId ?? "");
    const db = getAdminDb();
    const ref = db.collection("userSessions").doc(userUid(authReq));
    const snap = await ref.get();
    const remote = snap.data();
    if (!remote?.sessionId || remote.sessionId === sessionId) {
      await ref.delete();
    }
    res.json({ ok: true });
  } catch (error) {
    console.error("sessions/delete error:", error);
    res.status(500).json({ error: "セッション削除に失敗しました" });
  }
});

// --- Vehicles ---

router.get("/vehicles", requireAuth, async (_req, res) => {
  try {
    const snap = await getAdminDb().collection("vehicles").get();
    res.json(serializeDocs(snap.docs));
  } catch (error) {
    console.error("vehicles/list error:", error);
    const { status, body } = firestoreErrorPayload(
      error,
      "車両一覧の取得に失敗しました"
    );
    res.status(status).json(body);
  }
});

router.post("/vehicles", requireAuth, requireAdmin, async (req, res) => {
  try {
    const ref = await getAdminDb().collection("vehicles").add({
      ...req.body,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    res.status(201).json({ id: ref.id });
  } catch (error) {
    console.error("vehicles/create error:", error);
    res.status(500).json({ error: "車両の作成に失敗しました" });
  }
});

router.patch("/vehicles/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await getAdminDb()
      .collection("vehicles")
      .doc(req.params.id)
      .update({
        ...req.body,
        updatedAt: FieldValue.serverTimestamp()
      });
    res.json({ ok: true });
  } catch (error) {
    console.error("vehicles/update error:", error);
    res.status(500).json({ error: "車両の更新に失敗しました" });
  }
});

router.delete("/vehicles/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await getAdminDb().collection("vehicles").doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (error) {
    console.error("vehicles/delete error:", error);
    res.status(500).json({ error: "車両の削除に失敗しました" });
  }
});

router.patch(
  "/vehicles/:id/claim-personal",
  requireAuth,
  async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      await getAdminDb()
        .collection("vehicles")
        .doc(req.params.id)
        .update({
          isPersonal: true,
          personalOwnerEmail: userEmail(authReq),
          updatedAt: FieldValue.serverTimestamp()
        });
      res.json({ ok: true });
    } catch (error) {
      console.error("vehicles/claim-personal error:", error);
      res.status(500).json({ error: "個人保有の申請に失敗しました" });
    }
  }
);

// --- Vehicle maintenance ---

router.get("/vehicle-maintenance", requireAuth, async (_req, res) => {
  try {
    const snap = await getAdminDb()
      .collection("vehicleMaintenance")
      .orderBy("performedAt", "desc")
      .get();
    res.json(serializeDocs(snap.docs));
  } catch (error) {
    console.error("vehicle-maintenance/list error:", error);
    res.status(500).json({ error: "整備記録の取得に失敗しました" });
  }
});

router.post(
  "/vehicle-maintenance",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { vehicleNumber, type, performedAt, mileageKm } = req.body;
      const ref = await getAdminDb().collection("vehicleMaintenance").add({
        vehicleNumber: String(vehicleNumber ?? "").trim(),
        type: type === "tire" ? "tire" : "oil",
        performedAt: Timestamp.fromDate(new Date(performedAt)),
        mileageKm: Number(mileageKm ?? 0),
        createdAt: FieldValue.serverTimestamp()
      });
      res.status(201).json({ id: ref.id });
    } catch (error) {
      console.error("vehicle-maintenance/create error:", error);
      res.status(500).json({ error: "整備記録の作成に失敗しました" });
    }
  }
);

router.patch(
  "/vehicle-maintenance/:id",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const payload: Record<string, unknown> = {};
      if (req.body.performedAt) {
        payload.performedAt = Timestamp.fromDate(new Date(req.body.performedAt));
      }
      if (req.body.mileageKm != null) {
        payload.mileageKm = Number(req.body.mileageKm);
      }
      await getAdminDb()
        .collection("vehicleMaintenance")
        .doc(req.params.id)
        .update(payload);
      res.json({ ok: true });
    } catch (error) {
      console.error("vehicle-maintenance/update error:", error);
      res.status(500).json({ error: "整備記録の更新に失敗しました" });
    }
  }
);

// --- Reservations ---

router.get("/reservations/active", requireAuth, async (_req, res) => {
  try {
    const db = getAdminDb();
    await completeExpiredReservations(db);
    const snap = await db
      .collection("reservations")
      .where("status", "==", "active")
      .get();
    res.json(serializeDocs(snap.docs));
  } catch (error) {
    console.error("reservations/active error:", error);
    res.status(500).json({ error: "予約一覧の取得に失敗しました" });
  }
});

/** 公開予約スケジュール: 本日0時(JST)〜1ヶ月先の予約中のみ（完了・キャンセル除く） */
router.get("/reservations/schedule", requireAuth, async (_req, res) => {
  try {
    const db = getAdminDb();
    await completeExpiredReservations(db, { admin: true });

    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    const todayJst = formatter.format(new Date()); // YYYY-MM-DD
    const [y, m, d] = todayJst.split("-").map(Number);
    const windowStart = new Date(Date.UTC(y, m - 1, d, -9, 0, 0, 0)); // JST midnight as Instant
    const windowEnd = new Date(windowStart);
    windowEnd.setUTCMonth(windowEnd.getUTCMonth() + 1);

    const snap = await db
      .collection("reservations")
      .where("status", "==", "active")
      .get();

    const docs = snap.docs.filter((docSnap) => {
      const data = docSnap.data() as ReservationLike;
      const start = toDate(data.startTime);
      const end = toDate(data.endTime);
      if (!start || !end) return false;
      return start < windowEnd && end >= windowStart;
    });

    docs.sort((a, b) => {
      const aStart = toDate((a.data() as ReservationLike).startTime)?.getTime() ?? 0;
      const bStart = toDate((b.data() as ReservationLike).startTime)?.getTime() ?? 0;
      return aStart - bStart;
    });

    res.json(serializeDocs(docs));
  } catch (error) {
    console.error("reservations/schedule error:", error);
    res.status(500).json({ error: "予約スケジュールの取得に失敗しました" });
  }
});

router.get("/reservations/mine", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const list = await fetchUserReservations(getAdminDb(), userEmail(authReq));
    res.json(
      list.map((item) => ({
        id: item.id,
        ...serializeDoc(item as Record<string, unknown>)
      }))
    );
  } catch (error) {
    console.error("reservations/mine error:", error);
    res.status(500).json({ error: "予約の取得に失敗しました" });
  }
});

router.post("/reservations", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const email = userEmail(authReq);
    const body = req.body as Record<string, unknown>;
    const startDate = floorToMinute(new Date(String(body.startTime)));
    const endDate = floorToMinute(new Date(String(body.endTime)));
    const vehicleNumber = String(body.vehicleNumber ?? "").trim();
    const isSubstitute = body.usageStatus === "substitute";
    const shouldUpdateVehicleSubstitute =
      typeof body.isSubstituteVehicle === "boolean";
    const substituteUntil =
      isSubstitute && body.substituteUntil
        ? floorToMinute(new Date(String(body.substituteUntil)))
        : null;

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      res.status(400).json({ error: "日時の形式が正しくありません。" });
      return;
    }
    if (endDate <= startDate) {
      res.status(400).json({ error: "終了日時は開始日時より後に設定してください。" });
      return;
    }
    if (
      substituteUntil &&
      (Number.isNaN(substituteUntil.getTime()) ||
        substituteUntil <= startDate)
    ) {
      res.status(400).json({
        error: "代車の終了日時は利用開始日時より後に設定してください。"
      });
      return;
    }

    const db = getAdminDb();
    await completeExpiredReservations(db, { admin: true });
    const activeReservations = await fetchActiveReservations(db);

    const vehicleConflict = activeReservations.find((r) => {
      if (String(r.vehicleNumber ?? "").trim() !== vehicleNumber) return false;
      const rStart = toDate(r.startTime);
      const rEnd = toDate(r.endTime);
      if (!rStart || !rEnd) return false;
      return rangesOverlap(startDate, endDate, rStart, rEnd);
    });
    if (vehicleConflict) {
      res.status(409).json({
        error: "選択した車両はこの時間帯にすでに予約されています。"
      });
      return;
    }

    const userConflict = activeReservations.find((r) => {
      if (r.email !== email) return false;
      const rStart = toDate(r.startTime);
      const rEnd = toDate(r.endTime);
      if (!rStart || !rEnd) return false;
      return rangesOverlap(startDate, endDate, rStart, rEnd);
    });
    if (userConflict) {
      res.status(409).json({
        error: "この時間帯には、すでにあなたの別の予約があります。"
      });
      return;
    }

    const {
      isSubstituteVehicle: _isSubstituteVehicle,
      substituteUntil: _substituteUntil,
      ...reservationBody
    } = body;
    const ref = await db.collection("reservations").add({
      ...reservationBody,
      ...(isSubstitute
        ? {
            usageStatus: "substitute",
            ...(substituteUntil
              ? { substituteUntil: Timestamp.fromDate(substituteUntil) }
              : {})
          }
        : {}),
      email,
      startTime: Timestamp.fromDate(startDate),
      endTime: Timestamp.fromDate(endDate),
      status: "active",
      createdAt: FieldValue.serverTimestamp()
    });

    if (shouldUpdateVehicleSubstitute) {
      const vehicleSnap = await db
        .collection("vehicles")
        .where("vehicleNumber", "==", vehicleNumber)
        .get();
      const batch = db.batch();
      for (const vehicleDoc of vehicleSnap.docs) {
        batch.update(vehicleDoc.ref, {
          isSubstitute,
          substituteUntil:
            isSubstitute && substituteUntil
              ? Timestamp.fromDate(substituteUntil)
              : FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp()
        });
      }
      if (!vehicleSnap.empty) {
        await batch.commit();
      }
    }

    res.status(201).json({ id: ref.id });
  } catch (error) {
    console.error("reservations/create error:", error);
    res.status(500).json({ error: "予約の作成に失敗しました" });
  }
});

router.patch(
  "/reservations/:id/cancel",
  requireAuth,
  async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const ref = getAdminDb().collection("reservations").doc(req.params.id);
      const snap = await ref.get();
      if (!snap.exists) {
        res.status(404).json({ error: "予約が見つかりません" });
        return;
      }
      const data = snap.data() as { email?: string; status?: string };
      if (data.email !== userEmail(authReq)) {
        res.status(403).json({ error: "この予約をキャンセルする権限がありません" });
        return;
      }
      await ref.update({
        status: "cancelled",
        cancelledAt: FieldValue.serverTimestamp()
      });
      res.json({ ok: true });
    } catch (error) {
      console.error("reservations/cancel error:", error);
      res.status(500).json({ error: "予約のキャンセルに失敗しました" });
    }
  }
);

router.post("/reservations/expire", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const admin = req.body?.admin === true;
    const count = await completeExpiredReservations(getAdminDb(), {
      userEmail: admin ? undefined : userEmail(authReq),
      admin
    });
    res.json({ completed: count });
  } catch (error) {
    console.error("reservations/expire error:", error);
    res.status(500).json({ error: "期限切れ予約の更新に失敗しました" });
  }
});

router.get(
  "/reservations/can-start-driving",
  requireAuth,
  async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const email = userEmail(authReq);
      const currentlyDriving = req.query.currentlyDriving === "true";
      const vehicleNumber = String(req.query.vehicleNumber ?? "").trim();
      const db = getAdminDb();

      const activeReservations = await fetchActiveReservations(db);
      const logsSnap = await db
        .collection("drivingLogs")
        .where("email", "==", email)
        .get();
      const logs = logsSnap.docs.map(
        (docSnap) => docSnap.data() as DrivingLogLike
      );

      const now = new Date();
      const activeReservation = findActiveReservationForDriving(
        activeReservations,
        email,
        vehicleNumber,
        now
      );

      const timeReason = drivingStartBlockReason(activeReservation, now);
      if (timeReason && !currentlyDriving) {
        res.json({ allowed: false, reason: timeReason });
        return;
      }

      const allowed = canStartDrivingSession(
        activeReservation,
        logs,
        currentlyDriving,
        { vehicleNumber, now }
      );

      res.json({
        allowed,
        reason: allowed
          ? undefined
          : "終日利用の運転開始は本日1回のみです。翌日以降に再度お試しください。"
      });
    } catch (error) {
      console.error("reservations/can-start-driving error:", error);
      res.status(500).json({ error: "運転開始可否の確認に失敗しました" });
    }
  }
);

// --- Driving logs ---

router.get("/driving-logs/mine", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const limit = Math.min(Number(req.query.limit) || 50, 500);
    const snap = await getAdminDb()
      .collection("drivingLogs")
      .where("email", "==", userEmail(authReq))
      .orderBy("startTime", "desc")
      .limit(limit)
      .get();
    res.json(serializeDocs(snap.docs));
  } catch (error) {
    console.error("driving-logs/mine error:", error);
    res.status(500).json({ error: "運転記録の取得に失敗しました" });
  }
});

router.get("/driving-logs/active", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const snap = await getAdminDb()
      .collection("drivingLogs")
      .where("email", "==", userEmail(authReq))
      .orderBy("startTime", "desc")
      .limit(10)
      .get();

    const active = snap.docs.find(
      (docSnap) => (docSnap.data() as { status?: string }).status === "driving"
    );

    if (!active) {
      res.json(null);
      return;
    }

    res.json({
      id: active.id,
      ...serializeDoc(active.data() as Record<string, unknown>)
    });
  } catch (error) {
    console.error("driving-logs/active error:", error);
    res.status(500).json({ error: "運転中記録の取得に失敗しました" });
  }
});

router.get("/driving-logs/recent", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 300, 500);
    const snap = await getAdminDb()
      .collection("drivingLogs")
      .orderBy("startTime", "desc")
      .limit(limit)
      .get();
    res.json(serializeDocs(snap.docs));
  } catch (error) {
    console.error("driving-logs/recent error:", error);
    res.status(500).json({ error: "運転記録の取得に失敗しました" });
  }
});

router.post("/driving-logs", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const db = getAdminDb();
    const email = userEmail(authReq);
    const body = (req.body ?? {}) as Record<string, unknown>;

    let userName =
      typeof body.userName === "string" ? body.userName.trim() : "";
    if (!userName) {
      try {
        const profileSnap = await db
          .collection("staffProfiles")
          .doc(email.trim().toLowerCase())
          .get();
        if (profileSnap.exists) {
          const profile = profileSnap.data() as { name?: string };
          userName = profile.name?.trim() ?? "";
        }
      } catch (error) {
        console.warn("driving-logs/create staff name lookup failed:", error);
      }
    }
    if (!userName) {
      userName =
        typeof authReq.user.name === "string" ? authReq.user.name.trim() : "";
    }

    const payload: Record<string, unknown> = {
      ...body,
      email,
      startTime: FieldValue.serverTimestamp(),
      status: "driving",
      ...getFixedAlcoholCheckFields()
    };
    if (userName) payload.userName = userName;

    const ref = await db.collection("drivingLogs").add(payload);
    res.status(201).json({ id: ref.id });
  } catch (error) {
    console.error("driving-logs/create error:", error);
    res.status(500).json({ error: "運転開始の記録に失敗しました" });
  }
});

router.patch("/driving-logs/:id/end", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const ref = getAdminDb().collection("drivingLogs").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ error: "運転記録が見つかりません" });
      return;
    }
    const data = snap.data() as { email?: string };
    if (data.email !== userEmail(authReq)) {
      res.status(403).json({ error: "権限がありません" });
      return;
    }
    await ref.update({ endTime: FieldValue.serverTimestamp() });
    res.json({ ok: true });
  } catch (error) {
    console.error("driving-logs/end error:", error);
    res.status(500).json({ error: "運転終了の記録に失敗しました" });
  }
});

router.patch("/driving-logs/:id/report", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const ref = getAdminDb().collection("drivingLogs").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ error: "運転記録が見つかりません" });
      return;
    }
    const data = snap.data() as { email?: string; endTime?: unknown };
    if (data.email !== userEmail(authReq)) {
      res.status(403).json({ error: "権限がありません" });
      return;
    }

    const reportTime = FieldValue.serverTimestamp();
    const initialApproval = await resolveInitialApprovalStatus(
      getAdminDb(),
      userEmail(authReq),
      "driving"
    );
    const updateBody = {
      ...req.body,
      status: "reported",
      endTime: data.endTime ?? FieldValue.serverTimestamp(),
      reportTime,
      ...approvalFieldsForStatus(initialApproval)
    };

    await ref.update(updateBody);

    const logForNotify = {
      ...data,
      ...req.body,
      status: "reported",
      endTime: data.endTime ?? new Date(),
      reportTime: new Date(),
      approvalStatus: initialApproval
    };
    if (initialApproval === "pending") {
      void notifyOfficersOnReportSubmitted(
        getAdminDb(),
        req.params.id,
        logForNotify
      )
        .then((result) =>
          console.log("report notification", { id: req.params.id, ...result })
        )
        .catch((err) =>
          console.error("report notification failed", {
            id: req.params.id,
            err
          })
        );
    }

    res.json({ ok: true, approvalStatus: initialApproval });
  } catch (error) {
    console.error("driving-logs/report error:", error);
    res.status(500).json({ error: "運転報告の送信に失敗しました" });
  }
});

router.patch("/driving-logs/:id/approval", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const action = req.body?.action;
    if (action !== "approve" && action !== "reject") {
      res.status(400).json({ error: "action は approve または reject を指定してください" });
      return;
    }

    const ref = getAdminDb().collection("drivingLogs").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ error: "運転記録が見つかりません" });
      return;
    }

    const data = snap.data() as { email?: string; status?: string };
    if (data.status !== "reported") {
      res.status(400).json({ error: "報告済みの記録のみ承認できます" });
      return;
    }

    const allowed = await canApproveStaffRecord(
      getAdminDb(),
      userEmail(authReq),
      data.email
    );
    if (!allowed) {
      res.status(403).json({ error: "この運転報告を承認する権限がありません" });
      return;
    }

    await ref.update({
      approvalStatus: action === "approve" ? "approved" : "rejected",
      approvedAt: FieldValue.serverTimestamp(),
      approvedBy: userEmail(authReq)
    });

    res.json({ ok: true, approvalStatus: action === "approve" ? "approved" : "rejected" });
  } catch (error) {
    console.error("driving-logs/approval error:", error);
    res.status(500).json({ error: "承認処理に失敗しました" });
  }
});

router.patch("/driving-logs/:id/alcohol-check", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const payload = getFixedAlcoholCheckFields();

    const ref = getAdminDb().collection("drivingLogs").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ error: "運転記録が見つかりません" });
      return;
    }

    const data = snap.data() as { email?: string };
    const allowed = await canApproveStaffRecord(
      getAdminDb(),
      userEmail(authReq),
      data.email
    );
    if (!allowed) {
      res.status(403).json({
        error: "この酒気帯び記録を編集する権限がありません"
      });
      return;
    }

    await ref.update({
      ...payload,
      alcoholCheckUpdatedAt: FieldValue.serverTimestamp(),
      alcoholCheckUpdatedBy: userEmail(authReq)
    });

    res.json({
      ok: true,
      ...payload
    });
  } catch (error) {
    console.error("driving-logs/alcohol-check error:", error);
    res.status(500).json({ error: "酒気帯び確認の更新に失敗しました" });
  }
});

// --- Records ---

router.post("/refueling-records", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const ref = await getAdminDb().collection("refuelingRecords").add({
      ...req.body,
      email: userEmail(authReq),
      timestamp: FieldValue.serverTimestamp()
    });
    res.status(201).json({ id: ref.id });
  } catch (error) {
    console.error("refueling-records/create error:", error);
    res.status(500).json({ error: "給油記録の保存に失敗しました" });
  }
});

router.post("/etc-records", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const body = req.body as Record<string, unknown>;
    const email = userEmail(authReq);
    const initialApproval = await resolveInitialApprovalStatus(
      getAdminDb(),
      email,
      "etc"
    );
    const ref = await getAdminDb().collection("etcRecords").add({
      ...body,
      email,
      startTime: Timestamp.fromDate(new Date(String(body.startTime))),
      endTime: FieldValue.serverTimestamp(),
      ...approvalFieldsForCreate(initialApproval)
    });

    void notifyOfficersOnEtcSubmitted(getAdminDb(), ref.id, {
      ...body,
      email,
      startTime: body.startTime,
      endTime: new Date(),
      approvalStatus: initialApproval
    })
      .then((result) =>
        console.log("etc notification", { id: ref.id, ...result })
      )
      .catch((err) =>
        console.error("etc notification failed", { id: ref.id, err })
      );

    res.status(201).json({ id: ref.id, approvalStatus: initialApproval });
  } catch (error) {
    console.error("etc-records/create error:", error);
    res.status(500).json({ error: "ETC記録の保存に失敗しました" });
  }
});

router.patch("/etc-records/:id/approval", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const action = req.body?.action;
    if (action !== "approve" && action !== "reject") {
      res.status(400).json({ error: "action は approve または reject を指定してください" });
      return;
    }

    const ref = getAdminDb().collection("etcRecords").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ error: "ETC記録が見つかりません" });
      return;
    }

    const data = snap.data() as { email?: string };
    const allowed = await canApproveStaffRecord(
      getAdminDb(),
      userEmail(authReq),
      data.email
    );
    if (!allowed) {
      res.status(403).json({ error: "この ETC 記録を承認する権限がありません" });
      return;
    }

    await ref.update({
      approvalStatus: action === "approve" ? "approved" : "rejected",
      approvedAt: FieldValue.serverTimestamp(),
      approvedBy: userEmail(authReq)
    });

    res.json({ ok: true, approvalStatus: action === "approve" ? "approved" : "rejected" });
  } catch (error) {
    console.error("etc-records/approval error:", error);
    res.status(500).json({ error: "承認処理に失敗しました" });
  }
});

router.post("/gps-logs", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const ref = await getAdminDb().collection("gpsLogs").add({
      ...req.body,
      email: userEmail(authReq),
      timestamp: FieldValue.serverTimestamp()
    });
    res.status(201).json({ id: ref.id });
  } catch (error) {
    console.error("gps-logs/create error:", error);
    res.status(500).json({ error: "GPS記録の保存に失敗しました" });
  }
});

// --- Admin ---

router.get(
  "/admin/collections/:name",
  requireAuth,
  async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const email = userEmail(authReq);
      const name = req.params.name;
      const access = await resolveAdminAccess(getAdminDb(), email);

      if (!ADMIN_COLLECTIONS.has(name)) {
        res.status(400).json({ error: "無効なコレクション名です" });
        return;
      }

      if (!access.canViewAllTabs) {
        res.status(403).json({ error: "管理者または閲覧権限が必要です" });
        return;
      }

      const orderField =
        name === "gpsLogs" || name === "refuelingRecords"
          ? "timestamp"
          : "startTime";

      if (name === "drivingLogs" || name === "reservations") {
        await completeExpiredReservations(getAdminDb(), { admin: true });
      }

      const limit = Math.min(Number(req.query.limit) || 200, 500);
      const snap = await getAdminDb()
        .collection(name)
        .orderBy(orderField, "desc")
        .limit(limit)
        .get();

      res.json(serializeDocs(snap.docs));
    } catch (error) {
      console.error("admin/collections error:", error);
      const { status, body } = firestoreErrorPayload(
        error,
        "データの取得に失敗しました"
      );
      res.status(status).json(body);
    }
  }
);

router.delete(
  "/admin/collections/:name/:id",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const name = req.params.name;
      if (!DELETABLE_ADMIN_COLLECTIONS.has(name)) {
        res.status(400).json({ error: "削除できないコレクションです" });
        return;
      }
      const ref = getAdminDb().collection(name).doc(req.params.id);
      const snap = await ref.get();
      if (!snap.exists) {
        res.status(404).json({ error: "データが見つかりません" });
        return;
      }
      await ref.delete();
      res.json({ ok: true });
    } catch (error) {
      console.error("admin/collections delete one error:", error);
      res.status(500).json({ error: "データの削除に失敗しました" });
    }
  }
);

router.delete(
  "/admin/collections/:name",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const name = req.params.name;
      if (!DELETABLE_ADMIN_COLLECTIONS.has(name)) {
        res.status(400).json({ error: "削除できないコレクションです" });
        return;
      }
      const deleted = await deleteAllInCollection(getAdminDb(), name);
      res.json({ ok: true, deleted });
    } catch (error) {
      console.error("admin/collections delete all error:", error);
      res.status(500).json({ error: "データの一括削除に失敗しました" });
    }
  }
);

// --- Staff / departments (report alerts) ---

router.get("/admin/departments", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const allowed = await canViewAdminPanel(getAdminDb(), userEmail(authReq));
    if (!allowed) {
      res.status(403).json({ error: "管理者または閲覧権限が必要です" });
      return;
    }
    const snap = await getAdminDb().collection("departments").orderBy("name").get();
    res.json(
      snap.docs.map((doc) => {
        const data = doc.data();
        const officers = parseDepartmentOfficers(data);
        return {
          id: doc.id,
          name: data.name,
          officers,
          officerEmails: officerEmailsFromOfficers(officers),
          sealImageUrl:
            typeof data.sealImageUrl === "string" ? data.sealImageUrl : ""
        };
      })
    );
  } catch (error) {
    console.error("admin/departments list error:", error);
    res.status(500).json({ error: "部署の取得に失敗しました" });
  }
});

function normalizeSealImageUrl(value: unknown): string {
  const url = String(value ?? "").trim();
  return url.startsWith("http") ? url : "";
}

router.post("/admin/departments", requireAuth, requireAdmin, async (req, res) => {
  try {
    const body = req.body as {
      name?: string;
      officers?: { name?: string; email?: string }[];
      officerEmails?: string[];
      sealImageUrl?: string;
    };
    if (!body.name?.trim()) {
      res.status(400).json({ error: "部署名は必須です" });
      return;
    }
    const officers = normalizeOfficersInput(body.officers, body.officerEmails);
    const sealImageUrl = normalizeSealImageUrl(body.sealImageUrl);
    const ref = await getAdminDb()
      .collection("departments")
      .add({
        name: body.name.trim(),
        officers,
        officerEmails: officerEmailsFromOfficers(officers),
        sealImageUrl,
        updatedAt: FieldValue.serverTimestamp()
      });
    res.status(201).json({ id: ref.id });
  } catch (error) {
    console.error("admin/departments create error:", error);
    res.status(500).json({ error: "部署の作成に失敗しました" });
  }
});

router.put(
  "/admin/departments/:id",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const body = req.body as {
        name?: string;
        officers?: { name?: string; email?: string }[];
        officerEmails?: string[];
        sealImageUrl?: string;
      };
      if (!body.name?.trim()) {
        res.status(400).json({ error: "部署名は必須です" });
        return;
      }
      const ref = getAdminDb().collection("departments").doc(req.params.id);
      const snap = await ref.get();
      if (!snap.exists) {
        res.status(404).json({ error: "部署が見つかりません" });
        return;
      }
      const officers = normalizeOfficersInput(body.officers, body.officerEmails);
      const sealImageUrl = normalizeSealImageUrl(body.sealImageUrl);
      await ref.update({
        name: body.name.trim(),
        officers,
        officerEmails: officerEmailsFromOfficers(officers),
        sealImageUrl,
        updatedAt: FieldValue.serverTimestamp()
      });
      res.json({ ok: true });
    } catch (error) {
      console.error("admin/departments update error:", error);
      res.status(500).json({ error: "部署の更新に失敗しました" });
    }
  }
);

router.delete(
  "/admin/departments/:id",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      await getAdminDb().collection("departments").doc(req.params.id).delete();
      res.json({ ok: true });
    } catch (error) {
      console.error("admin/departments delete error:", error);
      res.status(500).json({ error: "部署の削除に失敗しました" });
    }
  }
);

router.get(
  "/admin/staff-profiles",
  requireAuth,
  async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const allowed = await canViewAdminPanel(getAdminDb(), userEmail(authReq));
      if (!allowed) {
        res.status(403).json({ error: "管理者または閲覧権限が必要です" });
        return;
      }
      const snap = await getAdminDb()
        .collection("staffProfiles")
        .orderBy("email")
        .get();
      res.json(
        snap.docs.map((doc) => ({
          id: doc.id,
          email: doc.id,
          ...doc.data()
        }))
      );
    } catch (error) {
      console.error("admin/staff-profiles list error:", error);
      res.status(500).json({ error: "スタッフの取得に失敗しました" });
    }
  }
);

router.put(
  "/admin/staff-profiles/:email",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const email = decodeURIComponent(req.params.email).trim().toLowerCase();
      const body = req.body as {
        name?: string;
        employmentType?: string;
        departmentId?: string;
        departmentIds?: string[];
        skipDrivingApproval?: boolean;
        skipEtcApproval?: boolean;
      };
      if (!email) {
        res.status(400).json({ error: "メールは必須です" });
        return;
      }
      if (
        body.employmentType !== "employee" &&
        body.employmentType !== "part_time"
      ) {
        res.status(400).json({ error: "区分が不正です" });
        return;
      }
      const departmentIds = collectStaffDepartmentIds({
        departmentId: body.departmentId,
        departmentIds: body.departmentIds
      });
      await getAdminDb()
        .collection("staffProfiles")
        .doc(email)
        .set(
          {
            email,
            name: body.name?.trim() || null,
            employmentType: body.employmentType,
            departmentId: departmentIds[0] ?? null,
            departmentIds: departmentIds.length > 0 ? departmentIds : null,
            skipDrivingApproval: body.skipDrivingApproval === true,
            skipEtcApproval: body.skipEtcApproval === true,
            updatedAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );
      res.json({ ok: true });
    } catch (error) {
      console.error("admin/staff-profiles upsert error:", error);
      res.status(500).json({ error: "スタッフの保存に失敗しました" });
    }
  }
);

router.delete(
  "/admin/staff-profiles/:email",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const email = decodeURIComponent(req.params.email).trim().toLowerCase();
      await getAdminDb().collection("staffProfiles").doc(email).delete();
      res.json({ ok: true });
    } catch (error) {
      console.error("admin/staff-profiles delete error:", error);
      res.status(500).json({ error: "スタッフの削除に失敗しました" });
    }
  }
);

// --- Employee site integration (server-to-server) ---

router.get(
  "/integrations/employee-site/departments",
  requireEmployeeSiteSync,
  async (_req, res) => {
    try {
      const departments = await listDepartmentsForEmployeeSite(getAdminDb());
      res.json({ departments });
    } catch (error) {
      console.error("integrations/employee-site/departments error:", error);
      res.status(500).json({ error: "部署一覧の取得に失敗しました" });
    }
  }
);

router.post(
  "/integrations/employee-site/staff-profiles",
  requireEmployeeSiteSync,
  async (req, res) => {
    try {
      const staff = normalizeEmployeeSiteStaffPayload(req.body);
      if (staff.length === 0) {
        res.status(400).json({
          error:
            "staff array or single object with email, name, employmentType, departmentId/departmentName is required"
        });
        return;
      }

      const results = await syncStaffFromEmployeeSite(getAdminDb(), staff);
      const synced = results.filter((result) => result.ok).length;
      const failed = results.filter((result) => !result.ok);

      res.status(failed.length === 0 ? 200 : 207).json({
        ok: failed.length === 0,
        synced,
        failed: failed.length,
        results
      });
    } catch (error) {
      console.error("integrations/employee-site/staff-profiles error:", error);
      res.status(500).json({ error: "スタッフ同期に失敗しました" });
    }
  }
);

router.post("/maintenance/trim-operational-data", async (req, res) => {
  try {
    const secret = process.env.MAINTENANCE_SECRET?.trim();
    const provided = String(req.header("x-maintenance-secret") ?? "").trim();
    if (!secret || provided !== secret) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const summary = await trimOperationalData();
    res.json({ ok: true, summary });
  } catch (error) {
    console.error("maintenance/trim-operational-data error:", error);
    res.status(500).json({ error: "データ整理に失敗しました" });
  }
});

/** Cloud Scheduler: 毎日 13:00 / 18:00 JST に運転報告未提出リマインド */
router.post(
  "/jobs/remind-missing-reports",
  requireJobSecret,
  async (_req, res) => {
    try {
      const result = await runMissingReportReminderJob(getAdminDb());
      console.log("remind-missing-reports", result);
      res.json({ ok: true, ...result });
    } catch (error) {
      console.error("remind-missing-reports error:", error);
      res.status(500).json({ error: "未提出リマインド処理に失敗しました" });
    }
  }
);

export default router;
