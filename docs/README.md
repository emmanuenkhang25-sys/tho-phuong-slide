# Thờ Phượng Slide — Tài liệu

Nền tảng web giúp các Hội thánh / Điểm nhóm Tin Lành tại Việt Nam tạo và quản lý
slide thờ phượng: biên tập chương trình, trình chiếu toàn màn hình, điều khiển
bằng điện thoại, xuất PowerPoint/PDF, làm việc ngoại tuyến và đồng bộ đám mây.

> **Chuẩn kỹ thuật duy nhất:** [`CONTRACT.md`](../CONTRACT.md) ở thư mục gốc.
> Mọi bảng/cột/API trong tài liệu này đều theo đúng hợp đồng đó.

## Tài liệu trong thư mục này

| File | Nội dung |
|---|---|
| `README.md` | Tổng quan dự án, kiến trúc, cấu trúc thư mục, tính năng, yêu cầu môi trường (file này) |
| `huong-dan-supabase.md` | Tạo project Supabase từng bước: chạy `schema.sql` → migration `accept_invitation` → `seed.sql` (tùy chọn), lấy URL/anon key, Email Auth, Realtime, buckets, cấp platform admin đầu tiên, Google OAuth (ghi rõ chưa triển khai) |
| `huong-dan-deploy-vercel.md` | Deploy lên Vercel: import repo, root directory, build command, env vars, SPA rewrites, PWA |
| `sao-luu-khoi-phuc.md` | Sao lưu JSON, lịch sử phiên bản, khôi phục, lưu ý Point-in-time recovery của Supabase |
| `bao-cao-kiem-thu.md` | **Báo cáo nghiệm thu trung thực**: từng tiêu chí ĐẠT / CHƯA KIỂM THỬ ĐƯỢC / CHƯA LÀM, kèm bằng chứng |

## Kiến trúc

```
┌─────────────────────────────┐      HTTPS / Realtime      ┌──────────────────────────┐
│ apps/web (SPA, PWA)         │ ◄─────────────────────────► │ Supabase               │
│ React 18 + TS + Vite +      │   REST (PostgREST)          │ - Auth (email)         │
│ Tailwind + Zustand + Dexie  │   Realtime (present)        │ - Postgres + RLS       │
│ (draft offline, sync queue) │   Storage (ảnh)             │ - Storage (2 buckets)  │
└─────────────────────────────┘                             └──────────────────────────┘
```

- **Không có backend riêng.** Mọi logic quyền nằm ở **RLS trên Postgres**
  (không chỉ ẩn nút ở client). Frontend chỉ dùng `anon key` — không secret nào
  trong code.
- **Điều khiển từ xa qua Supabase Realtime** (cần Internet cả 2 thiết bị),
  không phải LAN/Wi-Fi nội bộ. PC tạo `present_sessions` (mã 6 ký tự), điện thoại
  nhập mã → join channel `present:<code>` → gửi lệnh `cmd`, nhận trạng thái `state`.
- **Offline-first:** editor tự lưu nháp vào Dexie (IndexedDB) sau ~2s; khi có mạng
  đẩy lên Supabase qua hàng đợi đồng bộ; xung đột được phát hiện bằng `updated_at`
  và luôn có snapshot dự phòng trước khi ghi đè.

## Cấu trúc thư mục

```
tho-phuong-slide/
├── CONTRACT.md                  # Hợp đồng kỹ thuật chuẩn — đọc trước khi đụng code
├── .env.example                 # Mẫu biến môi trường (không chứa secret thật)
├── apps/web/
│   ├── package.json             # scripts: dev / build / preview / test
│   ├── vite.config.ts           # Vite + PWA + vitest (environment: node)
│   ├── vercel.json              # SPA rewrites → /index.html (cho BrowserRouter)
│   └── src/
│       ├── app/                 # router.tsx + featureRoutes.ts (COORDINATOR merge)
│       ├── components/          # ui.tsx, Layout.tsx, RequireAuth.tsx
│       ├── lib/                 # supabase.ts, types.ts, permissions.ts, dexie.ts, ...
│       ├── stores/              # auth.tsx, church.tsx, sync.ts (zustand)
│       ├── pages/               # Landing, DangNhap, DangKy, QuenMatKhau, DatLaiMatKhau,
│       │                        # Dashboard, HoiThanh, CaiDat, LoiMoi, NotFound (web-core)
│       └── features/
│           ├── editor/          # /chuong-trinh/:id — canvas, toolbar, tách bài hát/Kinh Thánh
│           ├── present/         # /trinh-chieu/:id + remoteProtocol.ts (pure, có test)
│           ├── remote/          # /dieu-khien — điều khiển bằng điện thoại
│           ├── templates/       # /mau-slide — thư viện mẫu
│           ├── export/          # ExportMenu (PPTX/PDF/JSON) + lib pptx/pdf/backup/units
│           ├── backup/          # /sao-luu — sao lưu, phiên bản, khôi phục, đồng bộ
│           ├── admin/           # /quan-tri — quản trị nền tảng (is_platform_admin)
│           └── help/            # /huong-dan — hướng dẫn + FAQ (public)
├── supabase/
│   ├── schema.sql               # 11 bảng + RLS + triggers + storage + view + realtime
│   ├── migrations/
│   │   └── 20261024_accept_invitation.sql   # RPC accept_invitation (BẮT BUỘC chạy)
│   ├── seed.sql                 # DỮ LIỆU DEMO — xóa khi dùng thật
│   └── README.md                # Thứ tự chạy SQL + kiểm thử thủ công gợi ý
└── docs/                        # Thư mục này
```

## Tính năng chính

- **Hội thánh đa tenant:** tạo hội thánh, phân 5 vai trò
  (`owner > admin > editor > presenter > viewer`), mời thành viên bằng link email.
- **Trình biên tập slide:** thêm/sửa/xóa/sắp xếp slide và mục, hoàn tác/làm lại,
  tự động chia bài hát & Kinh Thánh thành slide (giữ nguyên 100% nội dung),
  mẫu thiết kế, tỉ lệ 16:9/4:3, kéo-thả đối tượng chữ/ảnh/hình.
- **Tự lưu + đồng bộ:** trạng thái `Đang lưu… → Đã lưu trên máy → Đã lưu trên đám mây`,
  làm việc offline, phát hiện xung đột và cho chọn bản giữ lại.
- **Trình chiếu:** toàn màn hình, phím tắt, điều khiển từ xa bằng điện thoại
  (mã 6 ký tự + QR).
- **Xuất file:** PowerPoint (.pptx, chữ chỉnh sửa được), PDF (dạng ảnh raster —
  tiếng Việt luôn đúng), Sao lưu JSON (`.tpsbackup.json`) để khôi phục.
- **Sao lưu & khôi phục:** lịch sử phiên bản tự động, xem trước, khôi phục 1 chạm.

## Yêu cầu môi trường

| Mục | Yêu cầu |
|---|---|
| Node.js | ≥ 18 (khuyến nghị 20+; máy build dùng Node 24) |
| npm | ≥ 9 |
| Supabase | 1 project (gói Free đủ dùng để bắt đầu) |
| Trình duyệt | Chrome/Edge/Firefox/Safari bản mới (cần IndexedDB cho offline) |
| Mạng | Cần Internet cho đăng nhập/đồng bộ/điều khiển từ xa; soạn slide vẫn chạy offline với bản nháp |

## Bắt đầu nhanh (tóm tắt)

1. Tạo project Supabase và chạy SQL theo `huong-dan-supabase.md`
   (thứ tự: `schema.sql` → `migrations/20261024_accept_invitation.sql` →
   `seed.sql` nếu muốn demo).
2. `cd apps/web && cp ../../.env.example .env`, điền `VITE_SUPABASE_URL` và
   `VITE_SUPABASE_ANON_KEY`.
3. `npm install && npm run dev` — mở http://localhost:5173.
4. Kiểm tra: `npm run build` (tsc + vite build), `npm test` (vitest).
5. Deploy: xem `huong-dan-deploy-vercel.md`.

## Trạng thái kiểm thử (tóm tắt)

- ✅ `npm run build` PASS (tsc 0 lỗi + vite build thành công).
- ✅ `npm test`: **59/59 test xanh** (split lyrics/bible, permissions, backup, remote protocol).
- ⚠️ Chưa kiểm thử được trên Supabase thật (xem `bao-cao-kiem-thu.md`): mọi luồng
  cần server (đăng ký, mời thành viên, đồng bộ, remote qua Realtime...) đều được
  đánh dấu **CHƯA KIỂM THỬ ĐƯỢC** một cách trung thực — không giả lập thành công.
