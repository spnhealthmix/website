import type { EmailMessage, SendEmailResult } from "./types";
import type { EmailProvider } from "./provider";

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  replyTo?: string;
  relayUrl?: string;
}

function cleanHeader(val: string): string {
  return val.replace(/[\r\n]/g, "").replace(/"/g, "");
}

/**
 * Builds standard RFC 2822 multipart/alternative MIME email payload.
 */
function buildMimeMessage(message: EmailMessage, from: string, replyTo?: string): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const cleanToName = message.to.name ? cleanHeader(message.to.name) : undefined;
  const cleanToEmail = cleanHeader(message.to.email);
  const toHeader = cleanToName
    ? `"${cleanToName}" <${cleanToEmail}>`
    : cleanToEmail;
  const fromHeader = `"SPN Health Mix" <${cleanHeader(from)}>`;

  const headers = [
    `From: ${fromHeader}`,
    `To: ${toHeader}`,
    `Subject: =?UTF-8?B?${Buffer.from(cleanHeader(message.subject)).toString("base64")}?=`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2, 10)}@spnfoods.in>`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  if (replyTo) {
    headers.push(`Reply-To: ${cleanHeader(replyTo)}`);
  }

  if (message.headers) {
    for (const [k, v] of Object.entries(message.headers)) {
      headers.push(`${cleanHeader(k)}: ${cleanHeader(v)}`);
    }
  }

  const bodyParts = [
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    Buffer.from(message.text, "utf-8").toString("base64"),
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    Buffer.from(message.html, "utf-8").toString("base64"),
    ``,
    `--${boundary}--`,
    ``,
  ];

  return headers.join("\r\n") + "\r\n\r\n" + bodyParts.join("\r\n");
}

export class GmailSmtpProvider implements EmailProvider {
  readonly id = "gmail-smtp";
  private config: SmtpConfig;

  constructor(config: SmtpConfig) {
    this.config = config;
  }

  async send(message: EmailMessage): Promise<SendEmailResult> {
    const fromAddress = message.from || this.config.from;
    const replyToAddress = message.replyTo || this.config.replyTo;
    const recipientEmail = message.to.email;

    // 1. If an HTTP mail relay or API bridge is configured (ideal for edge workers), use HTTP fetch
    if (this.config.relayUrl) {
      try {
        const response = await fetch(this.config.relayUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.password}`,
          },
          body: JSON.stringify({
            from: fromAddress,
            to: recipientEmail,
            subject: message.subject,
            html: message.html,
            text: message.text,
            replyTo: replyToAddress,
          }),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          console.error(`[Email Service (SMTP Relay)] HTTP gateway error (${response.status}): ${errText}`);
          return {
            success: false,
            provider: this.id,
            error: `Relay error (${response.status})`,
          };
        }

        const data: any = await response.json().catch(() => ({}));
        return {
          success: true,
          messageId: data?.id || `relay-${Date.now()}`,
          provider: this.id,
        };
      } catch (err: any) {
        console.error("[Email Service (SMTP Relay)] Relay fetch failed:", err?.message || err);
        return {
          success: false,
          provider: this.id,
          error: "Relay connection failed",
        };
      }
    }

    // 2. Direct SMTPS (Port 465 over TLS)
    // SMTPS establishes TLS directly on initial socket connection, avoiding STARTTLS upgrade issues.
    try {
      const mime = buildMimeMessage(message, fromAddress, replyToAddress);
      const messageId = await this.sendViaDirectSmtps(fromAddress, recipientEmail, mime);

      console.log(
        `[Email Service (Gmail SMTP)] Delivered transactional email to ${recipientEmail} (ID: ${messageId})`,
      );

      return {
        success: true,
        messageId,
        provider: this.id,
      };
    } catch (err: any) {
      // Normalize error without exposing passwords or sensitive auth tokens
      let safeErrorMsg = err?.message || "SMTP dispatch failed";
      if (this.config.password) {
        safeErrorMsg = safeErrorMsg.replaceAll(this.config.password, "[REDACTED]");
      }
      safeErrorMsg = safeErrorMsg.replace(/([A-Za-z0-9+/=]{20,})/g, "[REDACTED]");

      console.error(
        `[Email Service (Gmail SMTP)] Failed to send email to ${recipientEmail}: ${safeErrorMsg}`,
      );

      return {
        success: false,
        provider: this.id,
        error: safeErrorMsg,
      };
    }
  }

  /**
   * Performs zero-dependency direct SMTPS handshake over secure TLS (port 465).
   * Works on Node.js and runtime socket environments.
   * If running inside Cloudflare Workers where raw outbound TLS socket connect is
   * restricted or unavailable, configure SMTP_RELAY_URL for HTTP transport.
   */
  private async sendViaDirectSmtps(from: string, to: string, rawMime: string): Promise<string> {
    let tls: any;
    try {
      tls = await import("node:tls");
    } catch {
      throw new Error(
        "Direct socket TLS is not supported in this edge runtime. Please configure SMTP_RELAY_URL for Cloudflare Workers email delivery.",
      );
    }

    return new Promise((resolve, reject) => {
      // Gmail SSL/TLS default port is 465 (or port 587 if connecting via TLS socket)
      const port = this.config.port === 587 ? 465 : this.config.port;
      const host = this.config.host || "smtp.gmail.com";

      const socket = tls.connect(
        {
          host,
          port,
          rejectUnauthorized: true,
          timeout: 10000, // 10 second safety timeout
        },
        () => {
          // Connected
        },
      );

      let buffer = "";
      let step = 0;
      let generatedMessageId = `gmail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const cleanup = () => {
        socket.removeAllListeners();
        socket.destroy();
      };

      socket.setTimeout(10000, () => {
        cleanup();
        reject(new Error("SMTP socket connection timed out"));
      });

      socket.on("error", (err: Error) => {
        cleanup();
        reject(err);
      });

      socket.on("data", (data: Buffer | string) => {
        buffer += data.toString();
        const lines = buffer.split("\r\n");

        while (lines.length > 1) {
          const line = lines.shift()!;
          const code = parseInt(line.slice(0, 3), 10);
          const isMultiline = line.charAt(3) === "-";

          if (isMultiline) continue;

          // State Machine for SMTP protocol
          if (step === 0 && code === 220) {
            // Received greeting -> Send EHLO
            socket.write("EHLO localhost\r\n");
            step = 1;
          } else if (step === 1 && code === 250) {
            // EHLO acknowledged -> Send AUTH LOGIN
            socket.write("AUTH LOGIN\r\n");
            step = 2;
          } else if (step === 2 && code === 334) {
            // Username prompt -> Send base64 username
            socket.write(Buffer.from(this.config.user).toString("base64") + "\r\n");
            step = 3;
          } else if (step === 3 && code === 334) {
            // Password prompt -> Send base64 app password
            socket.write(Buffer.from(this.config.password).toString("base64") + "\r\n");
            step = 4;
          } else if (step === 4 && code === 235) {
            // Authentication succeeded -> Send MAIL FROM
            socket.write(`MAIL FROM:<${from}>\r\n`);
            step = 5;
          } else if (step === 5 && code === 250) {
            // Sender accepted -> Send RCPT TO
            socket.write(`RCPT TO:<${to}>\r\n`);
            step = 6;
          } else if (step === 6 && code === 250) {
            // Recipient accepted -> Send DATA
            socket.write("DATA\r\n");
            step = 7;
          } else if (step === 7 && code === 354) {
            // Ready for content -> Send MIME message ended by \r\n.\r\n
            socket.write(rawMime + "\r\n.\r\n");
            step = 8;
          } else if (step === 8 && code === 250) {
            // Message accepted for delivery -> Send QUIT
            socket.write("QUIT\r\n");
            step = 9;
            cleanup();
            resolve(generatedMessageId);
            return;
          } else if (code >= 400) {
            // SMTP error response
            cleanup();
            reject(new Error(`SMTP command failed with code ${code}: ${line.slice(4)}`));
            return;
          }
        }
      });
    });
  }
}
