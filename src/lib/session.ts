import { createHmac } from "node:crypto";

export const SESSION_COOKIE = "ad_app_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

function getSessionSecret() {
  return process.env.AUTH_SECRET ?? "dev-only-change-me-ad-app-secret";
}

function signPayload(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

export function createSessionToken(user: AuthUser) {
  const payload = Buffer.from(
    JSON.stringify({ id: user.id, email: user.email, name: user.name, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }),
  ).toString("base64url");

  return `${payload}.${signPayload(payload)}`;
}

export function verifySessionToken(token?: string): AuthUser | null {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature || signPayload(payload) !== signature) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AuthUser & { exp: number };

    if (!session.id || !session.email || session.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return { id: session.id, email: session.email, name: session.name };
  } catch {
    return null;
  }
}
