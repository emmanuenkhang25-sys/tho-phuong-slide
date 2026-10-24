import { createClient } from '@supabase/supabase-js';

/**
 * Client Supabase duy nhất của ứng dụng (CONTRACT mục 5).
 * Đọc từ biến môi trường VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
 * Nếu thiếu env: ghi lỗi rõ ràng ra console và UI sẽ hiển thị cảnh báo
 * (xem <EnvWarning/> trong ui.tsx).
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && anonKey);

if (!supabaseConfigured) {
  // eslint-disable-next-line no-console
  console.error(
    '[Thờ Phượng Slide] Thiếu cấu hình Supabase.\n' +
      'Hãy copy apps/web/.env.example thành apps/web/.env và điền VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.\n' +
      'Lấy giá trị tại: https://supabase.com/dashboard → project → Settings → API',
  );
}

// Client "mồi" để module không crash khi chưa có env; mọi request sẽ thất bại
// và UI hiển thị hướng dẫn cấu hình. Không bao giờ dùng giá trị này cho production.
export const supabase = createClient(
  url ?? 'https://placeholder.supabase.co',
  anonKey ?? 'placeholder-anon-key',
);
