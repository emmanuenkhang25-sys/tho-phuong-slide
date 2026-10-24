-- ============================================================
-- THỜ PHƯỢNG SLIDE — schema.sql
-- Triển khai đúng CONTRACT.md mục 3.1–3.14.
-- Chạy trong Supabase Dashboard → SQL Editor (role postgres).
-- Idempotent ở mức hợp lý: CREATE TABLE IF NOT EXISTS,
-- CREATE INDEX IF NOT EXISTS, DROP POLICY/TRIGGER IF EXISTS
-- trước CREATE, CREATE OR REPLACE cho function/view.
-- KHÔNG chứa secret, KHÔNG tài khoản admin cố định.
-- ============================================================

-- ---- Extension cho gen_random_uuid() / gen_random_bytes() ----
create extension if not exists pgcrypto;

-- ============================================================
-- 1. TABLES (đúng tên bảng/cột theo CONTRACT 3.1–3.11)
-- ============================================================

-- 3.1 profiles — hồ sơ người dùng, liên kết auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3.2 churches — hội thánh / điểm nhóm
create table if not exists public.churches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  avatar_url text,
  contact_info text,
  settings jsonb not null default '{}',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3.3 church_members — thành viên + vai trò trong hội thánh
create table if not exists public.church_members (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'viewer'
    check (role in ('owner','admin','editor','presenter','viewer')),
  invited_by uuid references public.profiles(id),
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, user_id)
);
create index if not exists idx_church_members_church_id on public.church_members(church_id);
create index if not exists idx_church_members_user_id on public.church_members(user_id);

-- 3.4 programs — chương trình thờ phượng
create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  title text not null default 'Chương trình mới',
  event_date date,
  start_time time,
  leader text,
  theme text,
  theme_verse text,
  notes text,
  design_template jsonb not null default '{}',
  aspect_ratio text not null default '16:9' check (aspect_ratio in ('16:9','4:3')),
  status text not null default 'draft' check (status in ('draft','archived','deleted')),
  is_favorite boolean not null default false,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_programs_church_status on public.programs(church_id, status);
create index if not exists idx_programs_church_event_date on public.programs(church_id, event_date);

-- 3.5 sections — các mục trong chương trình (kind theo 3.5.1)
create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  title text not null,
  kind text not null default 'custom',
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_sections_program_order on public.sections(program_id, order_index);

-- 3.6 slides — content/background JSONB theo 3.6.1/3.6.2
create table if not exists public.slides (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  section_id uuid references public.sections(id) on delete set null,
  order_index int not null default 0,
  content jsonb not null default '{}',
  background jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_slides_program_order on public.slides(program_id, order_index);
create index if not exists idx_slides_section_order on public.slides(section_id, order_index);

-- 3.7 program_assets — file ảnh trong bucket program-images
create table if not exists public.program_assets (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  program_id uuid references public.programs(id) on delete set null,
  kind text not null default 'image',
  file_path text not null,
  file_url text,
  file_size int,
  mime text,
  width int,
  height int,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 3.8 program_versions — lịch sử phiên bản (snapshot JSONB)
create table if not exists public.program_versions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  snapshot jsonb not null,
  created_by uuid references public.profiles(id),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_program_versions_program_created
  on public.program_versions(program_id, created_at desc);

-- 3.9 invitations — lời mời tham gia hội thánh
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  email text not null,
  role text not null default 'viewer'
    check (role in ('owner','admin','editor','presenter','viewer')),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid references public.profiles(id),
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);

-- 3.10 audit_logs — nhật ký thao tác
create table if not exists public.audit_logs (
  id bigserial primary key,
  church_id uuid references public.churches(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity text,
  entity_id text,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_logs_church_created
  on public.audit_logs(church_id, created_at desc);

-- 3.11 present_sessions — phiên trình chiếu + điều khiển từ xa (Realtime)
create table if not exists public.present_sessions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  church_id uuid not null references public.churches(id) on delete cascade,
  code text not null unique,
  expires_at timestamptz not null default now() + interval '24 hours',
  current_slide int not null default 0,
  state text not null default 'live' check (state in ('live','paused','blank','ended')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- UNIQUE(code) đã tự tạo index; chỉ cần thêm index theo program_id
create index if not exists idx_present_sessions_program_id on public.present_sessions(program_id);

-- ============================================================
-- 2. GRANTS cơ bản cho role authenticated
-- (RLS bên dưới mới là lớp kiểm soát quyền thật sự)
-- ============================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.churches to authenticated;
grant select, insert, update, delete on public.church_members to authenticated;
grant select, insert, update, delete on public.programs to authenticated;
grant select, insert, update, delete on public.sections to authenticated;
grant select, insert, update, delete on public.slides to authenticated;
grant select, insert, update, delete on public.program_assets to authenticated;
grant select, insert, update, delete on public.program_versions to authenticated;
grant select, insert, update, delete on public.invitations to authenticated;
grant select, insert, update, delete on public.audit_logs to authenticated;
grant select, insert, update, delete on public.present_sessions to authenticated;
grant usage, select on sequence public.audit_logs_id_seq to authenticated;

-- ============================================================
-- 3. FUNCTIONS (theo CONTRACT 3.13)
-- ============================================================

-- Vai trò của user hiện tại trong một hội thánh (null nếu không phải thành viên)
create or replace function public.user_church_role(p_church_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.church_members
  where church_id = p_church_id
    and user_id = auth.uid()
  limit 1;
$$;

-- Thứ bậc số của vai trò: owner=5, admin=4, editor=3, presenter=2, viewer=1, khác=0
create or replace function public.role_rank(r text)
returns int
language sql
immutable
set search_path = public
as $$
  select case r
    when 'owner' then 5
    when 'admin' then 4
    when 'editor' then 3
    when 'presenter' then 2
    when 'viewer' then 1
    else 0
  end;
$$;

-- User hiện tại có phải quản trị nền tảng không
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_platform_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Tự cập nhật updated_at trước mỗi lần UPDATE
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Sau khi tạo hội thánh: tự thêm người tạo làm 'owner'
create or replace function public.handle_new_church()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is not null then
    insert into public.church_members (church_id, user_id, role)
    values (new.id, new.created_by, 'owner')
    on conflict (church_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

-- Sau khi có auth.users mới: tự tạo row profiles (id, email)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Chặn leo thang quyền: chỉ platform admin hiện tại (hoặc truy cập DB trực tiếp
-- không qua JWT, VD lần đầu cấp quyền trong SQL Editor) được đổi is_platform_admin.
-- Truy cập DB trực tiếp vốn đã toàn quyền nên không tạo lỗ hổng mới;
-- qua API, RLS profiles (UPDATE chỉ chính mình) đã chặn từ trước.
create or replace function public.prevent_admin_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_platform_admin is distinct from new.is_platform_admin then
    if auth.uid() is not null and not public.is_platform_admin() then
      raise exception 'Không có quyền thay đổi quyền quản trị nền tảng.';
    end if;
  end if;
  return new;
end;
$$;

-- ============================================================
-- 4. TRIGGERS
-- ============================================================

-- 4.1 updated_at cho mọi bảng có cột updated_at
drop trigger if exists trg_set_updated_at on public.profiles;
create trigger trg_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_set_updated_at on public.churches;
create trigger trg_set_updated_at
  before update on public.churches
  for each row execute function public.set_updated_at();

drop trigger if exists trg_set_updated_at on public.church_members;
create trigger trg_set_updated_at
  before update on public.church_members
  for each row execute function public.set_updated_at();

drop trigger if exists trg_set_updated_at on public.programs;
create trigger trg_set_updated_at
  before update on public.programs
  for each row execute function public.set_updated_at();

drop trigger if exists trg_set_updated_at on public.sections;
create trigger trg_set_updated_at
  before update on public.sections
  for each row execute function public.set_updated_at();

drop trigger if exists trg_set_updated_at on public.slides;
create trigger trg_set_updated_at
  before update on public.slides
  for each row execute function public.set_updated_at();

drop trigger if exists trg_set_updated_at on public.present_sessions;
create trigger trg_set_updated_at
  before update on public.present_sessions
  for each row execute function public.set_updated_at();

-- 4.2 Tạo hội thánh → người tạo thành owner
drop trigger if exists trg_handle_new_church on public.churches;
create trigger trg_handle_new_church
  after insert on public.churches
  for each row execute function public.handle_new_church();

-- 4.3 Chặn tự leo thang is_platform_admin
drop trigger if exists trg_prevent_admin_escalation on public.profiles;
create trigger trg_prevent_admin_escalation
  before update on public.profiles
  for each row execute function public.prevent_admin_escalation();

-- 4.4 Đăng ký auth mới → tự tạo profiles
drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 5. ROW LEVEL SECURITY (theo CONTRACT 3.14)
-- Nhiều policy trên 1 bảng được OR với nhau.
-- ============================================================

-- ---------- profiles ----------
alter table public.profiles enable row level security;

-- Đọc: chính mình, hoặc platform admin, hoặc owner/admin của hội thánh chung
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select using (
  id = auth.uid()
  or public.is_platform_admin()
  or exists (
    select 1
    from public.church_members m1
    join public.church_members m2 on m2.church_id = m1.church_id
    where m1.user_id = auth.uid()
      and m1.role in ('owner', 'admin')
      and m2.user_id = profiles.id
  )
);

-- Sửa: chỉ chính mình (trigger trg_prevent_admin_escalation chặn leo thang quyền)
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
for update using (id = auth.uid())
with check (id = auth.uid());

-- Ghi chú: row profiles được tạo tự động bởi trigger trg_handle_new_user
-- (SECURITY DEFINER, bypass RLS) nên không cần policy INSERT.

-- ---------- churches ----------
alter table public.churches enable row level security;

-- Đọc: thành viên hội thánh, hoặc platform admin
drop policy if exists churches_select on public.churches;
create policy churches_select on public.churches
for select using (
  public.user_church_role(id) is not null
  or public.is_platform_admin()
);

-- Tạo: user đăng nhập, created_by phải là chính mình
-- (trigger trg_handle_new_church sẽ thêm người tạo làm owner)
drop policy if exists churches_insert on public.churches;
create policy churches_insert on public.churches
for insert with check (created_by = auth.uid());

-- Sửa: admin trở lên (>=4)
drop policy if exists churches_update on public.churches;
create policy churches_update on public.churches
for update using (public.role_rank(public.user_church_role(id)) >= 4);

-- Xóa: chỉ owner (=5)
drop policy if exists churches_delete on public.churches;
create policy churches_delete on public.churches
for delete using (public.role_rank(public.user_church_role(id)) = 5);

-- ---------- church_members ----------
alter table public.church_members enable row level security;

-- Đọc: thành viên cùng hội thánh
drop policy if exists church_members_select on public.church_members;
create policy church_members_select on public.church_members
for select using (public.user_church_role(church_id) is not null);

-- Thêm: admin trở lên (>=4) của đúng hội thánh đó
drop policy if exists church_members_insert on public.church_members;
create policy church_members_insert on public.church_members
for insert with check (public.role_rank(public.user_church_role(church_id)) >= 4);

-- Sửa vai trò: admin trở lên (>=4)
drop policy if exists church_members_update on public.church_members;
create policy church_members_update on public.church_members
for update using (public.role_rank(public.user_church_role(church_id)) >= 4)
with check (public.role_rank(public.user_church_role(church_id)) >= 4);

-- Xóa bởi admin trở lên (>=4)
drop policy if exists church_members_delete_admin on public.church_members;
create policy church_members_delete_admin on public.church_members
for delete using (public.role_rank(public.user_church_role(church_id)) >= 4);

-- Tự rời hội thánh: user được xóa chính membership của mình
-- (trường hợp owner duy nhất: app chặn ở phía client)
drop policy if exists church_members_delete_self on public.church_members;
create policy church_members_delete_self on public.church_members
for delete using (user_id = auth.uid());

-- ---------- programs ----------
alter table public.programs enable row level security;

-- Đọc: thành viên hội thánh
drop policy if exists programs_select on public.programs;
create policy programs_select on public.programs
for select using (public.user_church_role(church_id) is not null);

-- Thêm/Sửa: editor trở lên (>=3)
drop policy if exists programs_insert on public.programs;
create policy programs_insert on public.programs
for insert with check (public.role_rank(public.user_church_role(church_id)) >= 3);

drop policy if exists programs_update on public.programs;
create policy programs_update on public.programs
for update using (public.role_rank(public.user_church_role(church_id)) >= 3);

-- Xóa: admin trở lên (>=4)
drop policy if exists programs_delete on public.programs;
create policy programs_delete on public.programs
for delete using (public.role_rank(public.user_church_role(church_id)) >= 4);

-- ---------- sections (quyền kiểm tra qua program → church) ----------
alter table public.sections enable row level security;

drop policy if exists sections_select on public.sections;
create policy sections_select on public.sections
for select using (
  public.user_church_role((select church_id from public.programs where id = program_id)) is not null
);

drop policy if exists sections_insert on public.sections;
create policy sections_insert on public.sections
for insert with check (
  public.role_rank(public.user_church_role((select church_id from public.programs where id = program_id))) >= 3
);

drop policy if exists sections_update on public.sections;
create policy sections_update on public.sections
for update using (
  public.role_rank(public.user_church_role((select church_id from public.programs where id = program_id))) >= 3
);

drop policy if exists sections_delete on public.sections;
create policy sections_delete on public.sections
for delete using (
  public.role_rank(public.user_church_role((select church_id from public.programs where id = program_id))) >= 4
);

-- ---------- slides (quyền kiểm tra qua program → church) ----------
alter table public.slides enable row level security;

drop policy if exists slides_select on public.slides;
create policy slides_select on public.slides
for select using (
  public.user_church_role((select church_id from public.programs where id = program_id)) is not null
);

drop policy if exists slides_insert on public.slides;
create policy slides_insert on public.slides
for insert with check (
  public.role_rank(public.user_church_role((select church_id from public.programs where id = program_id))) >= 3
);

drop policy if exists slides_update on public.slides;
create policy slides_update on public.slides
for update using (
  public.role_rank(public.user_church_role((select church_id from public.programs where id = program_id))) >= 3
);

drop policy if exists slides_delete on public.slides;
create policy slides_delete on public.slides
for delete using (
  public.role_rank(public.user_church_role((select church_id from public.programs where id = program_id))) >= 4
);

-- ---------- program_assets (quyền theo church_id trực tiếp) ----------
alter table public.program_assets enable row level security;

drop policy if exists program_assets_select on public.program_assets;
create policy program_assets_select on public.program_assets
for select using (public.user_church_role(church_id) is not null);

drop policy if exists program_assets_insert on public.program_assets;
create policy program_assets_insert on public.program_assets
for insert with check (public.role_rank(public.user_church_role(church_id)) >= 3);

drop policy if exists program_assets_update on public.program_assets;
create policy program_assets_update on public.program_assets
for update using (public.role_rank(public.user_church_role(church_id)) >= 3);

drop policy if exists program_assets_delete on public.program_assets;
create policy program_assets_delete on public.program_assets
for delete using (public.role_rank(public.user_church_role(church_id)) >= 3);

-- ---------- program_versions ----------
alter table public.program_versions enable row level security;

-- Đọc: thành viên hội thánh (qua program)
drop policy if exists program_versions_select on public.program_versions;
create policy program_versions_select on public.program_versions
for select using (
  public.user_church_role((select church_id from public.programs where id = program_id)) is not null
);

-- Thêm: editor trở lên (>=3), created_by phải là chính mình. Không sửa/xóa.
drop policy if exists program_versions_insert on public.program_versions;
create policy program_versions_insert on public.program_versions
for insert with check (
  public.role_rank(public.user_church_role((select church_id from public.programs where id = program_id))) >= 3
  and created_by = auth.uid()
);

-- ---------- invitations ----------
alter table public.invitations enable row level security;

-- Đọc: admin+ của hội thánh, hoặc chính người được mời (khớp email trong JWT)
drop policy if exists invitations_select on public.invitations;
create policy invitations_select on public.invitations
for select using (
  public.role_rank(public.user_church_role(church_id)) >= 4
  or email = (auth.jwt() ->> 'email')
);

-- Quản lý (thêm/sửa/xóa/thu hồi): admin trở lên (>=4)
drop policy if exists invitations_insert on public.invitations;
create policy invitations_insert on public.invitations
for insert with check (public.role_rank(public.user_church_role(church_id)) >= 4);

drop policy if exists invitations_update on public.invitations;
create policy invitations_update on public.invitations
for update using (public.role_rank(public.user_church_role(church_id)) >= 4);

drop policy if exists invitations_delete on public.invitations;
create policy invitations_delete on public.invitations
for delete using (public.role_rank(public.user_church_role(church_id)) >= 4);

-- ---------- audit_logs ----------
alter table public.audit_logs enable row level security;

-- Đọc: admin trở lên (>=4). Không policy UPDATE/DELETE → bất biến.
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
for select using (public.role_rank(public.user_church_role(church_id)) >= 4);

-- Thêm: chính mình ghi (actor_id = auth.uid()) và là thành viên hội thánh
drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs
for insert with check (
  actor_id = auth.uid()
  and public.user_church_role(church_id) is not null
);

-- ---------- present_sessions ----------
-- Điều khiển từ xa yêu cầu đăng nhập + presenter trở lên (>=2) của đúng hội thánh
alter table public.present_sessions enable row level security;

drop policy if exists present_sessions_select on public.present_sessions;
create policy present_sessions_select on public.present_sessions
for select using (public.role_rank(public.user_church_role(church_id)) >= 2);

drop policy if exists present_sessions_insert on public.present_sessions;
create policy present_sessions_insert on public.present_sessions
for insert with check (public.role_rank(public.user_church_role(church_id)) >= 2);

drop policy if exists present_sessions_update on public.present_sessions;
create policy present_sessions_update on public.present_sessions
for update using (public.role_rank(public.user_church_role(church_id)) >= 2);

drop policy if exists present_sessions_delete on public.present_sessions;
create policy present_sessions_delete on public.present_sessions
for delete using (public.role_rank(public.user_church_role(church_id)) >= 2);

-- ============================================================
-- 6. STORAGE (theo CONTRACT 3.12)
-- Đường dẫn file có dạng <church_id>/... ; segment đầu = church_id
-- ============================================================

-- Tạo 2 buckets (idempotent)
insert into storage.buckets (id, name, public)
values
  ('church-logos', 'church-logos', true),
  ('program-images', 'program-images', false)
on conflict (id) do update set public = excluded.public;

-- ---------- bucket church-logos: đọc công khai; ghi: admin+ ----------
drop policy if exists "church-logos public read" on storage.objects;
create policy "church-logos public read" on storage.objects
for select using (bucket_id = 'church-logos');

drop policy if exists "church-logos admin insert" on storage.objects;
create policy "church-logos admin insert" on storage.objects
for insert with check (
  bucket_id = 'church-logos'
  and auth.role() = 'authenticated'
  and public.role_rank(public.user_church_role(((storage.foldername(name))[1])::uuid)) >= 4
);

drop policy if exists "church-logos admin update" on storage.objects;
create policy "church-logos admin update" on storage.objects
for update using (
  bucket_id = 'church-logos'
  and auth.role() = 'authenticated'
  and public.role_rank(public.user_church_role(((storage.foldername(name))[1])::uuid)) >= 4
)
with check (
  bucket_id = 'church-logos'
  and auth.role() = 'authenticated'
  and public.role_rank(public.user_church_role(((storage.foldername(name))[1])::uuid)) >= 4
);

drop policy if exists "church-logos admin delete" on storage.objects;
create policy "church-logos admin delete" on storage.objects
for delete using (
  bucket_id = 'church-logos'
  and auth.role() = 'authenticated'
  and public.role_rank(public.user_church_role(((storage.foldername(name))[1])::uuid)) >= 4
);

-- ---------- bucket program-images: private; đọc: thành viên; ghi: editor+ ----------
drop policy if exists "program-images member read" on storage.objects;
create policy "program-images member read" on storage.objects
for select using (
  bucket_id = 'program-images'
  and public.user_church_role(((storage.foldername(name))[1])::uuid) is not null
);

drop policy if exists "program-images editor insert" on storage.objects;
create policy "program-images editor insert" on storage.objects
for insert with check (
  bucket_id = 'program-images'
  and auth.role() = 'authenticated'
  and public.role_rank(public.user_church_role(((storage.foldername(name))[1])::uuid)) >= 3
);

drop policy if exists "program-images editor update" on storage.objects;
create policy "program-images editor update" on storage.objects
for update using (
  bucket_id = 'program-images'
  and auth.role() = 'authenticated'
  and public.role_rank(public.user_church_role(((storage.foldername(name))[1])::uuid)) >= 3
)
with check (
  bucket_id = 'program-images'
  and auth.role() = 'authenticated'
  and public.role_rank(public.user_church_role(((storage.foldername(name))[1])::uuid)) >= 3
);

drop policy if exists "program-images editor delete" on storage.objects;
create policy "program-images editor delete" on storage.objects
for delete using (
  bucket_id = 'program-images'
  and auth.role() = 'authenticated'
  and public.role_rank(public.user_church_role(((storage.foldername(name))[1])::uuid)) >= 3
);

-- ============================================================
-- 7. VIEW v_program_stats (theo CONTRACT 3.13)
-- ============================================================
create or replace view public.v_program_stats as
select
  p.id as program_id,
  (select count(*) from public.slides s where s.program_id = p.id) as slide_count,
  (select count(*) from public.sections sc where sc.program_id = p.id) as section_count,
  p.updated_at as updated_at
from public.programs p;

grant select on public.v_program_stats to authenticated;

-- ============================================================
-- 8. REALTIME cho present_sessions (điều khiển từ xa, CONTRACT 9)
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'present_sessions'
  ) then
    alter publication supabase_realtime add table public.present_sessions;
  end if;
end $$;

-- ============================================================
-- 9. KIỂM TRA NHANH (chỉ đọc — an toàn khi chạy lại)
-- ============================================================
-- Danh sách bảng đã tạo:
select tablename from pg_tables where schemaname = 'public' order by tablename;

-- RLS đã bật cho mọi bảng private:
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles','churches','church_members','programs','sections',
                    'slides','program_assets','program_versions','invitations',
                    'audit_logs','present_sessions')
order by tablename;

-- Policies đã tạo:
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
