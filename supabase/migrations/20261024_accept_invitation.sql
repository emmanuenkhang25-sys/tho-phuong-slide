-- ============================================================
-- THỜ PHƯỢNG SLIDE — migration 20261024_accept_invitation
-- RPC public.accept_invitation(p_token text)
--
-- Cho phép người ĐƯỢC MỜI tự chấp nhận lời mời (tự thêm mình vào
-- church_members với role ghi trong invitation) mà không cần quyền
-- admin+ của hội thánh.
--
-- CHẠY SAU schema.sql (cần các bảng invitations, church_members).
-- Chạy trong Supabase Dashboard → SQL Editor (role postgres).
-- ============================================================

-- Tìm invitation còn hiệu lực theo token, kiểm tra email người gọi
-- (auth.jwt()->>'email', không phân biệt hoa/thường) trùng với
-- invitation.email, thêm vào church_members, đánh dấu accepted_at,
-- trả về church_id.
create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invitations%rowtype;
  v_caller_id uuid := auth.uid();
  v_caller_email text := nullif(trim(coalesce(auth.jwt() ->> 'email', '')), '');
begin
  -- 1. Phải đăng nhập và có email trong JWT
  if v_caller_id is null or v_caller_email is null then
    raise exception 'Bạn cần đăng nhập để chấp nhận lời mời.';
  end if;

  -- 2. Tìm lời mời: đúng token, chưa dùng, chưa hết hạn, email trùng
  select * into v_inv
  from public.invitations
  where token = p_token
    and accepted_at is null
    and expires_at > now()
    and lower(email) = lower(v_caller_email)
  limit 1;

  -- 3. Không tìm thấy → MỘT lỗi chung duy nhất (không phân biệt
  -- "không tồn tại" / "sai email" / "đã dùng" / "hết hạn" để tránh
  -- rò rỉ thông tin cho kẻ đoán token).
  if not found then
    raise exception 'Lời mời không hợp lệ (sai link, đã được dùng, đã hết hạn, hoặc không dành cho tài khoản này).';
  end if;

  -- 4. Thêm thành viên. Idempotent: nếu đã là thành viên (VD gọi lại
  -- sau khi accepted_at đã set nhưng membership còn) thì bỏ qua,
  -- không tạo dòng trùng nhờ UNIQUE(church_id, user_id).
  insert into public.church_members (church_id, user_id, role, invited_by)
  values (v_inv.church_id, v_caller_id, v_inv.role, v_inv.invited_by)
  on conflict (church_id, user_id) do nothing;

  -- 5. Đánh dấu lời mời đã dùng (chỉ 1 lần — điều kiện WHERE bước 2
  -- loại trừ accepted_at đã set nên không thể dùng lại token cũ).
  update public.invitations
  set accepted_at = now()
  where id = v_inv.id;

  -- 6. Trả về church_id để client làm mới danh sách hội thánh
  return v_inv.church_id;
end;
$$;

-- Thu hồi quyền mặc định, chỉ cấp EXECUTE cho role authenticated
-- (function đã tự kiểm tra email + token nên không cấp cho anon).
revoke all on function public.accept_invitation(text) from public;
revoke all on function public.accept_invitation(text) from anon;
grant execute on function public.accept_invitation(text) to authenticated;

-- ============================================================
-- TỰ REVIEW (người viết ghi lại — cần kiểm lại bằng Supabase thật)
-- ============================================================
-- [OK] SECURITY DEFINER + set search_path = public (chống search_path hijack,
--      theo cùng mẫu với các function trong schema.sql).
-- [OK] Bypass RLS là CÓ CHỦ Ý: người được mời chưa phải thành viên nên không
--      qua nổi policy church_members INSERT (cần admin+) — đúng mục đích RPC.
-- [OK] Kiểm tra email ngay trong function (lower() 2 phía), không tin client.
-- [OK] Lỗi chung 1 thông điệp cho mọi trường hợp "không tìm thấy" → không oracle token.
-- [OK] Chỉ update accepted_at cho đúng row vừa tìm được (WHERE id = v_inv.id).
-- [OK] on conflict do nothing → gọi lại không tạo trùng, không crash.
-- [OK] Không trả về dữ liệu nhạy cảm nào ngoài church_id.
-- [CẦN KIỂM THỬ THẬT] Chưa chạy trên Postgres thật (máy này không có psql/docker):
--      cú pháp, auth.uid()/auth.jwt() trong SECURITY DEFINER, và mã lỗi
--      PGRST202 khi client gọi trước lúc deploy — cần verify trên project thật.
