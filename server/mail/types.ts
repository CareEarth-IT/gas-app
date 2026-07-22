export type MailPayload = {
  to: string | string[];
  subject: string;
  text: string;
};

export type MailProvider = "sakura" | "firebase";
