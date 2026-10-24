import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../stores/auth';
import { supabase } from '../lib/supabase';
import { Button, EnvWarning, Input, Spinner, useToast } from '../components/ui';

/**
 * Trang đổi mật khẩu sau khi bấm link trong email.
 * Supabase tự gắn session recovery khi mở link → kiểm tra session trước khi cho đổi.
 */
export function DatLaiMatKhau() {
  const { updatePassword, initialized } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Đợi Supabase xử lý token trong URL (recovery link)
    const t = setTimeout(() => {
      void supabase.auth.getSession().then(({ data }) => {
        setHasSession(!!data.session);
        setChecking(false);
      });
    }, 600);
    return () => clearTimeout(t);
  }, []);

  if (!initialized) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    if (password !== confirm) {
      setError('Mật khẩu nhập lại chưa khớp.');
      return;
    }
    setBusy(true);
    const r = await updatePassword(password);
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? 'Đổi mật khẩu thất bại.');
      return;
    }
    toast('Đổi mật khẩu thành công!', 'success');
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <EnvWarning />
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg dark:bg-slate-900 sm:p-8">
          {checking ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Spinner size="lg" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Đang kiểm tra link đặt lại…</p>
            </div>
          ) : !hasSession ? (
            <div className="text-center">
              <div className="mb-3 text-5xl" aria-hidden>
                ⏰
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Link không hợp lệ</h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Link đặt lại mật khẩu đã hết hạn hoặc không đúng. Vui lòng yêu cầu gửi lại link mới.
              </p>
              <Link to="/quen-mat-khau" className="mt-6 inline-block">
                <Button>Gửi lại link</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6 text-center">
                <div className="mb-3 text-5xl" aria-hidden>
                  🔐
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Đặt lại mật khẩu</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Nhập mật khẩu mới cho tài khoản của bạn.</p>
              </div>
              <form onSubmit={submit} className="flex flex-col gap-4">
                <Input
                  label="Mật khẩu mới"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Ít nhất 6 ký tự"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Input
                  label="Nhập lại mật khẩu mới"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                {error && (
                  <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    {error}
                  </p>
                )}
                <Button type="submit" loading={busy}>
                  Đổi mật khẩu
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default DatLaiMatKhau;
