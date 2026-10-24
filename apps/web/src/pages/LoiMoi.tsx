import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Invitation } from '../lib/types';
import { useAuth } from '../stores/auth';
import { useChurch } from '../stores/church';
import { ROLE_LABELS } from '../lib/permissions';
import { formatDateTime } from '../lib/format';
import { Button, EmptyState, Spinner, useToast } from '../components/ui';

/**
 * Trang chấp nhận lời mời: /loi-moi?token=<token>
 * Đọc invitation theo token (RLS: admin+ của hội thánh, hoặc chính người được mời
 * có email trùng). Người được mời đăng ký đúng email rồi bấm "Tham gia".
 *
 * Việc tham gia thực hiện qua RPC `accept_invitation(p_token)` (SECURITY DEFINER,
 * file supabase/migrations/20261024_accept_invitation.sql): server tự kiểm tra
 * email + hạn, thêm vào church_members, đánh dấu accepted_at.
 * Nếu RPC chưa được deploy (function chưa tồn tại) → hiển thị hướng dẫn liên hệ
 * quản trị viên, KHÔNG crash.
 */
export function LoiMoi() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { user, initialized } = useAuth();
  const { refresh } = useChurch();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [inv, setInv] = useState<Invitation | null>(null);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError('Link lời mời không hợp lệ (thiếu mã token).');
      return;
    }
    const load = async () => {
      setLoading(true);
      const { data, error: qErr } = await supabase
        .from('invitations')
        .select('*, church:churches (id, name, logo_url)')
        .eq('token', token)
        .single();
      setLoading(false);
      if (qErr || !data) {
        setError('Không tìm thấy lời mời. Link có thể đã sai, hết hạn hoặc đã bị thu hồi.');
        return;
      }
      const invitation = data as Invitation;
      if (invitation.accepted_at) {
        setError('Lời mời này đã được chấp nhận trước đó.');
        return;
      }
      if (new Date(invitation.expires_at).getTime() < Date.now()) {
        setError('Lời mời đã hết hạn. Vui lòng nhờ quản trị viên gửi lời mời mới.');
        return;
      }
      setInv(invitation);
    };
    void load();
  }, [token]);

  const join = async () => {
    if (!inv || !user) return;
    if (user.email?.toLowerCase() !== inv.email.toLowerCase()) {
      setError(`Lời mời này dành cho email ${inv.email}. Bạn đang đăng nhập bằng ${user.email} — hãy đăng xuất và đăng nhập/đăng ký đúng email được mời.`);
      return;
    }
    setJoining(true);
    setError('');
    try {
      // RPC server-side: kiểm tra email + hạn, thêm vào church_members, đánh dấu accepted_at.
      const { error: rpcErr } = await supabase.rpc('accept_invitation', { p_token: token });
      if (rpcErr) {
        const code = (rpcErr as { code?: string }).code ?? '';
        const msg = rpcErr.message ?? '';
        if (code === 'PGRST202' || /404/i.test(msg) || /could not find the function|does not exist/i.test(msg)) {
          // Function chưa được deploy trên project Supabase này.
          setError(
            'Tính năng tự tham gia chưa được kích hoạt trên máy chủ (chưa chạy migration accept_invitation). ' +
              'Vui lòng liên hệ quản trị viên (người đã gửi link này) để được thêm vào hội thánh ' +
              'bằng nút "Thêm vào hội thánh" ở trang Hội thánh.',
          );
        } else {
          setError(
            'Không thể tham gia: ' + msg + ' Vui lòng liên hệ quản trị viên để được thêm vào hội thánh.',
          );
        }
        return;
      }
      setJoined(true);
      toast(`Chào mừng bạn đến với ${inv.church?.name ?? 'hội thánh'}!`, 'success');
      await refresh();
    } catch (err) {
      // Lỗi mạng/không xác định — hiển thị, không crash.
      setError(
        'Không kết nối được máy chủ. ' +
          (err instanceof Error ? err.message : '') +
          ' Vui lòng kiểm tra mạng và thử lại, hoặc liên hệ quản trị viên.',
      );
    } finally {
      setJoining(false);
    }
  };

  if (loading || !initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg dark:bg-slate-900 sm:p-8">
        {error && !inv ? (
          <EmptyState icon="✉️" title="Không thể mở lời mời" message={error} action={<Link to="/"><Button variant="secondary">Về trang chủ</Button></Link>} />
        ) : joined ? (
          <div className="text-center">
            <div className="mb-3 text-5xl" aria-hidden>🎉</div>
            <h1 className="text-2xl font-bold">Tham gia thành công!</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Bạn đã là thành viên của <strong>{inv?.church?.name}</strong> với vai trò{' '}
              <strong>{inv ? ROLE_LABELS[inv.role] : ''}</strong>.
            </p>
            <Button className="mt-6" onClick={() => navigate('/bat-dau')}>
              Vào trang Tổng quan
            </Button>
          </div>
        ) : inv ? (
          <div className="text-center">
            <div className="mb-3 text-5xl" aria-hidden>⛪</div>
            <h1 className="text-2xl font-bold">Lời mời tham gia hội thánh</h1>
            <div className="mt-4 rounded-xl bg-slate-100 p-4 text-left text-sm dark:bg-slate-800">
              <p><strong>Hội thánh:</strong> {inv.church?.name ?? '—'}</p>
              <p><strong>Email được mời:</strong> {inv.email}</p>
              <p><strong>Vai trò:</strong> {ROLE_LABELS[inv.role]}</p>
              <p><strong>Hết hạn:</strong> {formatDateTime(inv.expires_at)}</p>
            </div>
            {error && (
              <p role="alert" className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-left text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                {error}
              </p>
            )}
            {!user ? (
              <div className="mt-6 flex flex-col gap-3">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Bạn cần đăng nhập (hoặc đăng ký) bằng đúng email <strong>{inv.email}</strong> để chấp nhận lời mời.
                </p>
                <Link to={`/dang-nhap`} state={{ from: `/loi-moi?token=${token}` }}>
                  <Button className="w-full">Đăng nhập</Button>
                </Link>
                <Link to="/dang-ky">
                  <Button variant="secondary" className="w-full">Đăng ký tài khoản mới</Button>
                </Link>
              </div>
            ) : (
              <Button className="mt-6 w-full" loading={joining} onClick={join}>
                ✅ Tham gia hội thánh
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default LoiMoi;
