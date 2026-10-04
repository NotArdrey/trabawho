import { useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SpecificAddressField } from './SpecificAddressField';

const { search, resolveAddress } = vi.hoisted(() => ({ search: vi.fn(), resolveAddress: vi.fn() }));
vi.mock('@/shared/services/googlePlaces', () => ({ createAddressSearch: () => Promise.resolve(search) }));

function AddressForm() {
  const [address, setAddress] = useState('');
  return <SpecificAddressField value={{ province: 'Bulacan', city: 'Guiguinto', barangay: 'Poblacion', address }}
    onChange={setAddress} disabled={false} prefix="test" />;
}

beforeEach(() => {
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
  search.mockReset();
  resolveAddress.mockReset();
  resolveAddress.mockResolvedValue('12 Service Street, Poblacion, Guiguinto, Bulacan, Philippines');
  search.mockResolvedValue([{ id: 'place-1', label: '12 Service Street, Guiguinto', resolve: resolveAddress }]);
});
afterEach(() => { vi.unstubAllEnvs(); });

it('scopes suggestions to the chosen area and selects them with the keyboard', async () => {
  const user = userEvent.setup();
  render(<AddressForm />);
  const input = screen.getByRole('combobox');
  await user.type(input, '12 Service');
  await screen.findByRole('option');
  expect(search).toHaveBeenCalledWith('12 Service, Poblacion, Guiguinto, Bulacan, Philippines');
  await user.keyboard('{ArrowDown}{Enter}');
  expect(resolveAddress).toHaveBeenCalledOnce();
  expect(input).toHaveValue('12 Service Street, Poblacion, Guiguinto, Bulacan, Philippines');
  expect(screen.getByRole('link')).toHaveAttribute('href', expect.stringContaining('12+Service+Street'));
});

it('dismisses suggestions with Escape while retaining the typed address', async () => {
  const user = userEvent.setup();
  render(<AddressForm />);
  await user.type(screen.getByRole('combobox'), '12 Service');
  await screen.findByRole('option');
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(screen.getByRole('combobox')).toHaveValue('12 Service');
});

it('preserves manual entry and the map link when Google suggestions fail', async () => {
  search.mockRejectedValue(new Error('Maps unavailable'));
  const user = userEvent.setup();
  render(<AddressForm />);
  await user.type(screen.getByRole('combobox'), '12 Service');
  expect(await screen.findByText(/suggestions are unavailable/)).toBeVisible();
  expect(screen.getByRole('combobox')).toHaveValue('12 Service');
  expect(screen.getByRole('link')).toBeVisible();
});

it('works without a Google key and does not request suggestions', async () => {
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '');
  const user = userEvent.setup();
  render(<AddressForm />);
  await user.type(screen.getByRole('combobox'), '12 Service');
  expect(search).not.toHaveBeenCalled();
  expect(screen.getByRole('link')).toHaveAttribute('href', expect.stringContaining('Poblacion%2C+Guiguinto%2C+Bulacan'));
});

it('ignores a selected address if its field was removed while details were loading', async () => {
  let complete: ((value: string) => void) | undefined;
  resolveAddress.mockImplementation(() => new Promise<string>((resolve) => { complete = resolve; }));
  const onChange = vi.fn();
  const user = userEvent.setup();
  const view = render(<SpecificAddressField value={{ province: 'Bulacan', city: 'Guiguinto', barangay: 'Poblacion', address: '12 Service' }}
    onChange={onChange} disabled={false} prefix="test" />);
  await user.click(screen.getByRole('combobox'));
  await user.click(await screen.findByRole('option'));
  view.unmount();
  await act(async () => { complete?.('Old address'); await Promise.resolve(); });
  expect(onChange).not.toHaveBeenCalled();
});
