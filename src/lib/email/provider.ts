import type { EmailMessage, SendEmailResult } from "./types";
import { ConsoleEmailProvider } from "./console";
import { GmailSmtpProvider } from "./smtp";

export interface EmailProvider {
  readonly id: string;
  send(message: EmailMessage): Promise<SendEmailResult>;
}

export function getEmailProvider(): EmailProvider {
  // If explicitly disabled or in testing/dev without credentials, use ConsoleEmailProvider
  const isEnabled = process.env.EMAIL_ENABLED === "true";
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_FROM;
  const smtpPassword = process.env.SMTP_PASSWORD;

  if (!isEnabled || !smtpUser || !smtpPassword) {
    return new ConsoleEmailProvider();
  }

  return new GmailSmtpProvider({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    user: smtpUser,
    password: smtpPassword,
    from: process.env.EMAIL_FROM || smtpUser,
    replyTo: process.env.EMAIL_REPLY_TO,
    relayUrl: process.env.SMTP_RELAY_URL,
  });
}
