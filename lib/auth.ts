import { MicrosoftEntraId } from "arctic";

export const SCOPES = ["openid", "profile", "email", "offline_access", "User.Read", "Tasks.ReadWrite"];

export const OAUTH_STATE_COOKIE = "sl_oauth_state";
export const OAUTH_VERIFIER_COOKIE = "sl_oauth_verifier";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name} (see .env.example)`);
  return value;
}

/** The public base URL: APP_URL if set, otherwise the origin the request came in on. */
export function appBaseUrl(requestUrl?: string): string {
  const fromEnv = process.env.APP_URL?.replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  if (requestUrl) return new URL(requestUrl).origin;
  return "http://localhost:3000";
}

export function entraClient(requestUrl?: string): MicrosoftEntraId {
  return new MicrosoftEntraId(
    process.env.MS_TENANT || "common",
    requireEnv("MS_CLIENT_ID"),
    requireEnv("MS_CLIENT_SECRET"),
    `${appBaseUrl(requestUrl)}/api/auth/callback`,
  );
}

export function isMicrosoftConfigured(): boolean {
  return Boolean(process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET);
}

/** ALLOWED_EMAILS="a@x.com, b@y.com". When unset, any Microsoft account may sign in. */
export function isEmailAllowed(email: string): boolean {
  const list = (process.env.ALLOWED_EMAILS ?? "")
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return true;
  return list.includes(email.trim().toLowerCase());
}
