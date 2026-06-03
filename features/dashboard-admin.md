# Tính năng Dashboard dành cho Admin

## Mục tiêu

Tích hợp một trang Dashboard chỉ dành cho người dùng có quyền `admin`. Người dùng chưa đăng nhập hoặc không có quyền admin không được phép truy cập trang này.

## Phạm vi

- Tạo page Dashboard tại route `/dashboard`.
- Chỉ user có role `admin` mới xem được nội dung Dashboard.
- User chưa đăng nhập sẽ bị chuyển về `/login`.
- User đã đăng nhập nhưng không phải admin sẽ bị chặn truy cập và chuyển về trang phù hợp, ví dụ `/` hoặc trang báo lỗi `403`.

## Yêu cầu phân quyền

### Role người dùng

Cần bổ sung thông tin quyền cho user, ví dụ:

```ts
type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
};
```

### Database

Bảng `users` cần có thêm cột `role`:

```sql
ALTER TABLE users
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
```

Khi tạo admin đầu tiên, có thể cập nhật thủ công trong database:

```sql
UPDATE users
SET role = 'admin'
WHERE email = 'admin@example.com';
```

## Luồng truy cập

1. User truy cập `/dashboard`.
2. Hệ thống kiểm tra session hiện tại.
3. Nếu chưa đăng nhập, redirect sang `/login`.
4. Nếu đã đăng nhập nhưng `role !== "admin"`, redirect sang `/` hoặc trả về trang `403`.
5. Nếu là admin, hiển thị Dashboard.

## Các thay đổi đề xuất

### 1. Cập nhật session

File liên quan: `src/lib/session.ts`

- Thêm field `role` vào `AuthUser`.
- Lưu `role` vào session token khi đăng nhập hoặc đăng ký.
- Trả về `role` khi verify session token.

### 2. Cập nhật auth

File liên quan: `src/lib/auth.ts`

- Thêm `role` vào type user đọc từ database.
- Query thêm cột `role` khi login.
- Khi register user mới, role mặc định là `user`.
- Hàm `getCurrentUser()` cần trả về user kèm role.

### 3. Cập nhật database helper

File liên quan: `src/lib/db.ts`

- Bổ sung cột `role` vào `ensureUsersTable()`.
- Có thể dùng default `user` để không ảnh hưởng user hiện tại.

Ví dụ:

```sql
role TEXT NOT NULL DEFAULT 'user'
```

### 4. Chặn route Dashboard

File liên quan: `src/proxy.ts`

- Thêm logic riêng cho route `/dashboard`.
- Nếu user không phải admin, redirect về `/` hoặc `/403`.

Pseudo logic:

```ts
if (pathname.startsWith("/dashboard") && user?.role !== "admin") {
  return NextResponse.redirect(new URL("/", request.url));
}
```

### 5. Tạo page Dashboard

File đề xuất: `src/app/dashboard/page.tsx`

- Page này là server component.
- Gọi `getCurrentUser()` để lấy user hiện tại.
- Có thể kiểm tra role thêm một lần trong page để tăng an toàn.
- Hiển thị các chỉ số hoặc khu vực quản trị cần thiết.

Ví dụ nội dung ban đầu:

- Tổng số user.
- Danh sách user mới.
- Trạng thái hệ thống.
- Các hành động quản trị.

## Tiêu chí hoàn thành

- User chưa đăng nhập không truy cập được `/dashboard`.
- User role `user` không truy cập được `/dashboard`.
- User role `admin` truy cập được `/dashboard`.
- Session token chứa role và verify đúng role.
- Database có cột `role` với default là `user`.
- Không làm hỏng luồng login/register hiện tại.

## Ghi chú bảo mật

- Không chỉ ẩn link Dashboard ở UI; bắt buộc kiểm tra quyền ở server/proxy.
- Không tin dữ liệu role từ client.
- Nên kiểm tra quyền tại cả `proxy.ts` và trong page/server action quan trọng.
- Các API hoặc server action dành cho Dashboard cũng phải kiểm tra `role === "admin"`.
