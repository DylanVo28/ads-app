"use server";

import { randomBytes, scryptSync } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { db, ensureUsersTable } from "@/lib/db";

type UserRole = "user" | "admin";

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function getRole(value: FormDataEntryValue | null): UserRole {
  return value === "admin" ? "admin" : "user";
}

async function requireAdmin() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "admin") {
    redirect("/");
  }

  return user;
}

export async function createUser(formData: FormData) {
  await requireAdmin();
  await ensureUsersTable();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = getRole(formData.get("role"));

  if (!name || !email || password.length < 8) {
    throw new Error("Vui lòng nhập tên, email và mật khẩu tối thiểu 8 ký tự.");
  }

  await db.query(
    `
      INSERT INTO users (id, email, name, role, password_hash)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [randomBytes(16).toString("hex"), email, name, role, hashPassword(password)],
  );

  revalidatePath("/dashboard");
}

export async function updateUser(formData: FormData) {
  const admin = await requireAdmin();
  await ensureUsersTable();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = getRole(formData.get("role"));

  if (!id || !name || !email) {
    throw new Error("Vui lòng nhập đầy đủ tên và email.");
  }

  if (admin.id === id && role !== "admin") {
    throw new Error("Không thể tự hạ quyền admin của tài khoản đang đăng nhập.");
  }

  if (password) {
    if (password.length < 8) {
      throw new Error("Mật khẩu mới phải có tối thiểu 8 ký tự.");
    }

    await db.query(
      `
        UPDATE users
        SET name = $1, email = $2, role = $3, password_hash = $4
        WHERE id = $5
      `,
      [name, email, role, hashPassword(password), id],
    );
  } else {
    await db.query(
      `
        UPDATE users
        SET name = $1, email = $2, role = $3
        WHERE id = $4
      `,
      [name, email, role, id],
    );
  }

  revalidatePath("/dashboard");
}

export async function deleteUser(formData: FormData) {
  const admin = await requireAdmin();
  await ensureUsersTable();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    throw new Error("Thiếu user id.");
  }

  if (admin.id === id) {
    throw new Error("Không thể xoá tài khoản admin đang đăng nhập.");
  }

  await db.query("DELETE FROM users WHERE id = $1", [id]);
  revalidatePath("/dashboard");
}
