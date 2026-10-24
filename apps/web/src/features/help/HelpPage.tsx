// Trang Hướng dẫn (/huong-dan) — public, không cần đăng nhập.
// HDMI/mở rộng màn hình, ghép nối điện thoại, khôi phục dữ liệu, FAQ, liên hệ.
import { PDF_RASTER_NOTE } from '../export/lib/units';

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="rounded-lg border px-4 py-3 open:bg-slate-50 dark:open:bg-slate-800">
      <summary className="cursor-pointer font-medium">{q}</summary>
      <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{children}</div>
    </details>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
        {n}
      </span>
      <div className="text-sm">
        <div className="font-medium">{title}</div>
        <div className="text-slate-600 dark:text-slate-300">{children}</div>
      </div>
    </li>
  );
}

export function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold">📖 Hướng dẫn sử dụng</h1>
        <p className="mt-1 text-sm text-slate-500">
          Thờ Phượng Slide — tạo chương trình thờ phượng, trình chiếu toàn màn hình và điều khiển bằng điện thoại.
        </p>
      </header>

      {/* 1. HDMI */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">🖥️ Kết nối máy chiếu / TV qua HDMI</h2>
        <div className="flex items-center justify-center gap-4 rounded-xl border bg-slate-50 p-4 dark:bg-slate-800" aria-hidden="true">
          <div className="rounded border-2 border-slate-400 px-4 py-6 text-center text-xs">
            💻<br />Máy tính
          </div>
          <div className="text-2xl">—HDMI—▶</div>
          <div className="rounded border-2 border-slate-400 px-6 py-8 text-center text-xs">
            📽️<br />Máy chiếu / TV
          </div>
        </div>
        <ol className="space-y-3">
          <Step n={1} title="Cắm cáp HDMI">
            Nối máy tính với máy chiếu/TV, bật máy chiếu và chọn đúng cổng HDMI (HDMI 1, HDMI 2…).
          </Step>
          <Step n={2} title="Bật chế độ màn hình mở rộng">
            <b>Windows:</b> nhấn <kbd className="rounded bg-slate-200 px-1">Win</kbd> + <kbd className="rounded bg-slate-200 px-1">P</kbd> → chọn <b>Mở rộng (Extend)</b>.
            <br />
            <b>macOS:</b> Cài đặt hệ thống → Màn hình → chọn màn hình máy chiếu → <b>Dùng như màn hình mở rộng</b>.
            Không chọn "Phản chiếu" (Mirror) nếu muốn vừa chiếu vừa xem ghi chú trên máy tính.
          </Step>
          <Step n={3} title="Mở trình chiếu toàn màn hình">
            Trong Thờ Phượng Slide, mở chương trình → <b>Trình chiếu</b>, kéo cửa sổ sang màn hình máy chiếu rồi nhấn{' '}
            <kbd className="rounded bg-slate-200 px-1">F11</kbd> (Windows) để toàn màn hình.
          </Step>
        </ol>
      </section>

      {/* 2. Ghép nối điện thoại */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">📱 Điều khiển trình chiếu bằng điện thoại</h2>
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          ⚠️ Cần <b>Internet trên cả hai thiết bị</b> (máy tính và điện thoại) vì điều khiển đi qua máy chủ — không
          phải mạng LAN nội bộ.
        </p>
        <ol className="space-y-3">
          <Step n={1} title="Trên máy tính: tạo mã ghép nối">
            Mở trang <b>Trình chiếu</b> của chương trình → tạo phiên trình chiếu để nhận <b>mã 6 ký tự</b> (ví dụ
            A3K9QZ). Mã hết hạn sau 24 giờ.
          </Step>
          <Step n={2} title="Trên điện thoại: đăng nhập">
            Mở Thờ Phượng Slide trên điện thoại và <b>đăng nhập</b> (tài khoản phải có quyền Người trình chiếu trở lên
            trong hội thánh).
          </Step>
          <Step n={3} title="Nhập mã và điều khiển">
            Vào <b>Điều khiển</b> → nhập mã 6 ký tự → dùng các nút Tiến / Lùi / Tạm dừng / Màn hình trống.
          </Step>
          <Step n={4} title="Ngắt kết nối">
            Trên điện thoại nhấn <b>Ngắt kết nối</b>; trên máy tính, kết thúc phiên trình chiếu để hủy mã.
          </Step>
        </ol>
      </section>

      {/* 3. Khôi phục dữ liệu */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">💾 Sao lưu &amp; khôi phục dữ liệu</h2>
        <ol className="space-y-3">
          <Step n={1} title="Tải bản sao lưu">
            Vào <b>Sao lưu</b> → chọn chương trình → <b>Tải bản sao lưu JSON</b>. Cất file <code>.tpsbackup.json</code> ở
            nơi an toàn (máy tính, USB).
          </Step>
          <Step n={2} title="Nhập lại bản sao lưu">
            <b>Sao lưu</b> → <b>Nhập bản sao lưu</b> → chọn file → xác nhận. Bản hiện tại <b>tự động được lưu</b> vào
            lịch sử phiên bản trước khi ghi đè, nên không sợ mất.
          </Step>
          <Step n={3} title="Khôi phục từ lịch sử phiên bản">
            <b>Sao lưu</b> → <b>Lịch sử phiên bản</b> → <b>Xem trước</b> để kiểm tra → <b>Khôi phục</b>. Bản trước khi
            khôi phục cũng được lưu lại — có thể hoàn tác bằng cách khôi phục phiên bản mới nhất.
          </Step>
        </ol>
      </section>

      {/* 4. FAQ */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">❓ Lỗi thường gặp</h2>
        <div className="space-y-2">
          <Faq q="Mất mạng khi đang sửa thì sao?">
            Không sao. Mọi thay đổi được <b>tự động lưu trên máy</b> (bản nháp). Khi có mạng trở lại, ứng dụng sẽ tự
            đồng bộ lên máy chủ — hoặc bạn nhấn <b>Đồng bộ ngay</b> trong trang Sao lưu.
          </Faq>
          <Faq q="Xung đột đồng bộ là gì? Xử lý thế nào?">
            Xảy ra khi <b>cùng một chương trình bị sửa ở hai nơi</b> (ví dụ hai máy) trước khi đồng bộ. Trang Sao lưu
            sẽ hiện cảnh báo và cho bạn chọn <b>Giữ bản của tôi</b> hoặc <b>Lấy bản máy chủ</b>. Bản bị thay thế{' '}
            <b>luôn được lưu</b> vào lịch sử phiên bản trước — không mất dữ liệu.
          </Faq>
          <Faq q="Quên mật khẩu?">
            Ở trang đăng nhập, nhấn <b>Quên mật khẩu</b> và làm theo email hướng dẫn. Nếu không nhận được email, kiểm
            tra hộp thư rác hoặc nhờ quản trị viên hội thánh hỗ trợ.
          </Faq>
          <Faq q="Không tải được ảnh lên slide?">
            Kiểm tra: (1) đã có mạng; (2) ảnh định dạng JPG/PNG; (3) dung lượng không quá lớn (nên dưới 5MB); (4) tài
            khoản của bạn có quyền Biên tập viên trở lên trong hội thánh.
          </Faq>
          <Faq q="Tại sao chữ trong file PDF không chọn/copy được?">
            {PDF_RASTER_NOTE} Nếu cần chỉnh sửa chữ, hãy xuất file <b>PowerPoint (.pptx)</b> — chữ trong đó vẫn chỉnh
            sửa được.
          </Faq>
          <Faq q="Mở file PPTX trên điện thoại bị lệch chữ?">
            Dùng ứng dụng <b>Microsoft PowerPoint</b> hoặc <b>Google Slides</b> để mở. Một số font chữ trên máy tính
            không có sẵn trên điện thoại nên chữ có thể hiển thị bằng font thay thế — nội dung và bố cục vẫn giữ
            nguyên.
          </Faq>
        </div>
      </section>

      {/* 5. Liên hệ */}
      <section className="rounded-xl border p-4">
        <h2 className="text-lg font-bold">✉️ Liên hệ hỗ trợ</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Khi gặp sự cố, hãy liên hệ <b>ban kỹ thuật / quản trị viên của Hội thánh bạn</b> — họ có thể xem nhật ký,
          khôi phục phiên bản và hỗ trợ trực tiếp. Khi báo lỗi, ghi lại giúp: bạn đang làm gì, thông báo lỗi hiện ra
          (chụp màn hình càng tốt), và thời gian xảy ra.
        </p>
      </section>
    </div>
  );
}
