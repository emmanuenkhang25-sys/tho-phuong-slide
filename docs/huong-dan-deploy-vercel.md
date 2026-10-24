# Hướng dẫn deploy lên Vercel

Deploy frontend `apps/web` (SPA React + Vite) lên Vercel. Backend là Supabase
đã cấu hình riêng theo `huong-dan-supabase.md`.

## Điều kiện trước

- Repo đã push lên GitHub/GitLab/Bitbucket (Vercel import từ git).
- Đã có `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`
  (lấy theo `huong-dan-supabase.md` bước 5).
- File `apps/web/vercel.json` đã có sẵn trong repo — cấu hình SPA rewrites
  (mọi route `/...` đều trả về `index.html` để React Router xử lý).

## Bước 1 — Import project

1. Mở https://vercel.com → đăng nhập → **Add New…** → **Project**.
2. Chọn repo chứa `tho-phuong-slide` → **Import**.

## Bước 2 — Cấu hình build

Tại màn hình **Configure Project**, chỉnh các mục sau (rất quan trọng vì đây là
monorepo — code web nằm trong `apps/web`, không phải thư mục gốc):

| Mục | Giá trị |
|---|---|
| **Framework Preset** | Vite |
| **Root Directory** | `apps/web` ← bấm **Edit** và chọn đúng thư mục này |
| **Build Command** | `npm run build` (mặc định của preset Vite; script này = `tsc --noEmit && vite build`) |
| **Output Directory** | `dist` (mặc định) |
| **Install Command** | `npm install` (mặc định) |

## Bước 3 — Biến môi trường

Vẫn ở màn hình Configure (mục **Environment Variables**), thêm 2 biến
(áp dụng cho cả 3 môi trường Production/Preview/Development):

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | anon public key (chuỗi `eyJ...`) |

⚠️ Biến Vite **phải** bắt đầu bằng `VITE_` mới được nhúng vào bundle.
Đổi biến môi trường → phải **Redeploy** mới có hiệu lực.

## Bước 4 — Deploy & kiểm tra

1. Bấm **Deploy**, chờ build xong (~1–2 phút).
2. Mở domain `https://<ten-project>.vercel.app`:
   - Trang chủ hiển thị → OK.
   - Thử vào thẳng URL sâu, VD `https://<ten-project>.vercel.app/huong-dan`
     → phải ra trang Hướng dẫn (không 404) — nhờ `vercel.json` rewrites.
   - Đăng ký/đăng nhập thử → vào Dashboard.
3. **Sau khi có domain thật**, quay lại Supabase Dashboard →
   **Authentication → URL Configuration**:
   - **Site URL** = `https://<ten-project>.vercel.app`
   - **Redirect URLs**: thêm `https://<ten-project>.vercel.app/**`
     (để email "đặt lại mật khẩu" đưa user về đúng trang `/dat-lai-mat-khau`).

## SPA rewrites (`apps/web/vercel.json`)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

App dùng `BrowserRouter` (không phải HashRouter) nên cần rewrite này —
nếu không, refresh trang ở `/chuong-trinh/abc` hay mở link `/loi-moi?token=...`
trực tiếp sẽ 404. File tĩnh trong `dist/assets/...` vẫn được phục vụ bình thường
(Vercel ưu tiên file có thật trước rewrite).

## PWA — lưu ý

- App dùng `vite-plugin-pwa` (`registerType: 'autoUpdate'`): sau mỗi lần deploy
  bản mới, user mở app sẽ tự nhận bản mới (có thể cần tải lại trang 1 lần).
- Cài đặt như ứng dụng: trên Chrome Android → menu ⋮ → **Thêm vào Màn hình chính**
  / **Cài đặt ứng dụng**; trên iOS Safari → Chia sẻ → **Thêm vào MH chính**.
- Workbox **chỉ precache shell ứng dụng** (`js/css/html/svg`), **không cache**
  API Supabase (cache API có xác thực dễ gây rò rỉ/dữ liệu cũ sai).
  Offline thật do Dexie (bản nháp + hàng đợi đồng bộ) đảm nhiệm ở tầng ứng dụng.
- Icon PWA hiện dùng `public/icon.svg`. Nếu muốn icon đẹp trên Android/iOS,
  thay bằng PNG 192/512 (maskable) và cập nhật `vite.config.ts` → manifest.

## Custom domain (tùy chọn)

Vercel Dashboard → Project → **Settings → Domains** → thêm domain riêng
(VD `slide.hoithanh.org`) → trỏ DNS theo hướng dẫn của Vercel.
Nhớ cập nhật lại **Site URL / Redirect URLs** trong Supabase (bước 4.3).

## Xử lý sự cố thường gặp

| Triệu chứng | Nguyên nhân & cách sửa |
|---|---|
| Build fail: `Cannot find module` / lỗi `tsc` | Chạy `npm run build` ở máy local trước; build trên Vercel cũng chạy `tsc --noEmit` nên lỗi type nào local có thì Vercel cũng fail |
| Trang trắng, console báo `VITE_SUPABASE_URL is not defined` (hoặc tương tự) | Quên set env vars, hoặc set sau khi deploy → vào **Settings → Environment Variables** thêm rồi **Redeploy** |
| Vào URL sâu bị 404 | Thiếu/không nhận `vercel.json` — kiểm tra file nằm đúng ở `apps/web/vercel.json` và đã push lên git |
| Đăng nhập xong bị đá về trang chủ / báo lỗi redirect | Chưa thêm domain vào Supabase **Redirect URLs** (bước 4.3) |
| Ảnh upload nhưng không hiện | Kiểm tra Storage buckets + policies theo `huong-dan-supabase.md` bước 8 |
