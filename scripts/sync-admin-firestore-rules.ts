import fs from "fs";
import path from "path";

import { ADMIN_EMAILS } from "../shared/adminEmails.ts";

const rulesPath = path.join(process.cwd(), "firestore.rules");
const rules = fs.readFileSync(rulesPath, "utf8");

const emailLines = ADMIN_EMAILS.map(
  (email) => `          '${email.toLowerCase()}'`
).join(",\n");

const isAdminBlock = `    function isAdmin() {
      return isSignedIn()
        && request.auth.token.email.lower() in [
${emailLines}
        ];
    }`;

const start = rules.indexOf("    function isAdmin() {");
const end = rules.indexOf("    function isValidEmail", start);
if (start === -1 || end === -1) {
  console.error("firestore.rules の isAdmin() を更新できませんでした");
  process.exit(1);
}

const next = `${rules.slice(0, start)}${isAdminBlock}\n\n${rules.slice(end)}`;

fs.writeFileSync(rulesPath, next);
console.log(
  `firestore.rules を更新しました（管理者 ${ADMIN_EMAILS.length} 件）:`
);
for (const email of ADMIN_EMAILS) {
  console.log(`  - ${email}`);
}
