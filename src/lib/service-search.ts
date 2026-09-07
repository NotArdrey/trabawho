export interface ServiceSearchParams {
  query?: string;
  location?: string;
}

const clean = (value: string | null | undefined) => value?.trim() || undefined;

export function parseServiceSearchParams(
  input: URLSearchParams | string,
): ServiceSearchParams {
  const params = typeof input === "string" ? new URLSearchParams(input) : input;

  return {
    query: clean(params.get("q")),
    location: clean(params.get("location")),
  };
}

export function createServiceSearchParams({
  query,
  location,
}: ServiceSearchParams): URLSearchParams {
  const params = new URLSearchParams();
  const cleanedQuery = clean(query);
  const cleanedLocation = clean(location);

  if (cleanedQuery) params.set("q", cleanedQuery);
  if (cleanedLocation) params.set("location", cleanedLocation);

  return params;
}

export function buildServicesUrl(search: ServiceSearchParams = {}): string {
  const queryString = createServiceSearchParams(search).toString();
  return queryString ? `/services?${queryString}` : "/services";
}
