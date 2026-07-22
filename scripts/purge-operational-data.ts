import "dotenv/config";
import { getAdminDb } from "../server/firebaseAdmin.ts";

const COLLECTIONS_TO_PURGE = [
  "drivingLogs",
  "reservations",
  "refuelingRecords",
  "etcRecords",
  "gpsLogs"
] as const;

const BATCH_SIZE = 400;

async function deleteCollection(collectionName: string): Promise<number> {
  const db = getAdminDb();
  let deleted = 0;

  while (true) {
    const snap = await db.collection(collectionName).limit(BATCH_SIZE).get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;
    console.log(`  ${collectionName}: deleted ${deleted} so far`);
  }

  return deleted;
}

async function main() {
  const projectId =
    process.env.FIREBASE_PROJECT_ID || "ce-gr-drive-2605st";
  const databaseId =
    process.env.FIRESTORE_DATABASE_ID ||
    "ai-studio-cbd9157d-bd2d-4aec-ab4a-3da5bfff1e8e";

  console.log(`Purging operational data from project=${projectId} database=${databaseId}`);
  console.log(`Collections: ${COLLECTIONS_TO_PURGE.join(", ")}`);
  console.log("Preserving: vehicles, vehicleMaintenance, departments, staffProfiles");

  const totals: Record<string, number> = {};

  for (const name of COLLECTIONS_TO_PURGE) {
    console.log(`\nDeleting ${name}...`);
    totals[name] = await deleteCollection(name);
    console.log(`  ${name}: done (${totals[name]} documents)`);
  }

  console.log("\nSummary:");
  for (const [name, count] of Object.entries(totals)) {
    console.log(`  ${name}: ${count}`);
  }
  console.log(`  total: ${Object.values(totals).reduce((a, b) => a + b, 0)}`);
}

main().catch((error) => {
  console.error("Purge failed:", error);
  process.exit(1);
});
