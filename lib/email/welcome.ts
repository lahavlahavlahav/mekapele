import "server-only";

/**
 * Thank-you email for a new Mekapele subscriber - the exact version the
 * owner approved on 2026-11-18 (RTL, black logo). Sent once per buyer, on
 * their first payment, from hi@liloubooks.com (see sendWelcomeEmail).
 */
export const WELCOME_SUBJECT = "תודה שהצטרפת למקפלא!";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * First name only ("מיכל מוניץ" -> "מיכל"); no name -> just "היי,".
 * The sign-off shares a paragraph with the text above it, and a hidden
 * per-send token ends the body, so Gmail doesn't fold the ending away
 * behind "..." as repeated signature-like content.
 */
export function welcomeHtml(fullName?: string): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0] ?? "";
  const greeting = first ? `היי ${escapeHtml(first)},` : "היי,";
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body dir="rtl" style="margin:0;padding:0;direction:rtl;text-align:right">
<table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" border="0" style="direction:rtl">
<tr><td align="center" style="padding:16px">
<table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;direction:rtl">
<tr><td dir="rtl" align="right" style="direction:rtl;text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.7;color:#1d2433">
  <p dir="rtl" style="direction:rtl;text-align:right;margin:16px 0"><img src="https://www.mekapele.com/assets/mekapele-logo.png" alt="מקפלא" style="height:48px"></p>
  <p dir="rtl" style="direction:rtl;text-align:right">${greeting}</p>
  <p dir="rtl" style="direction:rtl;text-align:right"><strong>תודה רבה שרכשת מנוי למקפלא!</strong><br>המנוי שלך פעיל, ואפשר להתחיל ליצור תבניות ללא הגבלה:</p>
  <p dir="rtl" style="direction:rtl;text-align:right"><a href="https://www.mekapele.com" style="display:inline-block;background:#b00020;color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:10px;font-weight:bold">לסטודיו של מקפלא</a></p>
  <p dir="rtl" style="direction:rtl;text-align:right">כל ההסברים ותשובות לשאלות נפוצות נמצאים כאן:<br><a href="https://www.mekapele.com/faq" style="color:#7a0016">www.mekapele.com/faq</a></p>
  <p dir="rtl" style="direction:rtl;text-align:right">ואם משהו לא ברור, אני זמינה לשאלות במייל הזה. פשוט עונים לי כאן.<br><br>תודה על התמיכה באומנות ישראלית, ויצירה מהנה!<br>להב</p>
  <p dir="rtl" style="direction:rtl;text-align:right;font-size:12px;color:#888;margin-top:24px">המנוי מתחדש כל חודש. אפשר לבטל מתי שרוצים: <a href="https://www.mekapele.com/cancel" style="color:#888">www.mekapele.com/cancel</a></p>
  <span style="display:none;font-size:0;line-height:0;max-height:0;overflow:hidden">${Date.now().toString(36)}</span>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;
}

/**
 * Hands the email to Make, which sends it from hi@liloubooks.com. The free
 * Make plan has no room for another scenario, so it reuses the "Integration
 * Webhooks, Grow" scenario (6745059, hook = MAKE_CHECKOUT_WEBHOOK_URL): a
 * router sends payloads that carry `subject` to the Outlook module, and
 * everything else to the old Grow payment-link flow. WELCOME_EMAIL_HOOK_URL
 * overrides it. Never throws - a failed email must not fail the payment.
 */
export async function sendWelcomeEmail(to: string, fullName?: string): Promise<string> {
  const hook = process.env.WELCOME_EMAIL_HOOK_URL || process.env.MAKE_CHECKOUT_WEBHOOK_URL;
  if (!hook) return "מייל תודה: אין כתובת Make";
  try {
    const res = await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject: WELCOME_SUBJECT, html: welcomeHtml(fullName) }),
    });
    return res.ok ? `מייל תודה נשלח ל-${to}` : `מייל תודה נכשל (${res.status})`;
  } catch (e) {
    return `מייל תודה נכשל: ${e instanceof Error ? e.message : String(e)}`;
  }
}
