import "dotenv/config";
import { trimOperationalData } from "../server/trimOperationalData.ts";

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || "ce-gr-drive-2605st";
  const databaseId =
    process.env.FIRESTORE_DATABASE_ID ||
    "ai-studio-cbd9157d-bd2d-4aec-ab4a-3da5bfff1e8e";

  console.log(`Trim operational data: project=${projectId} database=${databaseId}`);
  console.log("Keep newest 1 document per collection, delete the rest.\n");

  const summary = await trimOperationalData();

  console.log("Summary:");
  for (const [name, result] of Object.entries(summary)) {
    console.log(
      `  ${name}: total=${result.total}, kept=${result.kept ?? "(none)"}, deleted=${result.deleted}`
    );
  }
}

main().catch((error) => {
  console.error("Trim failed:", error);
  process.exit(1);
});
