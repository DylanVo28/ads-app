# Tính năng giới hạn đăng nhập 1 thiết bị

## Mục tiêu

Mỗi tài khoản chỉ được đăng nhập trên 1 thiết bị tại một thời điểm. Nếu user đã đăng nhập trên máy A thì không được đăng nhập tiếp trên máy B. Muốn đăng nhập trên máy B, user phải logout khỏi máy A trước.

## Phạm vi

- Áp dụng cho toàn bộ user đăng nhập bằng email/password hoặc luồng auth hiện tại.
- Chỉ cho phép 1 session active cho mỗi user.
- Khi user logout, session của thiết bị đó được giải phóng để có thể login trên thiết bị khác.
- Nếu session hết hạn hoặc không còn hợp lệ, hệ thống cần tự giải phóng trạng thái đăng nhập thiết bị.
- Không cho phép client tự khai báo hoặc sửa trạng thái thiết bị.

## Luồng đăng nhập

1. User nhập email/password tại `/login`.
2. Server xác thực thông tin đăng nhập.
3. Server kiểm tra user hiện có session active hay không.
4. Nếu chưa có session active, tạo session mới và cho login.
5. Nếu đã có session active khác, từ chối login và hiển thị thông báo:

```txt
Tài khoản này đang đăng nhập trên thiết bị khác. Vui lòng logout khỏi thiết bị cũ trước khi đăng nhập lại.
```

## Luồng logout

1. User đang đăng nhập bấm logout.
2. Server xóa session/cookie hiện tại.
3. Server đánh dấu session active của user là đã logout hoặc xóa khỏi database.
4. User có thể login lại trên thiết bị khác.

## Database đề xuất

Có thể quản lý bằng bảng `user_sessions` để lưu session active hiện tại của mỗi user.

```sql
CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  session_token_hash TEXT NOT NULL,
  device_id TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  logged_out_at TIMESTAMP NULL
);
```

### Ý nghĩa field

| Field | Ý nghĩa |
| --- | --- |
| `user_id` | Mỗi user chỉ có 1 dòng active nhờ `UNIQUE`. |
| `session_token_hash` | Hash của session token, không lưu token thô. |
| `device_id` | ID thiết bị sinh server-side hoặc lưu bằng cookie riêng. |
| `user_agent` | Thông tin trình duyệt để admin/debug nếu cần. |
| `ip_address` | IP đăng nhập gần nhất. |
| `expires_at` | Thời điểm session hết hạn. |
| `logged_out_at` | Có giá trị khi user đã logout. |

## Logic kiểm tra session active

Một session được xem là active khi:

- `logged_out_at IS NULL`
- `expires_at > NOW()`
- `session_token_hash` khớp với token hiện tại

Khi login, nếu tồn tại session active của `user_id` nhưng `session_token_hash` khác token đang tạo, hệ thống phải chặn login.

Pseudo logic:

```ts
async function assertCanLogin(userId: string) {
  const activeSession = await findActiveSessionByUserId(userId);

  if (activeSession) {
    throw new Error("ACCOUNT_ALREADY_LOGGED_IN_ON_ANOTHER_DEVICE");
  }
}
```

## Các thay đổi đề xuất

### 1. Cập nhật database helper

File liên quan: `src/lib/db.ts`

- Tạo bảng `user_sessions` khi app khởi động hoặc khi ensure database.
- Thêm index/unique constraint cho `user_id` để đảm bảo chỉ có 1 session active.
- Có cơ chế dọn session hết hạn để user không bị kẹt login vĩnh viễn.

### 2. Cập nhật auth login

File liên quan: `src/lib/auth.ts`

- Sau khi xác thực password đúng, kiểm tra session active của user.
- Nếu user đang có session active, trả lỗi login rõ ràng.
- Nếu chưa có session active, tạo session token và lưu bản ghi `user_sessions`.
- Token lưu trong database phải được hash trước khi lưu.

Pseudo flow:

```ts
const user = await verifyUserCredentials(email, password);
await cleanupExpiredSessions(user.id);
await assertCanLogin(user.id);

const sessionToken = await createSessionToken(user);
await createUserSession({
  userId: user.id,
  sessionTokenHash: hashSessionToken(sessionToken),
  deviceId,
  userAgent,
  ipAddress,
  expiresAt,
});
```

### 3. Cập nhật logout

File liên quan tùy project, ví dụ:

- `src/app/logout/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/lib/auth.ts`

Yêu cầu:

- Đọc session token hiện tại từ cookie.
- Hash token và tìm bản ghi `user_sessions` tương ứng.
- Set `logged_out_at = NOW()` hoặc xóa bản ghi session.
- Xóa cookie session trên browser.

Pseudo logic:

```ts
await logoutUserSession(hashSessionToken(sessionToken));
await clearSessionCookie();
```

### 4. Cập nhật verify session

File liên quan: `src/lib/session.ts`

- Khi verify JWT/session token, cần kiểm tra thêm trong bảng `user_sessions`.
- Nếu token hợp lệ nhưng không còn bản ghi active trong database, xem như chưa đăng nhập.
- Nếu token bị logout hoặc hết hạn, xóa cookie và redirect về `/login`.

Pseudo logic:

```ts
const payload = await verifySessionToken(token);
const activeSession = await findActiveSessionByTokenHash(hashSessionToken(token));

if (!activeSession || activeSession.userId !== payload.userId) {
  return null;
}
```

### 5. Cập nhật middleware/proxy bảo vệ route

File liên quan: `src/proxy.ts`

- Với các route yêu cầu login, ngoài verify token cần đảm bảo session còn active trong database.
- Nếu session không active, redirect về `/login`.

## Xử lý trường hợp đặc biệt

### User đóng trình duyệt nhưng không logout

Nếu user chỉ đóng browser, server không biết để logout ngay. Cần dùng `expires_at` để session tự hết hạn.

Đề xuất:

- Session ngắn: 8-24 giờ.
- Mỗi request hợp lệ có thể cập nhật `last_seen_at`.
- Có thể gia hạn `expires_at` nếu muốn duy trì đăng nhập trên cùng thiết bị.

### User bị kẹt không login được

Nếu user mất máy hoặc quên logout, sẽ bị chặn login. Có 2 hướng xử lý:

1. Giữ đúng yêu cầu nghiêm ngặt: user phải chờ session hết hạn hoặc liên hệ admin.
2. Thêm chức năng admin force logout user để giải phóng session.

Nếu cần đúng yêu cầu ban đầu, không nên có nút “Đăng xuất thiết bị cũ” cho user tự bấm khi login trên máy mới, vì như vậy sẽ cho phép chiếm login từ máy khác.

### Nhiều tab trên cùng máy

Nhiều tab trên cùng browser vẫn dùng chung cookie session nên được phép hoạt động bình thường.

### Đổi IP hoặc đổi user agent

Không nên chỉ dựa vào IP/user agent để xác định thiết bị, vì IP có thể thay đổi. Nguồn xác thực chính vẫn là session token active trong database.

## Tiêu chí hoàn thành

- User chưa có session active login thành công.
- User đang login trên máy A không login được trên máy B.
- User logout trên máy A thì login được trên máy B.
- Session hết hạn không tiếp tục chặn user login.
- Token đã logout không thể dùng để truy cập route cần đăng nhập.
- Database không lưu session token dạng plain text.
- Nhiều tab trên cùng browser không bị xem là nhiều thiết bị.

## Ghi chú bảo mật

- Không tin `deviceId` do client gửi lên nếu chưa kiểm chứng bằng session/cookie server-side.
- Không lưu session token thô trong database; chỉ lưu hash.
- Không chỉ kiểm tra ở UI; bắt buộc kiểm tra ở server khi login và verify session.
- Cần dọn session hết hạn để tránh user bị khóa login vĩnh viễn.
- Nếu có API/server action quan trọng, cần kiểm tra session active trước khi xử lý.
