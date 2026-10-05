export interface EmailLayout {
  eyebrow: string;
  title: string;
  intro: string;
  paragraphs?: string[];
  details?: Array<{ label: string; value: string }>;
  action?: { label: string; url: string };
  code?: string;
  footnote: string;
  fallbackLink?: boolean;
}

export const escapeEmailHtml = (value: string): string => value.replace(/[&<>"']/g, (character) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);

// Email clients require presentation tables and inline styles rather than app CSS.
export function renderEmailLayout(email: EmailLayout): string {
  const escape = escapeEmailHtml;
  const paragraphs = (email.paragraphs || []).map((line) =>
    `<p style="margin:0 0 20px;font-size:16px;line-height:26px;color:#475569;">${escape(line)}</p>`).join('');
  const details = email.details?.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 28px;border:1px solid #dce3ee;border-radius:8px;background-color:#f8fafc;">${email.details.map((item) =>
    `<tr><td style="padding:12px 16px;font-size:13px;line-height:20px;color:#526277;vertical-align:top;">${escape(item.label)}</td><td style="padding:12px 16px;font-size:14px;line-height:20px;font-weight:600;text-align:right;color:#0f172a;word-break:break-word;">${escape(item.value)}</td></tr>`).join('')}</table>` : '';
  const action = email.action ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 24px;"><tr><td bgcolor="#1557c0" style="border-radius:8px;background-color:#1557c0;text-align:center;"><a href="${escape(email.action.url)}" style="display:inline-block;padding:14px 24px;border:1px solid #1557c0;border-radius:8px;font-size:16px;line-height:22px;font-weight:700;text-decoration:none;color:#ffffff;">${escape(email.action.label)}</a></td></tr></table>` : '';
  const fallback = email.fallbackLink && email.action ? `<p style="margin:0 0 24px;font-size:12px;line-height:20px;color:#526277;">Button not opening? Copy this link into your browser:<br><a href="${escape(email.action.url)}" style="color:#1557c0;text-decoration:underline;word-break:break-all;">${escape(email.action.url)}</a></p>` : '';
  const code = email.code ? `<p style="margin:0 0 28px;padding:20px;border:1px solid #dce3ee;border-radius:8px;background-color:#f8fafc;font-family:Consolas,monospace;font-size:32px;line-height:44px;letter-spacing:6px;font-weight:700;text-align:center;color:#0f172a;">${escape(email.code)}</p>` : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escape(email.title)} | TrabaWho</title></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
<div aria-hidden="true" style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escape(email.intro)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f1f5f9"><tr><td align="center" style="padding:32px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="padding:0 12px 24px;"><span style="font-size:28px;line-height:36px;font-weight:800;letter-spacing:-1px;color:#1557c0;">Traba<span style="color:#b45309;">Who</span></span><p style="margin:4px 0 0;font-size:13px;line-height:20px;color:#526277;">Your local services marketplace.</p></td></tr>
<tr><td bgcolor="#ffffff" style="padding:32px 24px;border:1px solid #dce3ee;border-radius:12px;background-color:#ffffff;">
<p style="margin:0 0 16px;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1.5px;color:#1557c0;text-transform:uppercase;">${escape(email.eyebrow)}</p>
<h1 style="margin:0 0 16px;font-size:30px;line-height:38px;font-weight:700;letter-spacing:-0.6px;color:#0f172a;">${escape(email.title)}</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:26px;color:#475569;">${escape(email.intro)}</p>
${paragraphs}${details}${code}${action}${fallback}
<p style="margin:0;padding-top:20px;border-top:1px solid #dce3ee;font-size:13px;line-height:21px;color:#526277;">${escape(email.footnote)}</p>
</td></tr><tr><td style="padding:24px 12px 0;font-size:12px;line-height:20px;color:#526277;">Sent by TrabaWho<br>Questions about your account? Reply to this email for help.</td></tr>
</table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}
