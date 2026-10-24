import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../stores/auth';
import { Button, EnvWarning, Input, useToast } from '../components/ui';

export function DangNhap() {
  const { user, initialized, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (initialized && user) {
    const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
    return <Navigate to={from} replace />;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }
    setBusy(true);
    const r = await signIn(email, password);
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? 'Đăng nhập thất bại.');
      return;
    }
    toast('Đăng nhập thành công. Chào mừng trở lại!', 'success');
    const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
    navigate(from, { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <EnvWarning />
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg dark:bg-slate-900 sm:p-8">
          <div className="mb-6 text-center">
            <img src="/icon.svg" alt="" className="mx-auto mb-3 h-14 w-14" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Đăng nhập</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Chào mừng trở lại với Thờ Phượng Slide</p>
          </div>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="vidu@hoithanh.vn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={undefined}
            />
            <Input
              label="Mật khẩu"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                {error}
              </p>
            )}
            <Button type="submit" loading={busy}>
              Đăng nhập
            </Button>
          </form>
          <div className="mt-6 flex flex-col items-center gap-2 text-sm">
            <Link to="/quen-mat-khau" className="min-h-touch font-medium text-church-700 dark:text-church-300">
              Quên mật khẩu?
            </Link>
            <p className="text-slate-500 dark:text-slate-400">
              Chưa có tài khoản?{' '}
              <Link to="/dang-ky" className="font-semibold text-church-700 dark:text-church-300">
                Đăng ký ngay
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DangNhap;
