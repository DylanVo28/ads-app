import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser, registerUser } from "@/lib/auth";
import { AuthForm } from "../auth-form";

export default async function RegisterPage() {
  if (await getCurrentUser()) {
    redirect("/");
  }

  return (
    <AuthForm
      action={registerUser}
      title="Tạo tài khoản"
      subtitle="Đăng ký một lần để mở khóa toàn bộ website."
      submitLabel="Đăng ký và vào website"
      showName
      footer={<span>Đã có tài khoản? <Link href="/login">Đăng nhập</Link></span>}
    />
  );
}
