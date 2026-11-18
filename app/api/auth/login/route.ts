import { generateCodeVerifier, generateState } from "arctic";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE, SCOPES, entraClient, isMicrosoftConfigured } from "@/lib/auth";
import { DEMO_SESSION, isDemoMode } from "@/lib/demo";
import { createSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  if (isDemoMode()) {
    await createSession(DEMO_SESSION);
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (!isMicrosoftConfigured()) {
    return NextResponse.redirect(new URL("/?error=not_configured", req.url));
  }
  const state = generateState();
  const verifier = generateCodeVerifier();
  const url = entraClient(req.url).createAuthorizationURL(state, verifier, SCOPES);
  // Lets family members sharing a device pick their own account.
  url.searchParams.set("prompt", "select_account");

  const store = await cookies();
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 10,
  };
  store.set(OAUTH_STATE_COOKIE, state, options);
  store.set(OAUTH_VERIFIER_COOKIE, verifier, options);
  return NextResponse.redirect(url);
}
