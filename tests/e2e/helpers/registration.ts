import { expect, type Page } from '@playwright/test';

export const serviceLocation = { province: 'Bulacan', city: 'Guiguinto', barangay: 'Poblacion', address: 'Figueroa Street 352' };
export const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

export async function mockRegistrationLocations(page: Page) {
  await page.route('https://psgc.gitlab.io/api/**', route => route.fulfill({ json:
    route.request().url().endsWith('/provinces/') ? [{ code: '030140000', name: serviceLocation.province }]
      : route.request().url().endsWith('/cities-municipalities/') ? [{ code: '030140900', name: serviceLocation.city }]
        : [{ code: '030140901', name: serviceLocation.barangay }],
  }));
}

export async function selectRegistrationOption(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

export async function fillRegistration(page: Page, document = 'National ID / ID card', email = 'person@example.com') {
  await selectRegistrationOption(page, 'Identity document', document);
  await page.getByRole('button', { name: 'Go to next page' }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Password123!');
  await page.getByLabel('Confirm Password', { exact: true }).fill('Password123!');
  await page.getByRole('button', { name: 'Go to next page' }).click();
  await selectRegistrationOption(page, 'Province', serviceLocation.province);
  await selectRegistrationOption(page, 'City/Municipality', serviceLocation.city);
  await selectRegistrationOption(page, 'Barangay', serviceLocation.barangay);
  await page.getByLabel('Specific Address').fill(serviceLocation.address);
  await page.getByRole('button', { name: 'Go to next page' }).click();
  await page.getByRole('checkbox', { name: /I consent to identity verification/ }).check();
  await page.getByRole('checkbox', { name: 'I agree to the Terms and Conditions', exact: true }).check();
}

export async function fillManualEvidence(page: Page) {
  await page.getByLabel('Name on ID', { exact: true }).fill('Manual User');
  await page.getByLabel('ID number', { exact: true }).fill('POSTAL-1234567');
  await page.getByLabel('ID expiry date').fill('2099-12-31');
  for (const part of ['front', 'back', 'selfie']) {
    await page.locator(`#manual-${part}-image`).setInputFiles({ name: `${part}-1530d0be-8d55-41ac-8134-d4099e503249.png`, mimeType: 'image/png', buffer: Buffer.from('image') });
  }
}

export async function expectNoRegistrationOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}
