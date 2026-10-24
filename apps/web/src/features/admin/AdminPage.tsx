// Trang Quản trị nền tảng (/quan-tri) — CHỈ dành cho is_platform_admin.
// Lưu ý trung thực: RLS trên máy chủ mới là lớp bảo vệ thật; UI ở đây chỉ ẩn/hiện.
// Trang này KHÔNG giả vờ có các chức năng chưa triển khai (xem mục "Chưa có trên trang này").
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../stores/auth';
import { Button, Spinner } from '../../components/ui';

interface AuditLog {
  id: number;
  church_id: string | null;
  actor_id: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
  actor_name?: string;
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', { hour12: false });
  } catch {
    return iso;
  }
}

export function AdminPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.is_platform_admin === true;

  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<{ profiles: number | null; churches: number | null; programs: number | null }>({
    profiles: null,
    churches: null,
    programs: null,
  });
  const [service, setService] = useState<{ ok: boolean; msg: string } | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logsNote, setLogsNote] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      // 1) Tình trạng dịch vụ: ping bảng profiles
      try {
        const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).limit(1);
        setService(error ? { ok: false, msg: error.message } : { ok: true, msg: 'Kết nối Supabase bình thường.' });
      } catch (err) {
        setService({ ok: false, msg: err instanceof Error ? err.message : 'Không kết nối được.' });
      }
      // 2) Số liệu tổng quan (head count). RLS có thể chặn một số bảng → hiển thị "—" trung thực.
      async function count(table: string): Promise<number | null> {
        try {
          const { count: c, error } = await supabase.from(table).select('id', { count: 'exact', head: true });
          return error ? null : (c ?? 0);
        } catch {
          return null;
        }
      }
      setCounts({
        profiles: await count('profiles'),
        churches: await count('churches'),
        programs: await count('programs'),
      });
      // 3) Nhật ký quản trị mới nhất — trong giới hạn RLS cho phép.
      try {
        const { data, error } = await supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) {
          setLogsNote('Không đọc được nhật ký (giới hạn bởi RLS hoặc chưa có dữ liệu).');
        } else {
          const list = (data ?? []) as AuditLog[];
          const ids = [...new Set(list.map(l => l.actor_id).filter(Boolean))] as string[];
          if (ids.length > 0) {
            const { data: profs } = await supabase.from('profiles').select('id, display_name, email').in('id', ids);
            const map = new Map(
              ((profs ?? []) as { id: string; display_name: string | null; email: string }[]).map(p => [
                p.id,
                p.display_name || p.email,
              ]),
            );
            list.forEach(l => {
              l.actor_name = (l.actor_id && map.get(l.actor_id)) || '—';
            });
          }
          setLogs(list);
          if (list.length === 0) setLogsNote('Chưa có nhật ký nào được ghi.');
        }
      } catch {
        setLogsNote('Không đọc được nhật ký (giới hạn bởi RLS hoặc chưa có dữ liệu).');
      }
      setLoading(false);
    })();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl p-6 text-center">
        <h1 className="text-xl font-bold">⛔ Bạn không có quyền truy cập</h1>
        <p className="mt-2 text-sm text-slate-600">
          Trang này chỉ dành cho quản trị viên nền tảng. Quyền truy cập thật được kiểm soát bởi RLS trên máy chủ —
          giao diện này chỉ ẩn nội dung, không phải lớp bảo mật.
        </p>
      </div>
    );
  }

  const stat = (label: string, value: number | null) => (
    <div className="rounded-xl border p-4">
      <div className="text-3xl font-bold">{value === null ? '—' : value.toLocaleString('vi-VN')}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
      {value === null && <div className="mt-1 text-xs text-amber-600">Bị giới hạn bởi RLS</div>}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-bold">🛠️ Quản trị nền tảng</h1>
      <p className="text-sm text-slate-500">
        Chỉ quản trị viên nền tảng thấy trang này. Mọi kiểm tra quyền thật đều do RLS trên máy chủ thực hiện.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        {stat('Người dùng', counts.profiles)}
        {stat('Hội thánh', counts.churches)}
        {stat('Chương trình', counts.programs)}
      </div>

      <div className="rounded-xl border p-4">
        <h2 className="font-semibold">Tình trạng dịch vụ</h2>
        {loading || !service ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <Spinner /> Đang kiểm tra…
          </p>
        ) : (
          <p className={`mt-2 text-sm font-medium ${service.ok ? 'text-green-700' : 'text-red-700'}`}>
            {service.ok ? '🟢 Hoạt động' : '🔴 Lỗi'} — {service.msg}
          </p>
        )}
      </div>

      <div className="rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Nhật ký quản trị (50 mới nhất)</h2>
          <Button onClick={() => window.location.reload()}>Tải lại</Button>
        </div>
        {loading ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <Spinner /> Đang tải…
          </p>
        ) : logs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">{logsNote || 'Chưa có dữ liệu.'}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-slate-500">
                  <th className="py-2 pr-3">Thời gian</th>
                  <th className="py-2 pr-3">Người thực hiện</th>
                  <th className="py-2 pr-3">Hành động</th>
                  <th className="py-2 pr-3">Đối tượng</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtTime(l.created_at)}</td>
                    <td className="py-2 pr-3">{l.actor_name ?? '—'}</td>
                    <td className="py-2 pr-3">
                      <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">{l.action}</code>
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-500">
                      {[l.entity, l.entity_id].filter(Boolean).join(' · ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {logsNote && logs.length > 0 && <p className="mt-2 text-xs text-slate-500">{logsNote}</p>}
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
        <h2 className="font-semibold text-amber-900 dark:text-amber-100">Những việc CHƯA có trên trang này</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900 dark:text-amber-100">
          <li>
            <b>Khóa / mở khóa / xóa tài khoản người dùng</b> — thực hiện trong Supabase Dashboard (Authentication →
            Users). Trang này không có chức năng đó.
          </li>
          <li>
            <b>Cấp hoặc thu hồi quyền quản trị nền tảng</b> — chỉ thực hiện bằng SQL trực tiếp (role postgres), không
            có nút nào trên giao diện.
          </li>
          <li>
            <b>Đặt lại mật khẩu cho người dùng khác</b> — thực hiện trong Supabase Dashboard.
          </li>
          <li>
            <b>Xem nội dung chi tiết của hội thánh mà bạn không phải thành viên</b> — bị giới hạn bởi RLS để bảo vệ dữ
            liệu các hội thánh (số liệu "—" ở trên là do giới hạn này).
          </li>
        </ul>
      </div>
    </div>
  );
}
