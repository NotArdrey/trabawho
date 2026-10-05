import { expect, test } from '@playwright/test';
import { authEmailTemplates } from '../../supabase/functions/_shared/authEmailTemplates';
import { buildNotificationEmail, type EmailEvent } from '../../supabase/functions/_shared/emailNotifications';

const templates = authEmailTemplates();
const secureUrl = `https://example.supabase.co/auth/v1/verify?token=${'a'.repeat(64)}&type=signup&redirect_to=https%3A%2F%2Ftrabawho-kappa.vercel.app%2Fregister`;
const actionLabels: Record<string, string> = {
  confirmation: 'Confirm my email', recovery: 'Choose a new password', invite: 'Accept invitation',
  magic_link: 'Sign in to TrabaWho', email_change: 'Confirm email change',
};
const identity: EmailEvent = { id: 'preview', recipient_id: 'preview', kind: 'identity', attempts: 0,
  lease_token: '', payload: { status: 'PENDING_REVIEW', reference: 'internal-user-id' } };

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`emails show their purpose and action without overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const kind of ['confirmation', 'recovery', 'invite', 'magic_link', 'email_change', 'reauthentication', 'identity']) {
      const html = kind === 'identity' ? buildNotificationEmail(identity, 'https://trabawho-kappa.vercel.app').html
        : templates[`mailer_templates_${kind}_content`]
          .replaceAll('{{ .ConfirmationURL }}', secureUrl)
          .replaceAll('{{ .Token }}', '123456');
      await page.setContent(html);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      if (kind === 'identity') {
        await expect(page.getByRole('link', { name: 'Open TrabaWho', exact: true })).toHaveAttribute('href', 'https://trabawho-kappa.vercel.app/');
        await expect(page.getByRole('paragraph').filter({ hasText: /needs an administrator/ })).toBeVisible();
        await expect(page.getByText('internal-user-id')).toHaveCount(0);
      } else if (kind !== 'reauthentication') {
        const action = page.getByRole('link', { name: actionLabels[kind], exact: true });
        expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await expect(action).toHaveAttribute('href', secureUrl);
      }
      if (width === 390 || width === 1440) await page.screenshot({ path: test.info().outputPath(`${kind}-${width}.png`), fullPage: true });
    }
  });
}
