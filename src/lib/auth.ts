import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { db, ensureUsersTable } from "./db";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS, verifySessionToken } from "./session";
import type { AuthUser } from "./session";

type StoredUser = {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  password_hash: string;
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
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function registerUser(formData: FormData): Promise<AuthResult> {
  "use server";

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name || !email || password.length < 8) {
    return { ok: false, error: "Vui lòng nhập tên, email và mật khẩu tối thiểu 8 ký tự." };
  }

  await ensureUsersTable();

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

  await ensureUsersTable();

  const result = await db.query<StoredUser>(
    "SELECT id, email, name, role, password_hash FROM users WHERE email = $1 LIMIT 1",
    [email],
  );
  const user = result.rows[0];

  if (!user || !verifyPassword(password, user.password_hash)) {
    return { ok: false, error: "Email hoặc mật khẩu không đúng." };
  }

  await setSessionCookie(toAuthUser(user));
  return { ok: true };
}

export async function logoutUser() {
  "use server";

  (await cookies()).delete(SESSION_COOKIE);
}

function toAuthUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role === "admin" ? "admin" : "user",
  };
}

async function setSessionCookie(user: AuthUser) {
  (await cookies()).set(SESSION_COOKIE, createSessionToken(user), {
    httpOnly: true,
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
