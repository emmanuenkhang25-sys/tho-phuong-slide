import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../stores/auth';
import { Button, EnvWarning, Input, useToast } from '../components/ui';

export function DangKy() {
  const { user, initialized, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (initialized && user) return <Navigate to="/dashboard" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!displayName.trim()) {
      setError('Vui lòng nhập tên hiển thị (VD: Anh Tuấn).');
      return;
    }
    if (!email.trim()) {
      setError('Vui lòng nhập email.');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    if (password !== confirm) {
      setError('Mật khẩu nhập lại chưa khớp.');
      return;
    }
    setBusy(true);
    const r = await signUp(email, password, displayName);
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? 'Đăng ký thất bại.');
      return;
    }
    if (r.needsVerification) {
      setDone(true); // Nhắc kiểm tra email xác minh
    } else {
      toast('Đăng ký thành công. Chào mừng bạn!', 'success');
      navigate('/dashboard', { replace: true });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <EnvWarning />
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg dark:bg-slate-900 sm:p-8">
          {done ? (
            <div className="text-center">
              <div className="mb-3 text-5xl" aria-hidden>
                📧
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Kiểm tra email của bạn</h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Chúng tôi đã gửi link xác minh tới <strong>{email}</strong>. Vui lòng mở email và bấm vào
                link để kích hoạt tài khoản, sau đó quay lại{' '}
                <Link to="/dang-nhap" className="font-semibold text-church-700 dark:text-church-300">
                  đăng nhập
                </Link>
                .
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Không thấy email? Hãy kiểm tra thư mục Spam/Quảng cáo.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6 text-center">
                <img src="/icon.svg" alt="" className="mx-auto mb-3 h-14 w-14" />
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Đăng ký</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Tạo tài khoản để bắt đầu soạn slide thờ phượng
                </p>
              </div>
              <form onSubmit={submit} className="flex flex-col gap-4">
                <Input
                  label="Tên hiển thị"
                  type="text"
                  autoComplete="name"
                  placeholder="VD: Chị Hân"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
                <Input
                  label="Email"
                  type="email"
                  autoComplete="email"
                  placeholder="vidu@hoithanh.vn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Input
                  label="Mật khẩu"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Ít nhất 6 ký tự"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Input
                  label="Nhập lại mật khẩu"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Nhập lại mật khẩu"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                {error && (
                  <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    {error}
                  </p>
                )}
                <Button type="submit" loading={busy}>
                  Đăng ký
                </Button>
              </form>
              <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
                Đã có tài khoản?{' '}
                <Link to="/dang-nhap" className="font-semibold text-church-700 dark:text-church-300">
                  Đăng nhập
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default DangKy;
