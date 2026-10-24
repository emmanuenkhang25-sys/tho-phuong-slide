# Supabase — Thờ Phượng Slide

Thư mục này chứa toàn bộ SQL backend, triển khai đúng `CONTRACT.md` mục 3.1–3.14.

| File | Nội dung |
|---|---|
| `schema.sql` | Schema chính: 11 bảng, indexes, 7 functions, triggers, RLS đầy đủ, 2 storage buckets + policies, view `v_program_stats`, bật Realtime cho `present_sessions` |
| `migrations/20261024_accept_invitation.sql` | RPC `accept_invitation(p_token)` — người được mời tự chấp nhận lời mời (thêm vào `church_members`, đánh dấu `accepted_at`). **Bắt buộc chạy** để trang `/loi-moi` hoạt động |
| `seed.sql` | **DỮ LIỆU DEMO** — 1 hội thánh + 1 chương trình mẫu (không phải dữ liệu chính thức, xóa khi dùng thật) |

## Thứ tự chạy

1. Mở Supabase Dashboard → **SQL Editor** → **New query**.
2. Dán toàn bộ `schema.sql` → **Run**. Cuối file có 3 câu kiểm tra nhanh (chỉ đọc):
   danh sách bảng, trạng thái RLS, danh sách policies — xem kết quả để xác nhận.
3. Dán toàn bộ `migrations/20261024_accept_invitation.sql` → **Run** (tạo RPC
   `accept_invitation` cho trang `/loi-moi`). **Không được bỏ qua bước này.**
4. *(Tùy chọn)* Dán `seed.sql` → **Run** để có dữ liệu demo xem trước giao diện.
   Chạy lại nhiều lần cũng an toàn (guard idempotent theo tên hội thánh).

## Realtime cho `present_sessions`

`schema.sql` đã tự thêm bảng `present_sessions` vào publication `supabase_realtime`
(phục vụ điều khiển từ xa theo CONTRACT mục 9). Nếu sau này reset publication,
vào **Database → Replication** và bật lại cho bảng `present_sessions`.

## Buckets

`schema.sql` tự tạo 2 buckets qua `storage.buckets` (idempotent):

- `church-logos` — **public read**; chỉ `admin`+ của hội thánh (theo segment
  `<church_id>/` đầu đường dẫn) được upload/sửa/xóa.
- `program-images` — **private**; thành viên hội thánh được đọc;
  `editor`+ được upload/sửa/xóa.

Nếu project đã có policy mẫu trên `storage.objects`, hãy rà soát vì các policy
được OR với nhau — policy mẫu quá thoáng có thể nới quyền ngoài ý muốn.

## Lưu ý RLS

- Mọi bảng private đều `enable row level security`. Quyền thật nằm ở **server
  (RLS)**, không chỉ ẩn nút ở client.
- Đăng ký tài khoản mới → trigger `trg_handle_new_user` tự tạo row `profiles`.
- Tạo hội thánh mới → trigger `trg_handle_new_church` tự gán người tạo làm `owner`.
- `profiles.is_platform_admin` được trigger `trg_prevent_admin_escalation` bảo vệ:
  qua API chỉ platform admin hiện tại mới đổi được. **Cấp platform admin đầu tiên**
  bằng SQL trực tiếp trong SQL Editor (không qua JWT nên trigger cho phép):
  ```sql
  update public.profiles
  set is_platform_admin = true
  where email = 'email-quan-tri@vidu.com';
  ```
- Không có tài khoản/mật khẩu admin cố định nào trong SQL.
- `audit_logs` không có policy UPDATE/DELETE → bất biến sau khi ghi.
- Dữ liệu demo từ `seed.sql` chỉ đọc được bởi platform admin cho đến khi có
  thành viên thật trong hội thánh demo; xóa hội thánh demo sẽ cascade xóa toàn
  bộ program/sections/slides/assets/invitations/audit_logs liên quan.

## Kiểm thử thủ công gợi ý (sau khi chạy schema)

1. Đăng ký 2 tài khoản → kiểm tra `profiles` tự tạo (bảng **Authentication → Users**
   và `public.profiles`).
2. User A tạo hội thánh → kiểm tra `church_members` có row `owner`.
3. User B (chưa là thành viên) không đọc được programs của hội thánh đó
   (test bằng SQL Editor với JWT của B, hoặc qua app).
4. User A mời B (role `editor`) → B mở link `/loi-moi?token=...` → B chấp nhận →
   B có mặt trong `church_members`, B sửa được slide nhưng không xóa được program.
5. Kiểm tra RPC `accept_invitation` đã tồn tại: trong SQL Editor chạy
   `select proname from pg_proc where proname = 'accept_invitation';`
   (phải trả về 1 dòng). Nếu trống → chạy lại file migration ở bước 3.
