import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../stores/auth';
import { useChurch } from '../stores/church';
import { useSyncStatus, type SyncStatusValue } from '../stores/sync';
import { applyTheme, getStoredTheme, type Theme } from '../lib/theme';
import { Button, EnvWarning, Spinner, useToast } from './ui';

const NAV = [
  { to: '/p', label: 'Chương trình', icon: '📋' },
  { to: '/dashboard', label: 'Tổng quan', icon: '🏠' },
  { to: '/hoi-thanh', label: 'Hội thánh', icon: '⛪' },
  { to: '/mau-slide', label: 'Mẫu slide', icon: '🖼️' },
  { to: '/sao-luu', label: 'Sao lưu', icon: '💾' },
  { to: '/huong-dan', label: 'Hướng dẫn', icon: '❓' },
  { to: '/cai-dat', label: 'Cài đặt', icon: '⚙️' },
];

const SYNC_CHIP: Record<SyncStatusValue, { label: string; cls: string }> = {
  'dang-luu': { label: 'Đang lưu…', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  'da-luu-may': { label: 'Đã lưu trên máy', cls: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300' },
  'da-dong-bo': { label: 'Đã đồng bộ', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  'ngoai-tuyen': { label: 'Ngoại tuyến', cls: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
  loi: { label: 'Lỗi đồng bộ', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
};

function SyncChip() {
  const { status, message } = useSyncStatus();
  const chip = SYNC_CHIP[status];
  return (
    <span
      title={message}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${chip.cls}`}
    >
      <span className="h-2 w-2 rounded-full bg-current" aria-hidden />
      {chip.label}
    </span>
  );
}

function ChurchSwitcher() {
  const { churches, currentChurch, setCurrentChurch, loading } = useChurch();
  if (loading) return <Spinner size="sm" />;
  if (churches.length === 0) {
    return (
      <Link
        to="/hoi-thanh"
        className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
      >
        ➕ Tham gia / tạo hội thánh
      </Link>
    );
  }
  return (
    <select
      aria-label="Chọn hội thánh"
      value={currentChurch?.id ?? ''}
      onChange={(e) => setCurrentChurch(e.target.value)}
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
    >
      {churches.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());
  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  };
  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      className="flex min-h-touch min-w-touch items-center justify-center rounded-lg text-xl hover:bg-slate-200 dark:hover:bg-slate-700"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex min-h-touch items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive
                ? 'bg-church-700 text-white dark:bg-church-600'
                : 'text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800'
            }`
          }
        >
          <span className="text-lg" aria-hidden>
            {item.icon}
          </span>
          {item.label}
        </NavLink>
      ))}
    </>
  );
}

export function Layout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    toast('Đã đăng xuất.', 'info');
    navigate('/dang-nhap');
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar — desktop */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:flex">
        <Link to="/dashboard" className="mb-4 flex min-h-touch items-center gap-2 px-2">
          <img src="/icon.svg" alt="" className="h-9 w-9" />
          <span className="text-lg font-bold text-church-800 dark:text-church-300">Thờ Phượng Slide</span>
        </Link>
        <div className="mb-4">
          <ChurchSwitcher />
        </div>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Điều hướng chính">
          <NavLinks />
        </nav>
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <SyncChip />
            <ThemeToggle />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {profile?.display_name || profile?.email || 'Tài khoản'}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{profile?.email}</p>
            </div>
          </div>
          <Button variant="ghost" onClick={handleSignOut} className="justify-start px-2">
            🚪 Đăng xuất
          </Button>
        </div>
      </aside>

      {/* Nội dung */}
      <div className="flex min-w-0 flex-1 flex-col">
        <EnvWarning />
        {/* Header mobile */}
        <header className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900 md:hidden">
          <Link to="/dashboard" className="flex min-h-touch items-center gap-2">
            <img src="/icon.svg" alt="" className="h-8 w-8" />
            <span className="font-bold text-church-800 dark:text-church-300">Thờ Phượng Slide</span>
          </Link>
          <div className="flex items-center gap-1">
            <SyncChip />
            <ThemeToggle />
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Mở menu"
              aria-expanded={menuOpen}
              className="flex min-h-touch min-w-touch items-center justify-center rounded-lg text-xl hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </header>
        {menuOpen && (
          <div className="border-b border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:hidden">
            <div className="mb-3">
              <ChurchSwitcher />
            </div>
            <nav className="flex flex-col gap-1" aria-label="Điều hướng chính">
              <NavLinks onNavigate={() => setMenuOpen(false)} />
            </nav>
            <Button variant="ghost" onClick={handleSignOut} className="mt-3 w-full justify-start">
              🚪 Đăng xuất ({profile?.display_name || profile?.email})
            </Button>
          </div>
        )}

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:pb-10">
          <Outlet />
        </main>

        {/* Bottom nav — mobile */}
        <nav
          aria-label="Điều hướng chính"
          className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-6 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex min-h-touch flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium ${
                  isActive ? 'text-church-700 dark:text-church-300' : 'text-slate-500 dark:text-slate-400'
                }`
              }
            >
              <span className="text-xl" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

export default Layout;
