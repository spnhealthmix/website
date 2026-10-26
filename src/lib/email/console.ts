import type { EmailMessage, SendEmailResult } from "./types";
import type { EmailProvider } from "./provider";

export class ConsoleEmailProvider implements EmailProvider {
  readonly id = "console";

  async send(message: EmailMessage): Promise<SendEmailResult> {
    const timestamp = new Date().toISOString();
    const messageId = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Safe operational logging without exposing secrets
    console.log(
      `[Email Service (Console Mode)] [${timestamp}] To: ${message.to.email} | Subject: "${message.subject}" | MessageId: ${messageId}`,
    );

    return {
      success: true,
      messageId,
      provider: this.id,
    };
  }
}
