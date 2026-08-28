// @ts-nocheck
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const redirectTo = url.searchParams.get("redirect_to");
  const params = new URLSearchParams(url.searchParams);
  params.delete("redirect_to");
  params.delete("apikey");

  if (redirectTo) {
    const target = decodeURIComponent(redirectTo);
    const suffix = params.toString();
    const [baseTarget, hashFragment] = target.split("#", 2);
    const separator = baseTarget.includes("?") ? "&" : "?";
    const nextTarget = suffix ? `${baseTarget}${separator}${suffix}` : baseTarget;

    return new Response(null, {
      status: 302,
      headers: {
        Location: hashFragment ? `${nextTarget}#${hashFragment}` : nextTarget,
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

