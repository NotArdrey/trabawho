import { renderEmailLayout, type EmailLayout } from './emailLayout.ts';

const confirmationUrl = '{{ .ConfirmationURL }}';
const securityNote = 'This link is personal to your account. Do not forward it. If you did not request this email, you can ignore it.';
const authContent: Record<string, EmailLayout> = {
  confirmation: {
    eyebrow: 'Finish your registration', title: 'Confirm your email',
    intro: 'One last step: confirm this email address to finish setting up your TrabaWho account.',
    action: { label: 'Confirm my email', url: confirmationUrl }, fallbackLink: true,
    footnote: securityNote,
  },
  recovery: {
    eyebrow: 'Account recovery', title: 'Reset your password',
    intro: 'A password reset was requested for your TrabaWho account. Use the secure link below to choose a new password.',
    action: { label: 'Choose a new password', url: confirmationUrl }, fallbackLink: true,
    footnote: 'If you did not request a password reset, ignore this email. Your password will stay the same. Do not share this link.',
  },
  invite: {
    eyebrow: 'You are invited', title: 'Welcome to TrabaWho',
    intro: 'You have been invited to join TrabaWho. Open your invitation to set up your account.',
    action: { label: 'Accept invitation', url: confirmationUrl }, fallbackLink: true,
    footnote: securityNote,
  },
  magic_link: {
    eyebrow: 'Secure account access', title: 'Your sign-in link',
    intro: 'Use this secure link to sign in to your TrabaWho account. It can be used once.',
    action: { label: 'Sign in to TrabaWho', url: confirmationUrl }, fallbackLink: true,
    footnote: securityNote,
  },
  email_change: {
    eyebrow: 'Account security', title: 'Confirm your email change',
    intro: 'Confirm the requested email change for your TrabaWho account using the secure link below.',
    action: { label: 'Confirm email change', url: confirmationUrl }, fallbackLink: true,
    footnote: 'If you did not request this change, do not use the link. Reply to this email for help securing your account.',
  },
  reauthentication: {
    eyebrow: 'Account security', title: 'Your verification code',
    intro: 'Enter this code in TrabaWho to confirm the account action you requested.',
    code: '{{ .Token }}',
    footnote: 'Keep this code private. TrabaWho will never ask you to send it by email or chat. If you did not request a code, ignore this email.',
  },
};

export function authEmailTemplates(): Record<string, string> {
  return Object.fromEntries(Object.entries(authContent).flatMap(([kind, layout]) => [
    [`mailer_subjects_${kind}`, `TrabaWho: ${layout.title}`],
    [`mailer_templates_${kind}_content`, renderEmailLayout(layout)],
  ]));
}
