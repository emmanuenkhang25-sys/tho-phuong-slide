import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import { AppRouter } from './app/router';
import { useAuth } from './stores/auth';
import { applyTheme } from './lib/theme';
import { Toaster } from './components/ui';

function Boot() {
  const init = useAuth((s) => s.init);

  useEffect(() => {
    // Giao diện chính là nền tối — bật dark mode mặc định cho toàn app
    // (người dùng vẫn có thể đổi trong Cài đặt).
    try {
      if (!localStorage.getItem('tps:theme')) applyTheme('dark');
      else applyTheme(localStorage.getItem('tps:theme') === 'light' ? 'light' : 'dark');
    } catch {
      applyTheme('dark');
    }
    const off = init();
    registerSW({ immediate: true });
    return off;
  }, [init]);

  return (
    <>
      <AppRouter />
      <Toaster />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Boot />
  </StrictMode>,
);
