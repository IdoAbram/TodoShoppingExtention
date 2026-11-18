import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { SCOPES, entraClient } from "./auth";
import { getKV } from "./redis";

export const SESSION_COOKIE = "sl_sid";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 90; // matches Microsoft's 90-day refresh token lifetime
const REFRESH_MARGIN_MS = 2 * 60 * 1000;

export type SessionData = {
  userId: string;
  name: string;
  email: string;
  accessToken: string;
  accessExpiresAt: number; // epoch ms
  refreshToken: string;
};

export type Session = SessionData & { sid: string };

export class NotSignedInError extends Error {
  constructor() {
    super("Not signed in");
  }
}

const sessionKey = (sid: string) => `sess:${sid}`;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export async function readSession(): Promise<Session | null> {
  const sid = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sid || !/^[a-f0-9]{64}$/.test(sid)) return null;
  const raw = await getKV().get(sessionKey(sid));
  if (!raw) return null;
  try {
    return { ...(JSON.parse(raw) as SessionData), sid };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const session = await readSession();
  if (!session) throw new NotSignedInError();
  return session;
}

/** Only callable from Route Handlers / Server Actions (sets a cookie). */
export async function createSession(data: SessionData): Promise<void> {
  const sid = randomBytes(32).toString("hex");
  await getKV().set(sessionKey(sid), JSON.stringify(data), SESSION_TTL_SECONDS);
  (await cookies()).set(SESSION_COOKIE, sid, cookieOptions());
}

async function saveSession(session: Session): Promise<void> {
  const { sid, ...data } = session;
  await getKV().set(sessionKey(sid), JSON.stringify(data), SESSION_TTL_SECONDS);
  try {
    // Slide the cookie expiry too (works in Route Handlers; ignored elsewhere).
    (await cookies()).set(SESSION_COOKIE, sid, cookieOptions());
  } catch {
    /* rendering a Server Component: cookies are read-only there */
  }
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const sid = store.get(SESSION_COOKIE)?.value;
  if (sid) await getKV().del(sessionKey(sid));
  store.delete(SESSION_COOKIE);
}

/**
 * Returns a valid Microsoft Graph access token, refreshing it when it is about
 * to expire (or when `force` is set after Graph answered 401).
 * Microsoft rotates refresh tokens, so the new one is stored every time.
 */
export async function getAccessToken(session: Session, force = false): Promise<string> {
  if (!force && session.accessExpiresAt - Date.now() > REFRESH_MARGIN_MS) {
    return session.accessToken;
  }
  const tokens = await entraClient().refreshAccessToken(session.refreshToken, SCOPES);
  session.accessToken = tokens.accessToken();
  session.accessExpiresAt = tokens.accessTokenExpiresAt().getTime();
  if (tokens.hasRefreshToken()) session.refreshToken = tokens.refreshToken();
  await saveSession(session);
  return session.accessToken;
}

// ------------------------------------------------------------ preferences --

export type UserPrefs = { listId: string; listName: string };

export async function getPrefs(userId: string): Promise<UserPrefs | null> {
  const raw = await getKV().get(`pref:${userId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserPrefs;
  } catch {
    return null;
  }
}

export async function setPrefs(userId: string, prefs: UserPrefs): Promise<void> {
  await getKV().set(`pref:${userId}`, JSON.stringify(prefs));
}
