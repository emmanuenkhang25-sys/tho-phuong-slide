# Sao lưu & khôi phục

App có **3 lớp bảo vệ dữ liệu** — hiểu rõ từng lớp để dùng đúng lúc.

## Lớp 1 — Sao lưu JSON (`.tpsbackup.json`) — do người dùng chủ động

**Xuất file sao lưu** (từ thanh công cụ editor → nút **⬇ Xuất** → *Sao lưu JSON*,
hoặc trang **Sao lưu** → *Tải bản sao lưu JSON*):

- File chứa toàn bộ 1 chương trình: `program` + `sections[]` + `slides[]` +
  `assets_manifest` (danh sách đường dẫn ảnh).
- Định dạng: `{ version: 1, exportedAt, app: "tho-phuong-slide", program, sections, slides, assets_manifest }`.
- ⚠️ **Ảnh không nằm trong file JSON** — ảnh lưu riêng trên Storage của hội thánh;
  file chỉ ghi lại đường dẫn. Khi khôi phục sang hội thánh *khác*, các ảnh cũ
  sẽ không theo sang (slide vẫn giữ nguyên chữ/bố cục/màu nền).

**Nhập file sao lưu** (trang **Sao lưu** → *Nhập bản sao lưu*):

1. Chọn file `.tpsbackup.json` / `.json` — app kiểm tra định dạng **trước**
   (sai JSON, sai ứng dụng, version không hỗ trợ, thiếu trường → báo lỗi tiếng Việt,
   không ghi gì cả).
2. Xác nhận trong hộp thoại: hiển thị tên chương trình, số mục, số slide.
3. Kết quả:
   - File **cùng hội thánh** → ghi đè đúng chương trình gốc (bản hiện tại được
     tự động lưu vào *lịch sử phiên bản* trước — xem Lớp 2).
   - File **khác hội thánh** → tạo thành **chương trình mới** trong hội thánh
     hiện tại (không bao giờ ghi đè nhầm sang hội thánh khác).

**Khuyến nghị:** trước mỗi dịp lễ lớn / đợt sửa nhiều, tải 1 bản JSON cất ở nơi
an toàn (máy tính, USB, Google Drive).

## Lớp 2 — Lịch sử phiên bản (tự động, trên đám mây)

Bảng `program_versions` lưu snapshot `{program, sections[], slides[]}` của chương trình.

**Khi nào tự lưu:**
- Trước mỗi lần **nhập bản sao lưu JSON** (ghi đè).
- Trước mỗi lần **khôi phục phiên bản cũ**.
- Trước khi **giải quyết xung đột đồng bộ** (ghi đè bản thua).

**Dùng (trang Sao lưu → Lịch sử phiên bản):**
- **👁 Xem trước:** xem slide đầu tiên + số mục/slide của phiên bản đó.
- **↩ Khôi phục:** bản hiện tại được lưu lại thành phiên bản mới trước, rồi mới
  ghi đè bằng bản đã chọn → **không bao giờ mất dữ liệu** khi khôi phục.

> Ghi chú kỹ thuật: `program_versions` chỉ có policy INSERT (editor+),
> không có UPDATE/DELETE → các phiên bản bất biến sau khi ghi.

## Lớp 3 — Bản nháp offline trên máy (tự động, Dexie/IndexedDB)

- Editor **tự lưu sau ~2 giây** ngừng gõ vào bộ nhớ trình duyệt (bảng `drafts`).
- Mất mạng giữa chừng: trạng thái hiện **"Ngoại tuyến — sẽ đồng bộ"**, bản nháp
  vẫn còn; có mạng lại app tự đẩy lên (hàng đợi `sync_queue`).
- ⚠️ Bản nháp **không bao giờ bị xóa** trước khi máy chủ xác nhận đã nhận —
  tắt trình duyệt/mất điện đột ngột cũng không mất quá ~2 giây công việc cuối.

## Xung đột đồng bộ (2 người cùng sửa)

- App so sánh `updated_at`: bản mới hơn thắng; khi cả 2 cùng sửa mà chưa đồng bộ
  → trang **Sao lưu** hiện banner xung đột với 2 nút **[Giữ bản của tôi]** /
  **[Lấy bản máy chủ]**.
- Bản bị thay thế **luôn được lưu** vào lịch sử phiên bản trước khi ghi đè.

## Khôi phục sau thảm họa (mất dữ liệu trên Supabase)

| Tình huống | Cách xử lý |
|---|---|
| Xóa nhầm slide/mục trong app | Lịch sử phiên bản (Lớp 2) → Khôi phục |
| Ghi đè nhầm chương trình | Nhập lại file `.tpsbackup.json` đã tải trước đó (Lớp 1) |
| Xóa nhầm cả chương trình (xóa mềm) | Liên hệ quản trị viên có quyền DB: `update programs set status='draft', deleted_at=null where id='...'` |
| Mất toàn bộ database Supabase | **Point-in-time recovery (PITR):** chỉ có trên gói **Pro trở lên** của Supabase (Dashboard → Database → Backups → Point in time). Gói **Free không có PITR** — đây là lý do phải duy trì Lớp 1 (tải JSON định kỳ) |
| Hết hạn project Free bị pause | Supabase Free pause project không hoạt động; vào dashboard **Restore** là dữ liệu còn nguyên (trong thời gian giữ của Supabase) |

## Những điều KHÔNG được sao lưu

- **File ảnh gốc** trong Storage (`program-images`): JSON chỉ lưu đường dẫn.
  Muốn dự phòng ảnh → tải ảnh gốc về máy riêng, hoặc dùng tính năng backup của
  Supabase (gói trả phí).
- **Tài khoản người dùng** (`auth.users`): thuộc hệ thống Auth của Supabase,
  khôi phục theo cơ chế backup của Supabase.
