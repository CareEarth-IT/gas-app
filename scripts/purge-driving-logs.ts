import "dotenv/config";
import { getAdminDb } from "../server/firebaseAdmin.ts";

const BATCH_SIZE = 400;

async function main() {
  const db = getAdminDb();
  let deleted = 0;

  console.log("Deleting all documents in drivingLogs...");

  while (true) {
    const snap = await db.collection("drivingLogs").limit(BATCH_SIZE).get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;
    console.log(`  deleted ${deleted} so far`);
  }

  console.log(`Done. Total deleted: ${deleted}`);
}

main().catch((error) => {
  console.error("Purge failed:", error);
  process.exit(1);
});
