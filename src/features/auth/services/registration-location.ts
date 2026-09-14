import type { LocationOption } from "@/features/auth/types";

const PSGC_BASE_URL = "https://psgc.gitlab.io/api";

function isLocationOption(value: unknown): value is LocationOption {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.code === "string" && typeof candidate.name === "string";
}

async function fetchLocationOptions(path: string, errorMessage: string): Promise<LocationOption[]> {
  const response = await fetch(`${PSGC_BASE_URL}${path}`);
  if (!response.ok) throw new Error(errorMessage);

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error(errorMessage);

  return payload
    .filter(isLocationOption)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function fetchProvinces(): Promise<LocationOption[]> {
  return fetchLocationOptions("/provinces/", "Provinces could not be loaded.");
}

export function fetchCities(provinceCode: string): Promise<LocationOption[]> {
  return fetchLocationOptions(
    `/provinces/${encodeURIComponent(provinceCode)}/cities-municipalities/`,
    "Cities and municipalities could not be loaded.",
  );
}

export function fetchBarangays(cityCode: string): Promise<LocationOption[]> {
  return fetchLocationOptions(
    `/cities-municipalities/${encodeURIComponent(cityCode)}/barangays/`,
    "Barangays could not be loaded.",
  );
}
