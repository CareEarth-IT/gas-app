import type { MailPayload } from "./types.ts";

const DEFAULT_URL =
  "https://violetgoat8.sakura.ne.jp/employee.drive/send-mail.php";

export async function sendMailViaSakura(
  payload: MailPayload
): Promise<boolean> {
  const url = process.env.SAKURA_MAIL_URL?.trim() || DEFAULT_URL;
  const secret = process.env.SAKURA_MAIL_SECRET?.trim();
  if (!secret) {
    console.warn("SAKURA_MAIL_SECRET is not set. Skipping email via Sakura.");
    return false;
  }

  const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];
  const valid = recipients.map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (valid.length === 0) return false;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret,
      to: valid,
      subject: payload.subject,
      text: payload.text
    })
  });

  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  };

  if (!response.ok || !body.ok) {
    console.error("Sakura mail API failed", {
      status: response.status,
      body
    });
    return false;
  }

  console.log("Email sent via Sakura", {
    to: valid,
    subject: payload.subject
  });
  return true;
}
