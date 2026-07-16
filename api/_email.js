// Transactional emails (Resend) + the branded templates.
// Underscore-prefixed so Vercel treats this as a shared module, not an endpoint.
// Quietly does nothing until RESEND_API_KEY is set and the domain is verified.

const FROM = "The Good Hours <hello@thegoodhours.co>";
const SITE = "https://www.thegoodhours.co";

const P = 'style="font-family:\'Nunito\',Arial,sans-serif;font-size:15px;font-weight:600;line-height:1.65;color:#4a4666;margin:0 0 14px;"';
const H = 'style="font-family:\'Baloo 2\',\'Trebuchet MS\',Arial,sans-serif;font-size:23px;font-weight:800;color:#2E294E;margin:0 0 14px;"';
const LI = 'style="font-family:\'Nunito\',Arial,sans-serif;font-size:15px;font-weight:600;line-height:1.6;color:#4a4666;margin:0 0 8px;"';

function button(label, href) {
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;"><tr><td align="center" style="border-radius:16px;background-color:#FF5D8F;">
    <a href="${href}" target="_blank" style="display:inline-block;padding:15px 36px;font-family:'Nunito',Arial,sans-serif;font-size:16px;font-weight:800;color:#ffffff;text-decoration:none;">${label}</a>
  </td></tr></table>`;
}

function shell(preview, inner) {
  return `<!doctype html><html><body style="margin:0;background-color:#FFF9EC;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preview}</div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFF9EC;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
        <tr><td align="center" style="padding-bottom:20px;">
          <div style="font-size:44px;line-height:1;">&#9728;&#65039;</div>
          <div style="font-family:'Baloo 2','Trebuchet MS',Arial,sans-serif;font-size:25px;font-weight:800;color:#2E294E;padding-top:8px;">
            the <span style="background-color:#FF5D8F;color:#ffffff;padding:1px 8px;border-radius:8px;">good</span> hours
          </div>
        </td></tr>
        <tr><td style="background-color:#FFFFFF;border-radius:24px;padding:34px 32px;">${inner}</td></tr>
        <tr><td align="center" style="padding-top:20px;font-family:'Nunito',Arial,sans-serif;font-size:11px;font-weight:600;color:#8E89A8;line-height:1.7;">
          Sent with &#128155; by The Good Hours &middot; <a href="${SITE}" style="color:#FF5D8F;text-decoration:none;font-weight:800;">thegoodhours.co</a>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

// EMAIL 1 — free signup (copy by Ashley)
export function welcomeEmail() {
  return {
    subject: "Your first day plan is ready to build ☀️",
    preview: "Kids' ages, hours to fill, your neighborhood. That's it.",
    html: shell(
      "Kids' ages, hours to fill, your neighborhood. That's it.",
      `<p ${H}>Hello from The Good Hours!</p>
       <p ${P}>We're so excited to plan your kid-time 30 seconds at a time.</p>
       <p ${P}>Here's the whole idea: you tell us your kids' ages, the hours you need to fill, and where you are. You get a real day &mdash; actual libraries, parks, story times, and whatever's happening nearby today. Even the coffee stop for you.</p>
       ${button("Build my day &rarr;", SITE)}
       <p ${P}>Your first plan is on us. No card, no catch.</p>
       <p ${P}>One tip: try it for tomorrow morning. Wake up with the day already decided &mdash; that's when it clicks.</p>
       <p ${P}>&mdash; The Good Hours Team</p>
       <p style="font-family:'Nunito',Arial,sans-serif;font-size:13px;font-weight:600;line-height:1.6;color:#8E89A8;margin:18px 0 0;">P.S. It works anywhere. Visiting family this summer? Type in their town.</p>`
    ),
  };
}

// EMAIL 2 — paid membership (draft, pending Ashley's approval)
export function paymentEmail() {
  return {
    subject: "You're in — unlimited good hours ☀️",
    preview: "Your membership is live. Go fill a day.",
    html: shell(
      "Your membership is live. Go fill a day.",
      `<p ${H}>You're in &#128155;</p>
       <p ${P}>Your membership is live &mdash; and genuinely, thank you. Memberships are what keep this place free of ads and out of the data-selling business.</p>
       <p ${P}><strong style="color:#2E294E;">What just unlocked:</strong></p>
       <p ${LI}>&#10003; Unlimited day plans &mdash; any kids, any hours, any neighborhood</p>
       <p ${LI}>&#10003; Save the days that actually worked and reuse them</p>
       <p ${LI}>&#10003; Real local events happening the day you're planning for</p>
       ${button("Plan my day &rarr;", SITE)}
       <p ${P}>You can manage or cancel anytime at thegoodhours.co &mdash; two taps, no phone call, no guilt.</p>
       <p ${P}>&mdash; The Good Hours Team</p>
       <p style="font-family:'Nunito',Arial,sans-serif;font-size:13px;font-weight:600;line-height:1.6;color:#8E89A8;margin:18px 0 0;">P.S. Now throw the hard days at it. Rainy Tuesday? Long weekend with both kids? That's where it earns its keep.</p>`
    ),
  };
}

export async function sendEmail(to, { subject, preview, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    if (!r.ok) console.error("Resend error:", r.status, await r.text());
  } catch (e) {
    console.error("Resend error:", e);
  }
}
