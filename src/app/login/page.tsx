import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser, loginUser } from "@/lib/auth";
import { AuthForm } from "../auth-form";

export default async function LoginPage() {
  if (await getCurrentUser()) {
    redirect("/");
  }

  return (
    <AuthForm
      action={loginUser}
      title="Đăng nhập"
      subtitle="Chỉ tài khoản đã đăng ký mới truy cập được Ads Citadel."
      submitLabel="Vào website"
      footer={<span>Chưa có tài khoản? <Link href="/register">Đăng ký ngay</Link></span>}
    />
  );
}
