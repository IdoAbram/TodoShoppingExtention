import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE, entraClient, isEmailAllowed } from "@/lib/auth";
import { TodoClient } from "@/lib/graph";
import { createSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const store = await cookies();
  const expectedState = store.get(OAUTH_STATE_COOKIE)?.value;
  const verifier = store.get(OAUTH_VERIFIER_COOKIE)?.value;
  store.delete(OAUTH_STATE_COOKIE);
  store.delete(OAUTH_VERIFIER_COOKIE);

  const fail = (reason: string) => NextResponse.redirect(new URL(`/?error=${reason}`, req.url));

  if (params.get("error")) {
    console.warn("[auth] Microsoft returned an error:", params.get("error"), params.get("error_description"));
    return fail(params.get("error") === "access_denied" ? "denied" : "oauth");
  }
  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state || !expectedState || !verifier || state !== expectedState) {
    return fail("state");
  }

  try {
    const tokens = await entraClient(req.url).validateAuthorizationCode(code, verifier);
    const me = await new TodoClient(async () => tokens.accessToken()).me();
    const email = (me.mail || me.userPrincipalName || "").toLowerCase();
    if (!isEmailAllowed(email)) {
      console.warn("[auth] sign-in rejected for", email);
      return fail("not_allowed");
    }
    if (!tokens.hasRefreshToken()) {
      console.warn("[auth] no refresh token returned — is offline_access granted?");
    }
    await createSession({
      userId: me.id,
      name: me.displayName || email,
      email,
      accessToken: tokens.accessToken(),
      accessExpiresAt: tokens.accessTokenExpiresAt().getTime(),
      refreshToken: tokens.hasRefreshToken() ? tokens.refreshToken() : "",
    });
  } catch (err) {
    console.error("[auth] callback failed:", err);
    return fail("oauth");
  }
  return NextResponse.redirect(new URL("/", req.url));
}
