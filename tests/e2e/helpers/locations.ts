import type { Page } from '@playwright/test';

export async function mockLocationOptions(page: Page) {
  await page.route('https://psgc.gitlab.io/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const data: Record<string, { code: string; name: string }[]> = {
      '/api/provinces/': [{ code: '031400000', name: 'Bulacan' }, { code: '033500000', name: 'Nueva Ecija' }],
      '/api/provinces/031400000/cities-municipalities/': [{ code: '031406000', name: 'Guiguinto' }, { code: '031410000', name: 'City of Malolos' }],
      '/api/cities-municipalities/031406000/barangays/': [{ code: '031406014', name: 'Poblacion' }],
      '/api/provinces/033500000/cities-municipalities/': [{ code: '033501000', name: 'Aliaga' }],
      '/api/cities-municipalities/031410000/barangays/': [{ code: '031410010', name: 'Bulihan' }],
      '/api/regions/130000000/cities-municipalities/': [{ code: '137404000', name: 'Quezon City' }],
      '/api/cities-municipalities/137404000/barangays/': [{ code: '137404001', name: 'Alicia' }],
    };
    return route.fulfill({ json: data[path] ?? [] });
  });
}

export async function chooseLocation(page: Page, label: string, name: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name, exact: true }).click();
}

export async function chooseBookingArea(page: Page) {
  await chooseLocation(page, 'Province', 'Bulacan');
  await chooseLocation(page, 'City/Municipality', 'Guiguinto');
  await chooseLocation(page, 'Barangay', 'Poblacion');
}
