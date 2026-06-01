import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser, logoutUser } from "@/lib/auth";

export async function Header() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  async function handleLogout() {
    "use server";

    await logoutUser();
    redirect("/login");
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#050914]/75 text-[#fff8e1] shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="mx-auto flex h-20 w-full max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-8 lg:px-10">
        <Link
          href="/"
          className="rounded-full border border-[#f6cf84]/30 bg-white/8 px-5 py-3 text-sm font-black uppercase tracking-[0.32em] text-[#f9d588] transition hover:border-[#ffd27a]/60 hover:bg-white/14 md:text-base"
          aria-label="Về trang chủ"
        >
          Ads Citadel
        </Link>

        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden max-w-[240px] truncate text-sm font-bold text-[#d7dfef] sm:block">
            {user.name || user.email}
          </span>
          <form action={handleLogout}>
            <button
              type="submit"
              className="rounded-full border border-[#f6cf84]/30 bg-[#f6cf84]/10 px-5 py-3 text-sm font-black text-[#ffd98b] shadow-2xl transition hover:border-[#ffd27a]/60 hover:bg-[#f6cf84]/18 md:text-base"
            >
              Đăng xuất
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
