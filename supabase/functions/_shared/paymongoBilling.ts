type Profile = { full_name?: unknown; email?: unknown; phone_number?: unknown;
  address?: unknown; barangay?: unknown; city?: unknown; province?: unknown } | null;

const detail = (value: unknown, limit: number) => typeof value === "string" ? value.trim().slice(0, limit) : "";

/** Prefill only details already recorded for the authenticated payer. */
export function paymongoBilling(profile: Profile) {
  if (!profile) return undefined;
  const name = detail(profile.full_name, 120);
  const email = detail(profile.email, 255);
  const phone = detail(profile.phone_number, 30);
  const line1 = detail(profile.address, 255);
  const line2 = detail(profile.barangay, 255);
  const city = detail(profile.city, 120);
  const state = detail(profile.province, 120);
  const address = { country: "PH", ...(line1 ? { line1 } : {}), ...(line2 ? { line2 } : {}),
    ...(city ? { city } : {}), ...(state ? { state } : {}) };
  const billing = {
    ...(name ? { name } : {}),
    ...(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(line1 || line2 || city || state ? { address } : {}),
  };
  return Object.keys(billing).length ? billing : undefined;
}
