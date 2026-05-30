"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";

type AuthResult = { ok: true } | { ok: false; error: string };

type AuthFormProps = {
  action: (formData: FormData) => Promise<AuthResult>;
  title: string;
  subtitle: string;
  submitLabel: string;
  showName?: boolean;
  footer: ReactNode;
};

export function AuthForm({ action, title, subtitle, submitLabel, showName = false, footer }: AuthFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(async (_: AuthResult, formData: FormData) => {
    const result = await action(formData);

    if (result.ok) {
      router.replace("/");
      router.refresh();
    }

    return result;
  }, { ok: false, error: "" });

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="auth-kicker">Ads Citadel Access</p>
        <h1>{title}</h1>
        <p className="auth-subtitle">{subtitle}</p>
        <form action={formAction} className="auth-form">
          {showName && <input name="name" placeholder="Tên của bạn" autoComplete="name" required />}
          <input name="email" type="email" placeholder="Email" autoComplete="email" required />
          <input name="password" type="password" placeholder="Mật khẩu" autoComplete={showName ? "new-password" : "current-password"} minLength={8} required />
          {!state.ok && state.error && <p className="auth-error">{state.error}</p>}
          <button type="submit" disabled={pending}>{pending ? "Đang xử lý..." : submitLabel}</button>
        </form>
        <p className="auth-footer">{footer}</p>
      </section>
    </main>
  );
}
