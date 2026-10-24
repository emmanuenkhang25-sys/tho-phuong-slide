import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../stores/auth';
import { Button, EnvWarning, Input } from '../components/ui';

export function QuenMatKhau() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Vui lòng nhập email đã đăng ký.');
      return;
    }
    setBusy(true);
    const r = await sendPasswordReset(email);
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? 'Gửi link thất bại.');
      return;
    }
    setSent(true);
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <EnvWarning />
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg dark:bg-slate-900 sm:p-8">
          {sent ? (
            <div className="text-center">
              <div className="mb-3 text-5xl" aria-hidden>
                📧
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Đã gửi link đặt lại</h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Nếu email <strong>{email}</strong> đã đăng ký, bạn sẽ nhận được link đặt lại mật khẩu
                trong vài phút. Link có hiệu lực trong thời gian ngắn — hãy kiểm tra cả thư mục Spam.
              </p>
              <Link to="/dang-nhap" className="mt-6 inline-block">
                <Button variant="secondary">Quay lại đăng nhập</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6 text-center">
                <div className="mb-3 text-5xl" aria-hidden>
                  🔑
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Quên mật khẩu</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Nhập email đã đăng ký — chúng tôi sẽ gửi link đặt lại mật khẩu cho bạn.
                </p>
              </div>
              <form onSubmit={submit} className="flex flex-col gap-4">
                <Input
                  label="Email"
                  type="email"
                  autoComplete="email"
                  placeholder="vidu@hoithanh.vn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {error && (
                  <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    {error}
                  </p>
                )}
                <Button type="submit" loading={busy}>
                  Gửi link đặt lại
                </Button>
              </form>
              <p className="mt-6 text-center text-sm">
                <Link to="/dang-nhap" className="font-semibold text-church-700 dark:text-church-300">
                  ← Quay lại đăng nhập
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default QuenMatKhau;
