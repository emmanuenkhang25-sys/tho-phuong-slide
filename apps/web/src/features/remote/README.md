# Remote — điều khiển trình chiếu bằng điện thoại

- Route `/dieu-khien` (yêu cầu đăng nhập — `RequireAuth`).
- Nhập mã 6 ký tự (tự điền từ `?code=` khi quét QR), nút **Kết nối**.
- Query `present_sessions` theo mã: RLS tự chặn nếu tài khoản không có quyền
  `presenter`+ của đúng hội thánh → báo "Mã không đúng, đã hết hạn, hoặc bạn
  không có quyền trình chiếu hội thánh này".
- Join channel `present:<code>`, gửi broadcast `{event:'cmd'}`:
  `next | prev | goto(slideIndex) | pause | resume | blank | unblank | end`.
- Nghe broadcast `{event:'state'}` từ PC để hiện "Slide X / N" và trạng thái
  TẠM DỪNG / MÀN HÌNH ĐEN. Khi PC kết thúc (`state='ended'`) → tự ngắt.
- Mobile-first, nút lớn (≥56px). Thumbnail lưới dùng `SlideRenderer` width=160.
- **Cần Internet trên cả điện thoại và máy tính (kết nối qua máy chủ).**
