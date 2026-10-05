export const sendEmailConfirmation = async (email: string, redirectTo = "") => {
  const supabaseUrl = Deno.env.get("TRABAWHO_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("TRABAWHO_SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!supabaseUrl || !anonKey) {
    return { sent: false, provider: "supabase_auth", error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY" };
  }

  try {
    const endpoint = new URL("/auth/v1/resend", supabaseUrl);
    if (redirectTo) endpoint.searchParams.set("redirect_to", redirectTo);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "signup",
        email: email.trim().toLowerCase(),
      }),
    });

    if (response.ok) return { sent: true, provider: "supabase_auth" };
    console.error("identity_confirmation_request_rejected", { status: response.status });
    return { sent: false, provider: "supabase_auth", error: "Supabase Auth rejected the confirmation request." };
  } catch (error) {
    console.error("identity_confirmation_request_failed", { type: error instanceof Error ? error.name : "unknown" });
    return { sent: false, provider: "supabase_auth", error: "The confirmation request could not reach Supabase Auth." };
  }
};
