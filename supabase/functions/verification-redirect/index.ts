import { identityReturnUrl } from "../_shared/identityRedirect.ts";
Deno.serve((req: Request) => {
  try {
    const url = new URL(req.url);
    const target = identityReturnUrl(url.searchParams.get("redirect_to"), Deno.env.get("TRABAWHO_APP_URL") || "", Deno.env.get("IDENTITY_ALLOWED_ORIGINS") || "");
    // Provider query parameters are informational. Signup always checks its
    // nonce-bound session on the server; the return status cannot approve it.
    for (const key of ["verificationSessionId", "status"]) {
      const value = url.searchParams.get(key);
      if (value) target.searchParams.set(key, value);
    }
    return new Response(null, { status: 302, headers: { Location: target.toString(), "Cache-Control": "no-store" } });
  } catch {
    return new Response("The application return URL is not allowed.", { status: 400 });
  }
});
