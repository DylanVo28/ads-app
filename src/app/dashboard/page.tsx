import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { db, ensureUsersTable } from "@/lib/db";

import { createUser, deleteUser, updateUser } from "./actions";

type DashboardStats = {
  totalUsers: string;
  adminUsers: string;
  recentUsers: string;
};

type DashboardUser = {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  created_at: Date;
};

async function getDashboardData() {
  await ensureUsersTable();

  const [statsResult, usersResult] = await Promise.all([
    db.query<DashboardStats>(`
      SELECT
        COUNT(*)::text AS "totalUsers",
        COUNT(*) FILTER (WHERE role = 'admin')::text AS "adminUsers",
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::text AS "recentUsers"
      FROM users
    `),
    db.query<DashboardUser>(`
      SELECT id, email, name, role, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 50
    `),
  ]);

  return {
    stats: statsResult.rows[0] ?? { totalUsers: "0", adminUsers: "0", recentUsers: "0" },
    users: usersResult.rows,
  };
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "admin") {
    redirect("/");
  }

  const { stats, users } = await getDashboardData();
  const statCards = [
    { label: "Tổng user", value: stats.totalUsers },
    { label: "Admin", value: stats.adminUsers },
    { label: "User mới 7 ngày", value: stats.recentUsers },
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-[#050914] px-4 pb-16 pt-28 text-[#fff8e1] sm:px-8 lg:px-10">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_16%,rgba(246,207,132,0.24),transparent_30%),radial-gradient(circle_at_88%_18%,rgba(10,132,255,0.2),transparent_28%),linear-gradient(135deg,#050914_0%,#111b30_55%,#321b0b_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:80px_80px]" />

      <section className="relative mx-auto w-full max-w-[1400px]">
        <div className="rounded-[2.5rem] border border-[#f6cf84]/25 bg-[#071226]/75 p-6 shadow-[0_34px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl md:p-10">
          <p className="w-fit rounded-full border border-[#f6cf84]/35 bg-[#f6cf84]/10 px-5 py-2 text-xs font-black uppercase tracking-[0.34em] text-[#ffd98b]">
            Admin Dashboard
          </p>
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <h1 className="max-w-4xl text-5xl font-black leading-[0.92] tracking-[-0.06em] text-white md:text-7xl">
                Bảng điều khiển quản trị
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[#d7dfef]">
                Theo dõi người dùng và các tín hiệu quản trị quan trọng. Trang này chỉ hiển thị với tài khoản có quyền admin.
              </p>
            </div>
            <div className="rounded-[2rem] border border-white/12 bg-white/8 p-5 text-sm font-bold text-[#d7dfef]">
              Đang đăng nhập với quyền <span className="text-[#ffd98b]">{user.role}</span>: {user.email}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {statCards.map((card) => (
            <article key={card.label} className="rounded-[2rem] border border-white/12 bg-white/10 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.25)] backdrop-blur-xl">
              <p className="text-sm font-black uppercase tracking-[0.24em] text-[#ffd98b]">{card.label}</p>
              <p className="mt-4 text-5xl font-black tracking-[-0.05em] text-white">{card.value}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <form action={createUser} className="rounded-[2rem] border border-white/12 bg-[#071226]/80 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <h2 className="text-2xl font-black text-white">Thêm user</h2>
            <div className="mt-5 grid gap-3">
              <input name="name" placeholder="Tên user" required className="min-h-12 rounded-2xl border border-white/15 bg-white/10 px-4 font-bold text-white outline-none placeholder:text-[#c7d2ea]" />
              <input name="email" type="email" placeholder="Email" required className="min-h-12 rounded-2xl border border-white/15 bg-white/10 px-4 font-bold text-white outline-none placeholder:text-[#c7d2ea]" />
              <input name="password" type="password" placeholder="Mật khẩu tối thiểu 8 ký tự" minLength={8} required className="min-h-12 rounded-2xl border border-white/15 bg-white/10 px-4 font-bold text-white outline-none placeholder:text-[#c7d2ea]" />
              <select name="role" defaultValue="user" className="min-h-12 rounded-2xl border border-white/15 bg-[#0b172d] px-4 font-black text-white outline-none">
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
              <button type="submit" className="min-h-12 rounded-full bg-gradient-to-r from-[#ffd98b] to-[#ff8f3d] px-5 font-black text-[#241000] transition hover:scale-[1.01]">
                Tạo user
              </button>
            </div>
          </form>

          <div className="overflow-hidden rounded-[2rem] border border-white/12 bg-[#071226]/80 shadow-[0_30px_100px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <div className="border-b border-white/10 px-6 py-5">
              <h2 className="text-2xl font-black text-white">Quản lý user</h2>
              <p className="mt-1 text-sm font-bold text-[#d7dfef]">Sửa tên, email, quyền hoặc đặt mật khẩu mới. Để trống mật khẩu nếu không đổi.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead className="text-sm font-black uppercase tracking-[0.18em] text-[#ffd98b]">
                  <tr>
                    <th className="px-4 py-4">Tên</th>
                    <th className="px-4 py-4">Email</th>
                    <th className="px-4 py-4">Quyền</th>
                    <th className="px-4 py-4">Mật khẩu mới</th>
                    <th className="px-4 py-4">Ngày tạo</th>
                    <th className="px-4 py-4">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-[#d7dfef]">
                  {users.map((managedUser) => (
                    <tr key={managedUser.id} className="align-top transition hover:bg-white/6">
                      <td className="px-4 py-4">
                        <form id={`update-${managedUser.id}`} action={updateUser} className="contents">
                          <input type="hidden" name="id" value={managedUser.id} />
                          <input name="name" defaultValue={managedUser.name} required className="w-44 rounded-xl border border-white/15 bg-white/10 px-3 py-2 font-bold text-white outline-none" />
                        </form>
                      </td>
                      <td className="px-4 py-4">
                        <input form={`update-${managedUser.id}`} name="email" type="email" defaultValue={managedUser.email} required className="w-56 rounded-xl border border-white/15 bg-white/10 px-3 py-2 font-bold text-white outline-none" />
                      </td>
                      <td className="px-4 py-4">
                        <select form={`update-${managedUser.id}`} name="role" defaultValue={managedUser.role} className="rounded-xl border border-white/15 bg-[#0b172d] px-3 py-2 font-black text-white outline-none">
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-4">
                        <input form={`update-${managedUser.id}`} name="password" type="password" placeholder="Không đổi" minLength={8} className="w-40 rounded-xl border border-white/15 bg-white/10 px-3 py-2 font-bold text-white outline-none placeholder:text-[#c7d2ea]" />
                      </td>
                      <td className="px-4 py-4 font-bold">{formatDate(managedUser.created_at)}</td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button form={`update-${managedUser.id}`} type="submit" className="rounded-full border border-[#f6cf84]/30 bg-[#f6cf84]/10 px-4 py-2 text-sm font-black text-[#ffd98b] transition hover:bg-[#f6cf84]/18">
                            Lưu
                          </button>
                          <form action={deleteUser}>
                            <input type="hidden" name="id" value={managedUser.id} />
                            <button type="submit" className="rounded-full border border-red-300/30 bg-red-500/10 px-4 py-2 text-sm font-black text-red-100 transition hover:bg-red-500/20">
                              Xoá
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td className="px-6 py-8 text-center font-bold text-[#d7dfef]" colSpan={6}>
                        Chưa có user nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
