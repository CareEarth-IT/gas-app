import { sendMailViaFirebase } from "./firebaseProvider.ts";
import { sendMailViaSakura } from "./sakuraProvider.ts";
import type { MailPayload, MailProvider } from "./types.ts";

export type { MailPayload, MailProvider } from "./types.ts";
export { sendMailViaSakura } from "./sakuraProvider.ts";
export { sendMailViaFirebase } from "./firebaseProvider.ts";

/** 本番は未設定（= sakura）。firebase はローカル検証用のみ。 */
export function getMailProvider(): MailProvider {
  const raw = process.env.MAIL_PROVIDER?.trim().toLowerCase();
  return raw === "firebase" ? "firebase" : "sakura";
}

export async function sendMail(payload: MailPayload): Promise<boolean> {
  const provider = getMailProvider();
  if (provider === "firebase") {
    return sendMailViaFirebase(payload);
  }
  return sendMailViaSakura(payload);
}
