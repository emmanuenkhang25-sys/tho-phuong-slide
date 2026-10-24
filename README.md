# Thờ Phượng Slide — Nền tảng thờ phượng Tin Lành đa Hội thánh

Ứng dụng web giúp các Hội thánh / Điểm nhóm Tin Lành tại Việt Nam quản lý chương trình thờ phượng:
tạo & biên tập slide, trình chiếu toàn màn hình, điều khiển bằng điện thoại,
xuất PowerPoint/PDF, làm việc offline và đồng bộ đám mây.

## Cấu trúc repo

```
tho-phuong-slide/
├── CONTRACT.md          # Hợp đồng kỹ thuật chuẩn (DB, types, modules, routes) — đọc trước khi code
├── .env.example         # Mẫu biến môi trường (không chứa secret thật)
├── apps/web/            # Frontend: React + TypeScript + Vite + Tailwind + Zustand + Dexie + PWA
├── supabase/            # schema.sql (tables + RLS + storage), seed.sql (DEMO), README
└── docs/                # Tài liệu tiếng Việt: cài đặt, Supabase, deploy Vercel, sao lưu, báo cáo kiểm thử
```

## Bắt đầu nhanh

1. Đọc `CONTRACT.md`.
2. Tạo project tại https://supabase.com → chạy `supabase/schema.sql` trong SQL Editor
   (chi tiết: `docs/huong-dan-supabase.md`).
3. `cd apps/web && cp ../../.env.example .env` → điền `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. `npm install && npm run dev`.
5. Deploy: xem `docs/huong-dan-deploy-vercel.md`.

## Trạng thái kiểm thử

Xem `docs/bao-cao-kiem-thu.md` — liệt kê trung thực từng tiêu chí nghiệm thu:
ĐẠT / CHƯA KIỂM THỬ ĐƯỢC (cần Supabase thật) / CHƯA LÀM. Không giả lập thành công.

> Dữ liệu trong `supabase/seed.sql` là **dữ liệu DEMO**, được đánh dấu rõ, chỉ dùng để thử nghiệm —
> không phải dữ liệu chính thức.
