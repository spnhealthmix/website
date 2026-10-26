import { getEmailProvider } from "../src/lib/email/provider";

async function main() {
  const recipient = process.argv[2] || process.env.SMTP_USER || "spnhealthmix@gmail.com";
  console.log(`\n📧 Testing SMTP email dispatch to: ${recipient}...`);

  const provider = getEmailProvider();
  console.log(`Using provider: ${provider.id}`);

  if (provider.id === "console") {
    console.warn("⚠️ Warning: EMAIL_ENABLED=true and SMTP_USER/SMTP_PASSWORD are required in .env.");
  }

  const result = await provider.send({
    to: { email: recipient, name: "SPN Foods Admin" },
    subject: "SPN Foods - SMTP Verification Test",
    text: "Hello! This is a verification test to confirm your Gmail SMTP credentials are functioning properly.",
    html: `
      <div style="font-family: sans-serif; padding: 24px; border: 1px solid #e0e0e0; border-radius: 8px; max-width: 540px; margin: 0 auto;">
        <h2 style="color: #BF5330; margin-top: 0;">SPN Foods — SMTP Test Successful 🎉</h2>
        <p>Hello,</p>
        <p>Your Gmail SMTP transactional email service is now <strong>active and working</strong>!</p>
        <div style="background: #FAF7F2; padding: 12px 16px; border-radius: 6px; font-size: 14px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Provider:</strong> ${provider.id}</p>
          <p style="margin: 4px 0;"><strong>Sent To:</strong> ${recipient}</p>
          <p style="margin: 4px 0;"><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
        </div>
        <p style="color: #635850; font-size: 13px;">This test confirms that your store can now reliably send order confirmations, password reset emails, and shipment tracking updates.</p>
      </div>
    `,
  });

  if (result.success) {
    console.log(`\n🎉 SUCCESS! Test email was accepted by Google SMTP.`);
    console.log(`Message ID: ${result.messageId}`);
    console.log(`👉 Please check your inbox (and Spam/Updates folder) at: ${recipient}\n`);
  } else {
    console.error(`\n❌ FAILED to send email.`);
    console.error(`Reason: ${result.error}\n`);
  }
}

main().catch((err) => {
  console.error("Execution error:", err);
});
