# Nhóm PRESENTER — ghi chú kỹ thuật

## Giới hạn đã biết (nói đúng, không nói quá)

1. **Bản web chạy 1 màn hình.** Màn hình điều khiển (thanh công cụ, filmstrip,
   badge "TẠM DỪNG") và nội dung chiếu cho khán giả là MỘT màn hình trình duyệt.
   Muốn tách 2 màn hình: dùng chế độ **Extend** của hệ điều hành, mở 2 cửa sổ
   trình duyệt — một cửa sổ `/trinh-chieu/:id` để chiếu (máy chiếu), một cửa sổ
   để điều khiển. Không tự bật màn hình thứ hai, không có chế độ "presenter view"
   tách rời trong bản web này.

2. **Điều khiển từ xa cần Internet trên cả 2 thiết bị** (điện thoại + máy tính),
   kết nối qua máy chủ Supabase Realtime. Không phải LAN, không quét mạng nội bộ.

3. **Tạm dừng (P):** đóng băng ở slide hiện tại, dừng nhận lệnh remote
   (chỉ còn nhận `resume` và `end`), hiện badge "TẠM DỪNG" nhỏ ở góc màn hình
   điều khiển. Không gửi slide đen tới khán giả khi tạm dừng.

4. **Màn hình đen (B):** phủ đen toàn màn hình — khán giả chỉ thấy màu đen.

5. **Mã ghép nối:** 6 ký tự A-Z0-9, hết hạn sau 24h (`expires_at`), tự đóng khi
   hết hạn. "Kết thúc & hủy ghép nối" đặt `state='ended'` — mã cũ không dùng lại được.

6. **Phụ thuộc cần cài:** `react-qr-code` (nhóm web-core thêm vào package.json).
   Chuyển slide: fade CSS 0.18s, không animation rườm rà.
