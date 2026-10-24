/** Quản lý dark/light mode: lưu localStorage, gắn class lên documentElement. */
const KEY = 'tps:theme';
export type Theme = 'light' | 'dark';

export function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'dark' || v === 'light') return v;
  } catch {
    /* bỏ qua */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(t: Theme): void {
  document.documentElement.classList.toggle('dark', t === 'dark');
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* bỏ qua */
  }
}

export function applyStoredTheme(): void {
  applyTheme(getStoredTheme());
}
