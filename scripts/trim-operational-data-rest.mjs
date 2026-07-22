import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const firebaseAuth = require(
  "C:/Users/yutam/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth.js"
);
const firebaseScopes = require(
  "C:/Users/yutam/AppData/Roaming/npm/node_modules/firebase-tools/lib/scopes.js"
);

const PROJECT = "ce-gr-drive-2605st";
const DATABASE = "ai-studio-cbd9157d-bd2d-4aec-ab4a-3da5bfff1e8e";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DATABASE}/documents`;

const COLLECTIONS = [
  { name: "drivingLogs", sortFields: ["startTime", "reportTime", "endTime"] },
  { name: "reservations", sortFields: ["startTime", "createdAt"] },
  { name: "etcRecords", sortFields: ["startTime", "endTime"] },
  { name: "gpsLogs", sortFields: ["timestamp"] }
];

const BATCH_SIZE = 400;

function fieldToMillis(field) {
  if (!field) return 0;
  if (field.timestampValue) return Date.parse(field.timestampValue);
  if (field.stringValue) return Date.parse(field.stringValue) || 0;
  if (field.integerValue) return Number(field.integerValue) * 1000;
  return 0;
}

function docSortTime(fields, sortFieldNames) {
  for (const name of sortFieldNames) {
    const ms = fieldToMillis(fields?.[name]);
    if (ms > 0) return ms;
  }
  return 0;
}

async function getAccessToken() {
  const account = firebaseAuth.getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) {
    throw new Error("firebase login が必要です");
  }
  const token = await firebaseAuth.getAccessToken(
    account.tokens.refresh_token,
    [firebaseScopes.CLOUD_PLATFORM]
  );
  return token.access_token;
}

async function listCollection(token, collectionName) {
  const docs = [];
  let pageToken = "";

  while (true) {
    const url = new URL(`${BASE}/${collectionName}`);
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`list ${collectionName} failed: ${res.status} ${body}`);
    }

    const data = await res.json();
    if (Array.isArray(data.documents)) {
      docs.push(...data.documents);
    }
    pageToken = data.nextPageToken ?? "";
    if (!pageToken) break;
  }

  return docs;
}

async function batchDelete(token, docNames) {
  for (let i = 0; i < docNames.length; i += BATCH_SIZE) {
    const chunk = docNames.slice(i, i + BATCH_SIZE);
    const writes = chunk.map((name) => ({ delete: name }));

    const res = await fetch(`${BASE}:batchWrite`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ writes })
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`batchWrite failed: ${res.status} ${body}`);
    }
  }
}

async function trimCollection(token, collectionName, sortFields) {
  const docs = await listCollection(token, collectionName);
  if (docs.length <= 1) {
    console.log(
      `  ${collectionName}: total=${docs.length}, kept=${docs[0]?.name?.split("/").pop() ?? "(none)"}, deleted=0`
    );
    return { total: docs.length, kept: docs[0]?.name?.split("/").pop() ?? null, deleted: 0 };
  }

  const sorted = [...docs].sort((a, b) => {
    const aTime = docSortTime(a.fields, sortFields);
    const bTime = docSortTime(b.fields, sortFields);
    return bTime - aTime;
  });

  const keep = sorted[0];
  const remove = sorted.slice(1);
  const keepId = keep.name.split("/").pop();

  await batchDelete(
    token,
    remove.map((doc) => doc.name)
  );

  console.log(
    `  ${collectionName}: total=${sorted.length}, kept=${keepId}, deleted=${remove.length}`
  );

  return { total: sorted.length, kept: keepId, deleted: remove.length };
}

async function main() {
  console.log(`Trim operational data: project=${PROJECT} database=${DATABASE}`);
  console.log("Keep newest 1 document per collection, delete the rest.\n");

  const token = await getAccessToken();

  for (const { name, sortFields } of COLLECTIONS) {
    console.log(`Processing ${name}...`);
    await trimCollection(token, name, sortFields);
  }

  console.log("\nDone.");
}

main().catch((error) => {
  console.error("Trim failed:", error);
  process.exit(1);
});
