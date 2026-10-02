export function identityReturnUrl(value: unknown, appUrl: string, extraOrigins = ""): URL {
  const app = new URL(appUrl || "http://localhost:3000");
  const url = new URL(typeof value === "string" && value ? value : `${app.origin}/?check_verification=true#login`);
  const origins = [app.origin, ...extraOrigins.split(",").map((entry) => entry.trim()).filter(Boolean)];
  const local = ["localhost", "127.0.0.1"].includes(url.hostname) && url.protocol === "http:";
  if ((!local && (!origins.includes(url.origin) || url.protocol !== "https:")) || url.username || url.password)
    throw new Error("Use the configured application return URL.");
  url.searchParams.set("check_verification", "true");
  return url;
}
