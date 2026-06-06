import { Resend } from "resend";

function codeEmailHtml(code: string): string {
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 420px; margin: 0 auto; padding: 24px;">
    <h2 style="margin:0 0 4px; color:#0a0a0a;">Bolão da Copa 2026</h2>
    <p style="color:#555; margin:0 0 20px;">Here is your login code. It expires in 10 minutes.</p>
    <div style="font-size:34px; font-weight:700; letter-spacing:10px; text-align:center;
                padding:18px; background:#0a0a0a; color:#39ff88; border-radius:12px;">
      ${code}
    </div>
    <p style="color:#888; font-size:12px; margin-top:20px;">
      If you did not request this, you can ignore this email.
    </p>
  </div>`;
}

// Sends the one-time login code. With no RESEND_API_KEY, logs it to the console
// (dev convenience). In production a missing key is an error.
export async function sendLoginCode(email: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Bolao da Copa <onboarding@resend.dev>";

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is required in production.");
    }
    console.log(`\n🔐 [DEV] Login code for ${email}: ${code}\n`);
    return;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: `Your Bolão login code: ${code}`,
    html: codeEmailHtml(code),
  });
  if (error) throw new Error(`Failed to send login email: ${error.message}`);
}
