import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import { AppRouter } from './app/router';
import { useAuth } from './stores/auth';
import { applyStoredTheme } from './lib/theme';
import { Toaster } from './components/ui';

function Boot() {
  const init = useAuth((s) => s.init);

  useEffect(() => {
    applyStoredTheme();
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
