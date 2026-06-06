import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { db, ensureUsersTable } from "./db";
import { createSessionToken, hashSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS, verifySessionToken } from "./session";
import type { AuthUser } from "./session";

type StoredUser = {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  password_hash: string;
};

type SessionRequestMeta = {
  userAgent?: string;
  ipAddress?: string;
};

export type AuthResult = { ok: true } | { ok: false; error: string };

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");

  if (!salt || !hash) {
    return false;
  }

  const actual = Buffer.from(hashPassword(password, salt).split(":")[1], "hex");
  const expected = Buffer.from(hash, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = verifySessionToken(token);

  if (!token || !user) {
    return null;
  }

  await ensureUsersTable();

  const activeSession = await db.query<{ user_id: string }>(
    `
      UPDATE user_sessions
      SET last_seen_at = NOW()
      WHERE session_token_hash = $1
        AND user_id = $2
        AND logged_out_at IS NULL
        AND expires_at > NOW()
      RETURNING user_id
    `,
    [hashSessionToken(token), user.id],
  );

  if (activeSession.rows[0]) {
    return user;
  }

  return (await claimLegacySession(user, token)) ? user : null;
}

export async function registerUser(formData: FormData): Promise<AuthResult> {
  "use server";

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name || !email || password.length < 8) {
    return { ok: false, error: "Vui lòng nhập tên, email và mật khẩu tối thiểu 8 ký tự." };
  }

  try {
    const result = await db.query<StoredUser>(
      `
        INSERT INTO users (id, email, name, role, password_hash)
        VALUES ($1, $2, $3, 'user', $4)
        RETURNING id, email, name, role, password_hash
      `,
      [randomBytes(16).toString("hex"), email, name, hashPassword(password)],
    );

    await setSessionCookie(toAuthUser(result.rows[0]));
    return { ok: true };
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return { ok: false, error: "Email này đã được đăng ký." };
    }

    throw error;
  }
}

export async function loginUser(formData: FormData): Promise<AuthResult> {
  "use server";

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const result = await db.query<StoredUser>(
    "SELECT id, email, name, role, password_hash FROM users WHERE email = $1 LIMIT 1",
    [email],
  );
  const user = result.rows[0];

  if (!user || !verifyPassword(password, user.password_hash)) {
    return { ok: false, error: "Email hoặc mật khẩu không đúng." };
  }

  await cleanupExpiredSessions(user.id);

  if (await hasActiveSession(user.id)) {
    return { ok: false, error: "Tài khoản này đang đăng nhập trên thiết bị khác. Vui lòng logout khỏi thiết bị cũ trước khi đăng nhập lại." };
  }

  try {
    await setSessionCookie(toAuthUser(user));
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return { ok: false, error: "Tài khoản này đang đăng nhập trên thiết bị khác. Vui lòng logout khỏi thiết bị cũ trước khi đăng nhập lại." };
    }

    throw error;
  }

  return { ok: true };
}

export async function logoutUser() {
  "use server";

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await db.query("UPDATE user_sessions SET logged_out_at = NOW() WHERE session_token_hash = $1", [hashSessionToken(token)]);
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function invalidateCurrentSession(token?: string) {
  if (!token) {
    return;
  }

  await db.query("UPDATE user_sessions SET logged_out_at = NOW() WHERE session_token_hash = $1", [hashSessionToken(token)]);
}

function toAuthUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role === "admin" ? "admin" : "user",
  };
}

async function setSessionCookie(user: AuthUser, meta: SessionRequestMeta = {}) {
  const token = createSessionToken(user);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  await db.query(
    `
      INSERT INTO user_sessions (id, user_id, session_token_hash, device_id, user_agent, ip_address, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [randomBytes(16).toString("hex"), user.id, hashSessionToken(token), randomBytes(16).toString("hex"), meta.userAgent ?? null, meta.ipAddress ?? null, expiresAt],
  );

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

async function cleanupExpiredSessions(userId: string) {
  await db.query("DELETE FROM user_sessions WHERE user_id = $1 AND (expires_at <= NOW() OR logged_out_at IS NOT NULL)", [userId]);
}

async function hasActiveSession(userId: string) {
  const result = await db.query<{ id: string }>(
    "SELECT id FROM user_sessions WHERE user_id = $1 AND logged_out_at IS NULL AND expires_at > NOW() LIMIT 1",
    [userId],
  );

  return Boolean(result.rows[0]);
}

async function claimLegacySession(user: AuthUser, token: string) {
  await cleanupExpiredSessions(user.id);

  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  try {
    await db.query(
      `
        INSERT INTO user_sessions (id, user_id, session_token_hash, device_id, expires_at)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [randomBytes(16).toString("hex"), user.id, hashSessionToken(token), randomBytes(16).toString("hex"), expiresAt],
    );

    return true;
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return false;
    }

    throw error;
  }
}
