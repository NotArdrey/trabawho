const { test, expect } = require('@playwright/test');

test('admin child routes redirect signed-out visitors to sign in', async ({ page }) => {
  await page.goto('/admin/jobs');

  await expect(page).toHaveURL(/\/sign-in\?/);
  const redirectedUrl = new URL(page.url());
  expect(redirectedUrl.searchParams.get('returnTo')).toBe('/admin/jobs');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});
