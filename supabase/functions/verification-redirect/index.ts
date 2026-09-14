// @ts-nocheck
const getTrustedRedirect = (candidate: string | null) => {
  const configuredAppUrl = Deno.env.get("TRABAWHO_APP_URL") || Deno.env.get("SITE_URL") || "";
  if (!candidate || !configuredAppUrl) return null;

  try {
    const allowedOrigin = new URL(configuredAppUrl).origin;
    const requestedUrl = new URL(candidate);
    return requestedUrl.origin === allowedOrigin ? requestedUrl : null;
  } catch {
    return null;
  }
};

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const redirectTo = getTrustedRedirect(url.searchParams.get("redirect_to"));
  const params = new URLSearchParams(url.searchParams);
  params.delete("redirect_to");
  params.delete("apikey");

  if (redirectTo) {
    params.forEach((value, key) => redirectTo.searchParams.set(key, value));

    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectTo.toString(),
      },
    });
  }

  return new Response(
    "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Verification Complete</title></head><body><main style=\"font-family:system-ui,sans-serif;max-width:640px;margin:12vh auto;padding:24px;\"><h1>Verification complete</h1><p>You can return to TrabaWho and log in.</p></main></body></html>",
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
});

