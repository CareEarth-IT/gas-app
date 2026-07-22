import { FieldValue } from "firebase-admin/firestore";

import { getAdminDb } from "../firebaseAdmin.ts";
import type { MailPayload } from "./types.ts";

/**
 * Firebase Extensions「Trigger Email (firestore-send-email)」向け。
 * Firestore の mail コレクションにドキュメントを追加すると Extension が送信する。
 *
 * 本番 Cloud Run では MAIL_PROVIDER=sakura（既定）のまま運用し、
 * ローカル検証時のみ MAIL_PROVIDER=firebase を .env に設定する。
 */
export async function sendMailViaFirebase(
  payload: MailPayload
): Promise<boolean> {
  const collection = process.env.FIREBASE_MAIL_COLLECTION?.trim() || "mail";
  const from = process.env.FIREBASE_MAIL_FROM?.trim();

  const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];
  const valid = recipients.map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (valid.length === 0) return false;

  const doc: Record<string, unknown> = {
    to: valid.length === 1 ? valid[0] : valid,
    message: {
      subject: payload.subject,
      text: payload.text
    },
    createdAt: FieldValue.serverTimestamp()
  };

  if (from) {
    doc.from = from;
  }

  try {
    const ref = await getAdminDb().collection(collection).add(doc);
    console.log("Email queued via Firebase Trigger Email", {
      id: ref.id,
      collection,
      to: valid,
      subject: payload.subject
    });
    return true;
  } catch (error) {
    console.error("Firebase mail queue failed", error);
    return false;
  }
}
