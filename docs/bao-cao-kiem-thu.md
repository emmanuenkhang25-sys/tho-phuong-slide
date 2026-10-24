# Báo cáo kiểm thử — Thờ Phượng Slide

Ngày kiểm thử: **2026-10-24** · Người thực hiện: nhóm TESTS + DOCS + INTEGRATION
Môi trường: Node v24.22.1, npm 10.9.4, không có Supabase project thật,
không có psql/docker, không chạy trình duyệt.

> **Nguyên tắc:** chỉ ghi **ĐẠT** khi có bằng chứng chạy thật (build/test).
> Mọi luồng cần server thật đều ghi **CHƯA KIỂM THỬ ĐƯỢC** kèm lý do —
> tuyệt đối không giả lập thành công.

## 1. Kết quả kiểm thử tự động (bằng chứng chạy thật)

| Hạng mục | Kết quả |
|---|---|
| `npm run build` (`tsc --noEmit && vite build`) | ✅ **PASS** — tsc 0 lỗi, vite build thành công (376 modules, ~9s) |
| `npm test` (`vitest run`, environment node) | ✅ **59/59 test xanh**, 4/4 file test pass |

Chi tiết vitest (con số thật từ lần chạy cuối):

| File test | Số test | Trạng thái |
|---|---|---|
| `src/features/editor/lib/split.test.ts` (splitLyrics/splitBible) | 14 | ✅ xanh |
| `src/lib/permissions.test.ts` (roleRank/hasRole/can*) | 21 | ✅ xanh |
| `src/features/export/lib/backup.test.ts` (parseBackupFile/validate) | 10 | ✅ xanh |
| `src/features/present/remoteProtocol.test.ts` (mã phiên/lệnh/trạng thái) | 14 | ✅ xanh |

Phạm vi test bao phủ: giữ nguyên từng ký tự khi tách lời/Kinh Thánh, không cắt
ngang câu, nhận diện điệp khúc (`ĐK:`), đánh số câu, ma trận quyền 5 vai trò theo
đúng CONTRACT mục 2, parse file sao lưu (JSON sai, sai app, version không hỗ trợ,
thiếu trường, file >20MB → cảnh báo), mã phiên 6 ký tự `[A-Z0-9]` (định dạng +
duy nhất trên 500 mã), validate lệnh `cmd`/`state` của remote.

## 2. Lỗi đã phát hiện & đã fix (trong quá trình tích hợp)

| # | Lỗi | Cách fix |
|---|---|---|
| 1 | `tsc`: `BackupPage.tsx(56)` — biến `loading` khai báo nhưng không dùng | Dùng `loading` để hiển thị spinner "Đang tải…" khi tải danh sách chương trình |
| 2 | `tsc`: `export/lib/backup.ts(87)` — cast `Record<string,unknown> as Program` không hợp lệ | Đổi thành `as unknown as Program` |
| 3 | `tsc`: `Toolbar.tsx` — import sai `../export/components/ExportMenu` (nhầm thư mục) | Sửa thành `../../export/components/ExportMenu` |
| 4 | `tsc`: `backup.test.ts` — `deleted_at` trong factory test thiếu so với type `Program` | Thêm `deleted_at: null` vào factory |
| 5 | `vitest`: 1 test sai kỳ vọng — test tách slide dùng dòng `d1..d5` viết thường không dấu câu, heuristic "không cắt ngang câu" của `splitLyrics` dịch chuyển dòng (đúng hành vi thiết kế) | Sửa test dùng dòng có dấu chấm câu; hành vi hàm giữ nguyên |
| 6 | `vite.config.ts` thiếu block `test` | Thêm `test: { environment: 'node', include: ['src/**/*.test.ts'] }`, chuyển sang `defineConfig` từ `vitest/config` |

Ngoài ra (tích hợp, không phải lỗi): merge `featureRoutes.ts` (7 nhóm routes),
gắn `ExportMenu` vào toolbar editor, tạo migration RPC `accept_invitation`,
sửa `LoiMoi.tsx` gọi RPC + fallback, tạo `apps/web/vercel.json` (SPA rewrites).

## 3. Bảng nghiệm thu từng tiêu chí (theo spec)

### 3.1 Đăng ký / đăng nhập
**CHƯA KIỂM THỬ ĐƯỢC.** Cần: project Supabase thật đã chạy `schema.sql` +
cấu hình Email Auth. Code đã có (`stores/auth.tsx`, các trang `/dang-nhap`,
`/dang-ky`, trigger `handle_new_user` tự tạo `profiles`) và đã review logic,
nhưng chưa từng chạy đăng ký thật lần nào.

### 3.2 Đặt lại mật khẩu
**CHƯA KIỂM THỬ ĐƯỢC.** Cần: Supabase thật + cấu hình email (SMTP) để nhận
được email đặt lại. Trang `/quen-mat-khau` → `/dat-lai-mat-khau` đã có trong
code và đã review, chưa test gửi/nhận email thật.

### 3.3 Tạo hội thánh + mời thành viên
**CHƯA KIỂM THỬ ĐƯỢC.** Cần: Supabase thật. Các mảnh đã sẵn sàng và đã review:
trang `/hoi-thanh` (tạo hội thánh, gửi lời mời), trigger `handle_new_church`
(tự gán `owner`), migration `20261024_accept_invitation.sql` (RPC cho phép
người được mời tự tham gia), trang `/loi-moi` (gọi RPC, có fallback khi RPC
chưa deploy). **Lưu ý:** file migration mới chỉ được review tĩnh, chưa từng
chạy trên Postgres thật.

### 3.4 Tạo chương trình
**CHƯA KIỂM THỬ ĐƯỢC.** Cần: Supabase thật + trình duyệt. Editor (`/chuong-trinh/:id`)
đã có đầy đủ UI trong code, chưa thao tác thật.

### 3.5 Thêm / sửa / xóa / sắp xếp slide
**CHƯA KIỂM THỬ ĐƯỢC.** Cần: trình duyệt thật (chưa từng mở dev server).
Các thao tác đã có trong `EditorPage` (thêm, nhân bản, xóa, undo/redo, sắp xếp
qua thumbnails) — mới chỉ kiểm tra ở mức type-check, chưa click thử.

### 3.6 Tự lưu + đồng bộ
**CHƯA KIỂM THỬ ĐƯỢC.** Cần: Supabase thật + mô phỏng mất mạng. Logic đã
review trong code (`editor/lib/sync.ts`, `stores/sync.ts`, Dexie `drafts` +
`sync_queue`, chip trạng thái `Đang lưu…/Đã lưu trên máy/Đã lưu trên đám mây/
Ngoại tuyến/Lỗi đồng bộ`) — chưa chạy thử debounce, hàng đợi, hay xung đột thật.

### 3.7 Đóng app mở lại (bản nháp còn nguyên)
**CHƯA KIỂM THỬ ĐƯỢC.** Cần: trình duyệt thật (IndexedDB/Dexie). Logic
`getDraft`/`saveDraft` đã review — chưa test đóng tab mở lại thật.

### 3.8 Đăng nhập trên thiết bị khác
**CHƯA KIỂM THỬ ĐƯỢC.** Cần: 2 thiết bị + Supabase thật. Chưa thực hiện.

### 3.9 Mất mạng vẫn giữ bản nháp
**CHƯA KIỂM THỬ ĐƯỢC.** Cần: trình duyệt + ngắt mạng thật. Thiết kế
"không xóa draft local trước khi server xác nhận" đã review trong code —
chưa kiểm chứng thực tế.

### 3.10 Có mạng trở lại thì đồng bộ
**CHƯA KIỂM THỬ ĐƯỢC.** Cần: Supabase thật + kịch bản ngắt/nối mạng.
Chưa thực hiện.

### 3.11 Tài khoản khác không truy cập trái phép
**CHƯA KIỂM THỬ ĐƯỢC** (mới chỉ review tĩnh). Đã đọc kỹ toàn bộ
`supabase/schema.sql` đối chiếu CONTRACT mục 3: RLS bật trên cả 11 bảng,
policy đúng ma trận quyền (đọc=thành viên, sửa=editor+, xóa=admin+,
xóa church=owner), `user_church_role()` là SECURITY DEFINER (tránh đệ quy
RLS), storage policies theo segment `<church_id>/`. Thiết kế đúng —
nhưng **chưa từng chạy trên Postgres thật**, chưa test với 2 tài khoản thật.

### 3.12 Xuất PPTX / PDF hợp lệ
**CHƯA KIỂM THỬ ĐƯỢC.** Cần: trình duyệt thật (PptxGenJS/jsPDF/html2canvas
chạy trên DOM/canvas). `ExportMenu` đã được gắn vào toolbar editor và type-check
pass; `exportPPTX`/`exportPDF`/`downloadBackupJSON` đã review code theo CONTRACT
mục 7 — nhưng chưa từng bấm nút Xuất hay mở file kết quả.

### 3.13 Trình chiếu toàn màn hình
**CHƯA KIỂM THỬ ĐƯỢC.** Cần: trình duyệt thật. `PresenterPage` (`/trinh-chieu/:id`)
đã có trong code (fullscreen, phím tắt) — chưa mở thử.

### 3.14 Điện thoại điều khiển trình chiếu (remote)
**CHƯA KIỂM THỬ ĐƯỢC** end-to-end. Đã **ĐẠT ở mức unit test**: 14 test xanh cho
`remoteProtocol.ts` (sinh mã 6 ký tự đúng định dạng + duy nhất, chuẩn hóa mã,
validate lệnh `next/prev/goto/pause/resume/blank/unblank/end` và trạng thái
`live/paused/blank/ended`, hết hạn phiên). Luồng thật (PC tạo session →
điện thoại nhập mã → Realtime broadcast) cần Supabase thật + 2 thiết bị —
chưa thực hiện. Docs đã ghi rõ: cần Internet cả 2 thiết bị, không phải LAN.

### 3.15 Hướng dẫn khôi phục
**ĐẠT** (tài liệu + code đã review). Bằng chứng:
- `docs/sao-luu-khoi-phuc.md`: 3 lớp bảo vệ (JSON chủ động, lịch sử phiên bản
  tự động, nháp offline), bảng xử lý từng tình huống thảm họa, ghi rõ giới hạn
  (ảnh không nằm trong JSON; PITR chỉ có ở gói Supabase Pro+).
- Trang `/huong-dan` (public) có nội dung hướng dẫn trong code.
- Logic khôi phục trong `BackupPage` (snapshot trước khi ghi đè/khôi phục,
  xác nhận trước khi nhập) đã review — chưa chạy thử trên dữ liệu thật
  (xem 3.6).

### 3.16 Lỗi phổ biến có thông báo dễ hiểu
**ĐẠT ở mức review code** (chưa test từng tình huống thật). Bằng chứng:
đã rà soát các đường báo lỗi chính — `parseBackupFile`/`validateBackupData`
ném lỗi tiếng Việt cụ thể (sai JSON, sai app, version không hỗ trợ, thiếu trường);
`LoiMoi` hiển thị hướng dẫn khi token sai/hết hạn/email không khớp/RPC chưa
deploy/mất mạng; `BackupPage` báo lỗi nhập/khôi phục/đồng bộ bằng tiếng Việt;
`ExportMenu` hiện lỗi xuất + cảnh báo khác biệt PPTX. Chưa giả lập từng lỗi
để chụp màn hình kiểm chứng.

## 4. Tổng hợp trung thực

| Trạng thái | Các tiêu chí |
|---|---|
| ✅ **ĐẠT** (có bằng chứng chạy thật hoặc review code đầy đủ) | Build pass; 59/59 unit test xanh; hướng dẫn khôi phục (tài liệu); thông báo lỗi dễ hiểu (review code) |
| ⚠️ **CHƯA KIỂM THỬ ĐƯỢC** (cần Supabase project thật / trình duyệt / 2 thiết bị — hiện không có) | Đăng ký/đăng nhập; đặt lại MK; tạo hội thánh + mời thành viên (kể cả RPC mới); tạo chương trình; thêm/sửa/xóa/sắp xếp slide; tự lưu + đồng bộ; đóng app mở lại; thiết bị khác; mất mạng giữ nháp; có mạng đồng bộ lại; chống truy cập trái phép (mới review tĩnh); xuất PPTX/PDF; trình chiếu fullscreen; remote end-to-end |
| ❌ **CHƯA LÀM** | Không có — mọi tiêu chí trong danh sách nghiệm thu đều đã có code hoặc tài liệu tương ứng. (Ngoài danh sách: đăng nhập Google OAuth chưa được triển khai trong code — đã ghi rõ trong `huong-dan-supabase.md`.) |

## 5. Việc cần làm tiếp theo (để đạt nghiệm thu đầy đủ)

1. Tạo project Supabase thật, chạy SQL đúng thứ tự
   (`schema.sql` → migration `accept_invitation` → `seed.sql` tùy chọn).
2. Điền `.env`, chạy `npm run dev`, đi hết 16 tiêu chí trên bằng tay
   (2 tài khoản, 2 thiết bị cho remote, ngắt mạng cho offline).
3. Chạy migration `accept_invitation` rồi test link `/loi-moi?token=...` thật;
   kiểm tra fallback khi chưa chạy migration.
4. Bấm Xuất thử PPTX/PDF và mở file kết quả kiểm tra tiếng Việt/bố cục.
5. Deploy Vercel theo `huong-dan-deploy-vercel.md`, test lại URL sâu
   (`/loi-moi?token=...` mở trực tiếp không 404).
