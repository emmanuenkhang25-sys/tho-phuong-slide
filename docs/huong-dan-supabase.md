# Hướng dẫn tạo & cấu hình Supabase cho Thờ Phượng Slide

Tài liệu này hướng dẫn từng bước — dành cho người lần đầu dùng Supabase.
Mọi SQL đều nằm trong thư mục [`supabase/`](../supabase/).

> ⚠️ **Thứ tự chạy SQL bắt buộc:**
> 1. `supabase/schema.sql`
> 2. `supabase/migrations/20261024_accept_invitation.sql` ← **không được bỏ qua**
>    (trang `/loi-moi` gọi RPC `accept_invitation`; chưa chạy file này thì người
>    được mời sẽ thấy hướng dẫn liên hệ quản trị viên thay vì tự tham gia)
> 3. `supabase/seed.sql` — **tùy chọn**, chỉ để xem demo (xóa khi dùng thật)

---

## Bước 1 — Tạo tài khoản & project

1. Mở https://supabase.com → **Start your project** → đăng nhập
   (bằng GitHub/Google/email đều được).
2. Bấm **New project** (nút xanh, góc phải trên của dashboard).
3. Điền:
   - **Name:** `tho-phuong-slide` (tên gợi nhớ, đặt gì cũng được)
   - **Database Password:** đặt mật khẩu mạnh, **ghi lại** (dùng khi cần kết nối
     trực tiếp; còn app chỉ dùng anon key nên ít khi cần)
   - **Region:** chọn gần Việt Nam nhất, VD **Singapore (Southeast Asia)**
     → cho tốc độ tốt nhất.
   - **Pricing Plan:** Free là đủ để bắt đầu.
4. Bấm **Create new project**, chờ ~1–2 phút cho project khởi tạo xong.

## Bước 2 — Chạy `schema.sql`

1. Trong dashboard project, vào menu trái **SQL Editor** (biểu tượng `</>`).
2. Bấm **+ New query**.
3. Mở file `supabase/schema.sql` trên máy, **copy toàn bộ** (Ctrl+A, Ctrl+C),
   dán vào ô query, bấm **Run** (hoặc Ctrl+Enter).
4. Đợi chạy xong. Cuối file có 3 câu kiểm tra nhanh (chỉ đọc, không ghi):
   - danh sách bảng trong schema `public`,
   - trạng thái RLS của 11 bảng (cột `rowsecurity` phải là `true`),
   - danh sách policies.
   Kéo xuống vùng **Results** xem: nếu thấy đủ 11 bảng
   (`profiles`, `churches`, `church_members`, `programs`, `sections`, `slides`,
   `program_assets`, `program_versions`, `invitations`, `audit_logs`,
   `present_sessions`) và policies liệt kê đầy đủ → schema OK.

## Bước 3 — Chạy migration `accept_invitation` (BẮT BUỘC)

1. Vẫn trong **SQL Editor** → **+ New query**.
2. Copy toàn bộ file `supabase/migrations/20261024_accept_invitation.sql`,
   dán, bấm **Run**.
3. Kiểm tra function đã tồn tại — chạy query:
   ```sql
   select proname from pg_proc where proname = 'accept_invitation';
   ```
   Phải trả về đúng 1 dòng `accept_invitation`. Nếu trống → chạy lại bước 2.

> Chức năng: người được mời mở link `/loi-moi?token=...`, đăng nhập đúng email
> được mời, bấm "Tham gia" → server tự kiểm tra email + hạn mời, thêm vào
> `church_members`, đánh dấu `accepted_at`, trả về `church_id`.

## Bước 4 — Chạy `seed.sql` (tùy chọn — DEMO)

1. **SQL Editor** → **+ New query** → copy toàn bộ `supabase/seed.sql` → **Run**.
2. Tạo 1 hội thánh demo + 1 chương trình demo (4 mục, 6 slide) để xem trước giao diện.
3. ⚠️ **Khi đưa vào sử dụng thật, hãy XÓA hội thánh demo** (vào app, với quyền
   `owner` của hội thánh demo — hoặc xóa trực tiếp trong Table Editor; xóa church
   sẽ cascade xóa toàn bộ dữ liệu demo liên quan). Chạy lại seed nhiều lần cũng
   an toàn (có guard theo tên, không tạo trùng).

## Bước 5 — Lấy URL & anon key

1. Vào **Project Settings** (biểu tượng bánh răng, cuối menu trái) → **API**.
2. Copy 2 giá trị:
   - **Project URL** → điền vào `VITE_SUPABASE_URL`
     (dạng `https://xyzcompany.supabase.co`)
   - **anon public** key → điền vào `VITE_SUPABASE_ANON_KEY`
     (chuỗi JWT dài bắt đầu bằng `eyJ...`)
3. ⚠️ **Chỉ dùng `anon key` trong app.** Tuyệt đối không copy `service_role key`
   vào frontend — key đó bypass toàn bộ RLS.

Điền vào file `apps/web/.env` (copy từ `.env.example`):

```env
VITE_SUPABASE_URL=https://xyzcompany.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

## Bước 6 — Cấu hình Email Auth (đăng ký / đăng nhập / quên mật khẩu)

1. Vào **Authentication** → **Providers** → **Email**: đảm bảo **Enable** đang bật
   (mặc định Supabase đã bật).
2. **Xác minh email khi đăng ký:**
   - Vào **Authentication** → **Settings** (hoặc **Configuration → Auth** tùy bản
     dashboard) → tìm **"Confirm email"** / **"Enable email confirmations"**.
   - **Bật** nếu muốn user phải bấm link trong email mới đăng nhập được
     (khuyến nghị cho dùng thật); **tắt** khi đang test cho nhanh.
   - Mục **SMTP / Email templates**: gói Free dùng email mặc định của Supabase
     (có giới hạn gửi/ngày). Khi dùng thật, nên cấu hình SMTP riêng
     (VD Resend, SendGrid) tại **Project Settings → Auth → SMTP Settings**.
3. **Quên mật khẩu:** app đã có trang `/quen-mat-khau` gọi
   `supabase.auth.resetPasswordForEmail()` — hoạt động ngay khi Email provider bật.
   Link trong email sẽ đưa user về trang `/dat-lai-mat-khau` của app
   (kiểm tra **Authentication → URL Configuration → Redirect URLs** đã cho phép
   domain của app, VD `https://ten-app.vercel.app/**`).
4. **Site URL:** tại **Authentication → URL Configuration**, đặt **Site URL**
   thành domain thật của app sau khi deploy (VD `https://ten-app.vercel.app`).

## Bước 7 — Bật Realtime cho `present_sessions` (điều khiển từ xa)

`schema.sql` đã tự thêm bảng `present_sessions` vào publication `supabase_realtime`
(phục vụ đồng bộ slide + trạng thái giữa PC và điện thoại). Kiểm tra lại:

1. Vào **Database** → **Replication** (một số bản dashboard ghi là
   **Publications**).
2. Tìm publication **`supabase_realtime`** → bấm vào → danh sách bảng phải có
   **`present_sessions`** (toggle bật).
3. Nếu sau này reset/làm mới publication, bật lại toggle cho bảng này.

> Ghi chú: điều khiển từ xa của app **cần Internet ở cả 2 thiết bị**
> (đi qua Supabase Realtime), không phải mạng LAN/Wi-Fi nội bộ.

## Bước 8 — Kiểm tra Storage buckets

`schema.sql` đã tự tạo 2 buckets. Kiểm tra:

1. Vào **Storage** (menu trái): phải thấy 2 buckets:
   - **`church-logos`** — Public: **bật** (logo hội thánh đọc công khai)
   - **`program-images`** — Public: **tắt** (ảnh slide chỉ thành viên đọc)
2. Bấm vào từng bucket → tab **Policies**: phải thấy các policy theo
   `schema.sql` (VD `church-logos public read`, `program-images member read`,
   `program-images editor insert`, ...).
3. ⚠️ Nếu project đã có sẵn policy mẫu trên `storage.objects`, rà soát lại:
   các policy được **OR** với nhau — policy mẫu quá thoáng sẽ nới quyền
   ngoài ý muốn.

## Bước 9 — Cấp quyền platform admin đầu tiên

Trang `/quan-tri` chỉ hiển thị với tài khoản có `profiles.is_platform_admin = true`.
Không có tài khoản admin cố định trong SQL — cấp thủ công lần đầu:

1. Đăng ký 1 tài khoản trong app (trang `/dang-ky`) bằng email của quản trị viên.
2. Vào **SQL Editor** → chạy (thay email thật):
   ```sql
   update public.profiles
   set is_platform_admin = true
   where email = 'email-quan-tri@vidu.com';
   ```
3. Đăng xuất → đăng nhập lại trong app → menu **Quản trị** xuất hiện.

> Cơ chế bảo vệ: trigger `trg_prevent_admin_escalation` chặn mọi tài khoản thường
> tự nâng quyền qua API — chỉ platform admin hiện tại (hoặc SQL trực tiếp trong
> SQL Editor) mới đổi được cờ này.

## Bước 10 — Google OAuth (TÙY CHỌN — CHƯA TRIỂN KHAI, CHƯA TEST)

> ⛔ **Ghi rõ:** đăng nhập Google **chưa được viết code** trong app hiện tại
> (biến `VITE_ENABLE_GOOGLE_LOGIN` trong `.env.example` chưa được code nào đọc).
> Phần dưới chỉ là hướng dẫn tham khảo cho tương lai — **chỉ bật sau khi đã
> cấu hình đầy đủ VÀ kiểm thử đăng nhập thật end-to-end.**

Khi muốn triển khai sau này, các bước chuẩn:

1. Tạo OAuth Client ID tại Google Cloud Console (Authorized redirect URI:
   `https://<project-ref>.supabase.co/auth/v1/callback`).
2. Vào Supabase **Authentication → Providers → Google** → bật, dán Client ID +
   Client Secret.
3. Thêm nút "Đăng nhập bằng Google" trong app gọi
   `supabase.auth.signInWithOAuth({ provider: 'google' })` + xử lý callback.
4. Kiểm thử thật: đăng nhập Google → tạo hội thánh → dùng tính năng —
   rồi mới coi là xong.

## Kiểm thử nhanh sau cấu hình (gợi ý)

1. Đăng ký 2 tài khoản → kiểm tra bảng `public.profiles` tự có 2 dòng
   (trigger `trg_handle_new_user`).
2. Tài khoản A tạo hội thánh → kiểm tra `church_members` có dòng `role = 'owner'`.
3. Tài khoản B (chưa là thành viên) mở app → không thấy hội thánh của A.
4. A mời B (role `editor`) từ trang Hội thánh → B mở link `/loi-moi?token=...`
   → đăng nhập đúng email → bấm **Tham gia** → kiểm tra `church_members` có B,
   `invitations.accepted_at` đã set.
5. B sửa được slide nhưng **không** xóa được chương trình (cần `admin`+).

Chi tiết trạng thái kiểm thử thực tế của dự án: xem `bao-cao-kiem-thu.md`.
