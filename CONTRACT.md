# CONTRACT.md — Hợp đồng kỹ thuật chuẩn cho toàn dự án Thờ Phượng Slide

Tài liệu này là **chuẩn duy nhất** mọi subagent phải tuân thủ. Không tự ý đổi tên bảng/cột/API.
DB subagent triển khai SQL đúng contract này; các subagent web code đúng contract này.
Mọi text UI: **tiếng Việt**. Không nút giả — nút nào cũng phải có hành động thật.

## 1. Kiến trúc tổng thể

- Monorepo: `apps/web` (React + TS + Vite + Tailwind + Zustand + Dexie + vite-plugin-pwa),
  `supabase/` (SQL), `docs/` (tiếng Việt).
- Backend: Supabase (Auth + Postgres + Storage + Realtime). Không secret trong code frontend.
- Điều khiển từ xa: **qua Supabase Realtime** (cần Internet cả 2 thiết bị), KHÔNG giả lập WebSocket LAN.

## 2. Vai trò (roles) — dùng nhất quán mọi nơi

`owner` (Chủ sở hữu) > `admin` (Quản trị viên) > `editor` (Biên tập viên) >
`presenter` (Người trình chiếu) > `viewer` (Người chỉ xem).

Thứ bậc số (roleRank): owner=5, admin=4, editor=3, presenter=2, viewer=1, none=0.
- Quản lý chương trình/slide/tài nguyên: `editor` trở lên (>=3)
- Xóa chương trình, quản lý thành viên/mời/thu hồi: `admin` trở lên (>=4); xóa hội thánh/chuyển ownership: `owner` (=5)
- Mở & chạy trình chiếu, điều khiển từ xa: `presenter` trở lên (>=2)
- Xem: `viewer` trở lên (>=1)

## 3. Schema cơ sở dữ liệu (Postgres / Supabase)

Kiểu UUID dùng `gen_random_uuid()`. Thời gian: `timestamptz DEFAULT now()`.
Mọi bảng private bật **RLS**. Khóa kiểm tra quyền ở **server (RLS)**, không chỉ ẩn nút.

### 3.1 profiles
| cột | kiểu | ghi chú |
|---|---|---|
| id | uuid PK | REFERENCES auth.users(id) ON DELETE CASCADE |
| email | text NOT NULL | |
| display_name | text | |
| avatar_url | text | |
| is_platform_admin | boolean DEFAULT false | chỉ server/quản trị nền tảng set |
| created_at / updated_at | timestamptz | |

### 3.2 churches
| cột | kiểu | ghi chú |
|---|---|---|
| id | uuid PK DEFAULT gen_random_uuid() | |
| name | text NOT NULL | tên Hội thánh / Điểm nhóm |
| logo_url | text | |
| avatar_url | text | |
| contact_info | text | |
| settings | jsonb DEFAULT '{}' | cài đặt trình chiếu riêng của hội thánh |
| created_by | uuid REFERENCES profiles(id) | |
| created_at / updated_at | timestamptz | |

### 3.3 church_members
| cột | kiểu | ghi chú |
|---|---|---|
| id | uuid PK DEFAULT gen_random_uuid() | |
| church_id | uuid NOT NULL REFERENCES churches(id) ON DELETE CASCADE | index |
| user_id | uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE | index |
| role | text NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner','admin','editor','presenter','viewer')) | |
| invited_by | uuid REFERENCES profiles(id) | |
| joined_at | timestamptz DEFAULT now() | |
| created_at / updated_at | timestamptz | |
| UNIQUE(church_id, user_id) | | |

### 3.4 programs
| cột | kiểu | ghi chú |
|---|---|---|
| id | uuid PK DEFAULT gen_random_uuid() | |
| church_id | uuid NOT NULL REFERENCES churches(id) ON DELETE CASCADE | index |
| title | text NOT NULL DEFAULT 'Chương trình mới' | |
| event_date | date | ngày tổ chức |
| start_time | time | giờ bắt đầu |
| leader | text | người phụ trách |
| theme | text | chủ đề |
| theme_verse | text | câu Kinh Thánh chủ đề |
| notes | text | ghi chú nội bộ |
| design_template | jsonb DEFAULT '{}' | bộ mẫu thiết kế đã chọn |
| aspect_ratio | text NOT NULL DEFAULT '16:9' CHECK (aspect_ratio IN ('16:9','4:3')) | |
| status | text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','archived','deleted')) | |
| is_favorite | boolean DEFAULT false | |
| created_by / updated_by | uuid REFERENCES profiles(id) | |
| created_at / updated_at | timestamptz | |
| deleted_at | timestamptz | xóa mềm |
| index (church_id, status), (church_id, event_date) | | |

### 3.5 sections
| cột | kiểu | ghi chú |
|---|---|---|
| id | uuid PK DEFAULT gen_random_uuid() | |
| program_id | uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE | |
| title | text NOT NULL | tên mục, VD "Hát thờ phượng" |
| kind | text NOT NULL DEFAULT 'custom' | xem 3.5.1 |
| order_index | int NOT NULL DEFAULT 0 | |
| created_at / updated_at | timestamptz | |
| index (program_id, order_index) | | |

#### 3.5.1 kind của section (dùng chung cho select mục)
`don-tiep` (Đón tiếp), `khai-mac` (Khai mạc), `cau-nguyen` (Cầu nguyện),
`hat-tho-phuong` (Hát thờ phượng), `thanh-ca` (Thánh ca), `kinh-thanh` (Kinh Thánh),
`loi-chung` (Lời chứng), `dang-hien` (Dâng hiến), `thong-bao` (Thông báo),
`bai-giang` (Bài giảng), `tiec-thanh` (Tiệc Thánh), `cau-thay` (Cầu thay),
`be-mac` (Bế mạc), `custom` (Tự thêm).

### 3.6 slides — content JSONB (hình dạng chuẩn, editor/export/presenter dùng chung)
| cột | kiểu | ghi chú |
|---|---|---|
| id | uuid PK DEFAULT gen_random_uuid() | |
| program_id | uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE | |
| section_id | uuid REFERENCES sections(id) ON DELETE SET NULL | |
| order_index | int NOT NULL DEFAULT 0 | thứ tự trong toàn chương trình |
| content | jsonb NOT NULL DEFAULT '{}' | xem 3.6.1 |
| background | jsonb NOT NULL DEFAULT '{}' | xem 3.6.2 |
| created_at / updated_at | timestamptz | |
| index (program_id, order_index), (section_id, order_index) | | |

#### 3.6.1 content.objects[] — tọa độ % (0–100) so với slide
```ts
interface SlideObject {
  id: string;                 // uuid client-side
  type: 'text' | 'image' | 'shape';
  x: number; y: number; w: number; h: number;  // % slide
  z?: number;                 // thứ tự lớp
  // text:
  text?: string; fontFamily?: string; fontSize?: number; // px ở slide 960px
  color?: string; bold?: boolean; italic?: boolean;
  align?: 'left'|'center'|'right'; lineHeight?: number;
  // image:
  src?: string;               // program_assets.file_path hoặc dataURL (offline)
  // shape:
  shape?: 'rect'|'ellipse'|'line'; fill?: string;
  stroke?: string; strokeWidth?: number; opacity?: number;
}
```

#### 3.6.2 background
```ts
interface SlideBackground {
  type: 'color' | 'image' | 'gradient';
  color?: string;                       // VD '#1e3a5f'
  image?: string;                       // file_path hoặc dataURL
  gradient?: { from: string; to: string; angle: number };
  overlayOpacity?: number;              // 0–1 lớp phủ tối cho chữ dễ đọc
}
```

### 3.7 program_assets
| cột | kiểu | ghi chú |
|---|---|---|
| id | uuid PK DEFAULT gen_random_uuid() | |
| church_id | uuid NOT NULL REFERENCES churches(id) ON DELETE CASCADE | |
| program_id | uuid REFERENCES programs(id) ON DELETE SET NULL | |
| kind | text DEFAULT 'image' | |
| file_path | text NOT NULL | đường dẫn trong bucket `program-images` |
| file_url | text | URL công khai/tạm (nếu có) |
| file_size | int | bytes |
| mime | text | |
| width / height | int | |
| uploaded_by | uuid REFERENCES profiles(id) | |
| created_at | timestamptz | |

### 3.8 program_versions (lịch sử phiên bản)
| cột | kiểu | ghi chú |
|---|---|---|
| id | uuid PK DEFAULT gen_random_uuid() | |
| program_id | uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE | index (program_id, created_at DESC) |
| snapshot | jsonb NOT NULL | toàn bộ {program, sections[], slides[]} |
| created_by | uuid REFERENCES profiles(id) | |
| note | text | VD "Tự động lưu trước khi giải quyết xung đột" |
| created_at | timestamptz DEFAULT now() | |

### 3.9 invitations
| cột | kiểu | ghi chú |
|---|---|---|
| id | uuid PK DEFAULT gen_random_uuid() | |
| church_id | uuid NOT NULL REFERENCES churches(id) ON DELETE CASCADE | |
| email | text NOT NULL | |
| role | text NOT NULL DEFAULT 'viewer' CHECK (role IN (...5 vai trò...)) | |
| token | text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24),'hex') | |
| invited_by | uuid REFERENCES profiles(id) | |
| accepted_at | timestamptz | |
| expires_at | timestamptz DEFAULT now() + interval '7 days' | |
| created_at | timestamptz | |

### 3.10 audit_logs
| cột | kiểu | ghi chú |
|---|---|---|
| id | bigserial PK | |
| church_id | uuid REFERENCES churches(id) ON DELETE CASCADE | index (church_id, created_at DESC) |
| actor_id | uuid REFERENCES profiles(id) | |
| action | text NOT NULL | VD 'program.create','member.remove','program.export' |
| entity | text | VD 'program' |
| entity_id | text | |
| detail | jsonb DEFAULT '{}' | |
| created_at | timestamptz DEFAULT now() | |

### 3.11 present_sessions (phiên trình chiếu + điều khiển từ xa)
| cột | kiểu | ghi chú |
|---|---|---|
| id | uuid PK DEFAULT gen_random_uuid() | |
| program_id | uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE | |
| church_id | uuid NOT NULL REFERENCES churches(id) ON DELETE CASCADE | |
| code | text NOT NULL UNIQUE | mã ghép nối 6 ký tự [A-Z0-9], hết hạn 24h |
| expires_at | timestamptz NOT NULL DEFAULT now() + interval '24 hours' | |
| current_slide | int NOT NULL DEFAULT 0 | index slide hiện tại |
| state | text NOT NULL DEFAULT 'live' CHECK (state IN ('live','paused','blank','ended')) | |
| created_by | uuid REFERENCES profiles(id) | |
| created_at / updated_at | timestamptz | |
| index (code), (program_id) | | |

### 3.12 Storage buckets
- `church-logos`: public read; upload/ghi: thành viên `admin`+ của hội thánh (đường dẫn `<church_id>/...`).
- `program-images`: private; đọc: thành viên hội thánh; upload/xóa: `editor`+ (đường dẫn `<church_id>/...`).

### 3.13 Functions & triggers (DB subagent triển khai)
- `public.user_church_role(p_church_id uuid) RETURNS text` — SECURITY DEFINER, STABLE.
- `public.role_rank(r text) RETURNS int`.
- `set_updated_at()` trigger cho mọi bảng có `updated_at`.
- Trigger sau khi tạo church: tự thêm `created_by` làm `owner` trong church_members.
- Trigger chặn leo thang `profiles.is_platform_admin` (chỉ platform admin hiện tại được đổi).
- View `v_program_stats(program_id, slide_count, section_count, updated_at)`.

### 3.14 RLS tóm tắt (chi tiết trong supabase/schema.sql)
- profiles: đọc chính mình; owner/admin đọc profile thành viên cùng hội thánh; sửa chính mình.
- churches: đọc = thành viên; tạo = authenticated (created_by = auth.uid()); sửa = admin+; xóa = owner.
- church_members: đọc = thành viên cùng hội thánh; thêm/sửa/xóa = admin+; user được tự rời (xóa chính mình, trừ khi là owner duy nhất — app chặn).
- programs/sections/slides/program_assets: đọc = thành viên; thêm/sửa = editor+; xóa = admin+.
- program_versions: đọc = thành viên; thêm = editor+.
- invitations: quản lý = admin+; người được mời (email trùng) được đọc lời mời của mình.
- audit_logs: đọc = admin+; thêm = authenticated với actor_id = auth.uid() và là thành viên.
- present_sessions: đọc/tạo/sửa = presenter+ của đúng hội thánh (điều khiển từ xa yêu cầu đăng nhập + role presenter+).

## 4. TypeScript types chuẩn (apps/web/src/lib/types.ts — web-core tạo, các nhóm khác import)

```ts
type Role = 'owner'|'admin'|'editor'|'presenter'|'viewer';
type AspectRatio = '16:9'|'4:3';
type ProgramStatus = 'draft'|'archived'|'deleted';
interface Profile { id:string; email:string; display_name:string|null; avatar_url:string|null; is_platform_admin:boolean; }
interface Church { id:string; name:string; logo_url:string|null; avatar_url:string|null; contact_info:string|null; settings:Record<string,any>; created_by:string|null; }
interface ChurchMember { id:string; church_id:string; user_id:string; role:Role; joined_at:string; profile?:Profile; }
interface Program { id:string; church_id:string; title:string; event_date:string|null; start_time:string|null; leader:string|null; theme:string|null; theme_verse:string|null; notes:string|null; design_template:Record<string,any>; aspect_ratio:AspectRatio; status:ProgramStatus; is_favorite:boolean; created_by:string|null; updated_by:string|null; created_at:string; updated_at:string; }
interface Section { id:string; program_id:string; title:string; kind:string; order_index:number; }
interface Slide { id:string; program_id:string; section_id:string|null; order_index:number; content:{objects:SlideObject[]}; background:SlideBackground; }
interface PresentSession { id:string; program_id:string; church_id:string; code:string; expires_at:string; current_slide:number; state:'live'|'paused'|'blank'|'ended'; }
```
`SlideObject`, `SlideBackground` như mục 3.6.1/3.6.2.

## 5. Shared modules (web-core tạo — các nhóm khác CHỈ import, KHÔNG sửa)

- `src/lib/supabase.ts` → `export const supabase` (đọc VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
- `src/lib/types.ts` → các interface mục 4.
- `src/lib/permissions.ts` → `roleRank(r)`, `hasRole(myRole, min)`, `canEditProgram`, `canManageMembers`, `canPresent`, `canDeleteProgram`, `canManageChurch`.
- `src/lib/dexie.ts` → `db` (Dexie) + helpers:
  - tables: `drafts` (keyPath `programId`: {programId, churchId, data:{program,sections,slides}, updatedAt, dirty}),
    `sync_queue` (++id: {op, table, rowId, payload, createdAt}),
    `assets_cache` (keyPath `path`: {path, dataUrl}).
  - `saveDraft(d)`, `getDraft(programId)`, `clearDraft(programId)`, `enqueueSync(op)`, `dequeueSync()`.
- `src/stores/auth.tsx` → `useAuth()` = { user, profile, loading, signIn, signUp, signOut, sendPasswordReset, updatePassword, refreshProfile }.
- `src/stores/church.tsx` → `useChurch()` = { churches, currentChurch, setCurrentChurch, members, myRole, loading, refresh }.
- `src/components/ui.tsx` → Button, Input, TextArea, Select, Modal, Toast/useToast, Spinner, EmptyState, ConfirmDialog.
- `src/components/Layout.tsx` → App shell: sidebar/nav (Tổng quan, Hội thánh, Mẫu slide, Sao lưu, Hướng dẫn, Cài đặt), church switcher, dark/light toggle, sync status chip.
- `src/app/router.tsx` + `src/app/featureRoutes.ts`:
  `export const featureRoutes: RouteObject[] = []; // COORDINATOR merge tại đây`
  Các nhóm tính năng tạo `src/features/<ten>/routes.tsx` export `<ten>Routes: RouteObject[]`.
  Quy tắc: **không nhóm nào được sửa file ngoài thư mục của mình** (trừ tests/docs khi fix build).

## 6. Phân định routes

| route | nhóm sở hữu | mô tả |
|---|---|---|
| `/`, `/dang-nhap`, `/dang-ky`, `/quen-mat-khau`, `/dat-lai-mat-khau` | web-core | landing + auth |
| `/dashboard` | web-core | tổng quan |
| `/hoi-thanh` | web-core | quản lý hội thánh + thành viên + mời |
| `/cai-dat` | web-core | cài đặt cá nhân + hội thánh |
| `/chuong-trinh/:id` | editor | trình biên tập slide |
| `/trinh-chieu/:id` | presenter | trình chiếu fullscreen |
| `/dieu-khien` | presenter | remote bằng điện thoại (nhập mã + QR) |
| `/mau-slide` | presenter | thư viện mẫu |
| `/sao-luu` | export/admin | sao lưu, phiên bản, khôi phục |
| `/quan-tri` | export/admin | quản trị nền tảng |
| `/huong-dan` | export/admin | hướng dẫn + FAQ |

## 7. Chuẩn export

- PPTX (PptxGenJS): layout 16:9 = 10×5.625in, 4:3 = 10×7.5in; textbox **chỉnh sửa được**; map % → inch; giữ thứ tự slide, text, màu nền.
- PDF: render slide → canvas → jsPDF, **ghi rõ trong UI/docs: PDF dạng ảnh raster** (tiếng Việt an toàn vì là ảnh).
- Backup JSON: `{version:1, exportedAt, program, sections, slides, assets_manifest}`; import kiểm tra version + church sở hữu.

## 8. Chuẩn sync/offline

- Autosave debounce ~2s vào Dexie `drafts`; trạng thái lưu hiển thị đúng:
  `Đang lưu…` → `Đã lưu trên máy` → `Đã lưu trên đám mây` (chỉ khi server xác nhận) / `Ngoại tuyến — sẽ đồng bộ` / `Lỗi đồng bộ`.
- Xung đột: so `updated_at`; giữ bản mới hơn; banner cho user chọn [Giữ bản của tôi]/[Lấy bản máy chủ]; trước khi ghi đè, lưu snapshot vào `program_versions`.
- Không xóa draft local trước khi server xác nhận.

## 9. Remote control protocol (Supabase Realtime)

- PC tạo `present_sessions` (code 6 ký tự, hết hạn 24h), mở `/trinh-chieu/:id?session=<id>`, subscribe channel `present:<code>`.
- Điện thoại đăng nhập → `/dieu-khien` → nhập mã → đọc row (RLS: presenter+ đúng hội thánh) → join channel → gửi broadcast `{event:'cmd', payload:{action:'next'|'prev'|'goto'|'pause'|'resume'|'blank'|'unblank'|'end', slideIndex?}}`.
- PC nhận → áp dụng + cập nhật `current_slide` (throttle) để thiết bị vào sau đồng bộ; PC broadcast `{event:'state', payload:{current_slide, state}}`.
- Hủy ghép nối: PC xóa/đóng session (state='ended'); điện thoại có nút "Ngắt kết nối".
- Docs ghi rõ: **cần Internet cả 2 thiết bị** (qua Supabase), không phải LAN.

## 10. Quy ước code

- Tiếng Việt toàn bộ UI; responsive + touch-friendly (tap target ≥44px); tương phản tốt; dark/light mode.
- Không hotlink ảnh ngoài không phép: mẫu slide dùng CSS gradient/pattern tự vẽ.
- Không animation rườm rà. Phím tắt editor + trình chiếu theo spec.
- `npm run build` phải pass; vitest cho logic thuần (split lyrics/bible, validators, permissions).

## 11. Phụ lục: hợp đồng liên-nhóm (cross-group component contracts)

Các file này do đúng **một** nhóm tạo; nhóm khác chỉ import theo đúng signature:

- `src/components/RequireAuth.tsx` (nhóm **web-core**):
  `export function RequireAuth({ children }: { children: React.ReactNode })`
  Chưa đăng nhập → chuyển về `/dang-nhap`.
- `src/stores/sync.ts` (nhóm **web-core**):
  `export const useSyncStatus: () => { status: 'dang-luu'|'da-luu-may'|'da-dong-bo'|'ngoai-tuyen'|'loi'; message: string; setStatus: (s, m?) => void }`
  (zustand). Editor/export cập nhật trạng thái qua store này; Layout hiển thị chip.
- `src/features/editor/components/SlideRenderer.tsx` (nhóm **editor**):
  `export function SlideRenderer({ slide, width }: { slide: Slide; width: number })`
  Render thuần (div/SVG, không side-effect) đúng tỉ lệ aspect của slide — nhóm export/presenter import để xuất PDF và trình chiếu.
- `src/features/export/components/ExportMenu.tsx` (nhóm **export**):
  `export function ExportMenu({ program, sections, slides }: { program: Program; sections: Section[]; slides: Slide[] })`
  Nút "Xuất" với menu: PowerPoint (.pptx), PDF, Sao lưu JSON. Nhóm editor để sẵn comment
  `{/* COORDINATOR: gắn ExportMenu tại đây */}` trong toolbar — coordinator gắn khi hợp nhất.
- Mọi nhóm: **không sửa file ngoài thư mục được giao** (ngoại trừ nhóm tests/docs/integration khi fix build).
