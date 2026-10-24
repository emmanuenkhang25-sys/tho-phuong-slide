import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { create } from 'zustand';
import { supabaseConfigured } from '../lib/supabase';

/* ------------------------------- Button ------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-church-700 text-white hover:bg-church-800 focus-visible:ring-church-500 dark:bg-church-600 dark:hover:bg-church-500',
  secondary:
    'bg-slate-200 text-slate-900 hover:bg-slate-300 focus-visible:ring-slate-400 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
  ghost:
    'bg-transparent text-church-700 hover:bg-church-50 focus-visible:ring-church-500 dark:text-church-300 dark:hover:bg-slate-800',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  loading = false,
  className = '',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex min-h-touch items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-slate-900 ${variantClasses[variant]} ${className}`}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}

/* --------------------------- Input / TextArea -------------------------- */

interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
}

function fieldClasses(hasError: boolean) {
  return `w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 ${
    hasError
      ? 'border-red-500 focus:ring-red-500'
      : 'border-slate-300 focus:border-church-500 focus:ring-church-500 dark:border-slate-600'
  }`;
}

export function Field({ label, hint, error, children, id }: FieldProps & { children: ReactNode; id?: string }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  FieldProps & React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ label, hint, error, id: idProp, ...rest }, ref) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <Field label={label} hint={hint} error={error} id={id}>
      <input ref={ref} id={id} {...rest} className={`${fieldClasses(!!error)} ${rest.className ?? ''}`} />
    </Field>
  );
});

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  FieldProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({ label, hint, error, id: idProp, ...rest }, ref) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <Field label={label} hint={hint} error={error} id={id}>
      <textarea ref={ref} id={id} {...rest} className={`${fieldClasses(!!error)} ${rest.className ?? ''}`} />
    </Field>
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  FieldProps & React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ label, hint, error, id: idProp, children, ...rest }, ref) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <Field label={label} hint={hint} error={error} id={id}>
      <select ref={ref} id={id} {...rest} className={`${fieldClasses(!!error)} ${rest.className ?? ''}`}>
        {children}
      </select>
    </Field>
  );
});

/* -------------------------------- Modal -------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Focus vào dialog khi mở (accessible)
    dialogRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`w-full rounded-t-2xl bg-white p-5 shadow-xl outline-none dark:bg-slate-900 sm:rounded-2xl ${
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md'
        } max-h-[90vh] overflow-y-auto`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="flex min-h-touch min-w-touch items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ----------------------------- ConfirmDialog ---------------------------- */

export function ConfirmDialog({
  open,
  onClose,
  onCancel,
  onConfirm,
  title,
  message,
  confirmLabel,
  confirmText,
  cancelText = 'Hủy',
  danger = false,
  loading = false,
}: {
  open: boolean;
  onClose?: () => void;
  /** alias của onClose (tương thích nhóm khác) */
  onCancel?: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  /** alias của confirmLabel (tương thích nhóm khác) */
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  loading?: boolean;
}) {
  const handleClose = onClose ?? onCancel ?? (() => {});
  const okLabel = confirmLabel ?? confirmText ?? 'Xác nhận';
  return (
    <Modal open={open} onClose={handleClose} title={title}>
      <div className="text-sm text-slate-600 dark:text-slate-300">{message}</div>
      <div className="mt-6 flex gap-3">
        <Button variant="secondary" onClick={handleClose} className="flex-1">
          {cancelText}
        </Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          loading={loading}
          onClick={() => void onConfirm()}
          className="flex-1"
        >
          {okLabel}
        </Button>
      </div>
    </Modal>
  );
}

/* -------------------------------- Toast -------------------------------- */

interface ToastItem {
  id: number;
  message: string;
  kind: 'success' | 'error' | 'info';
}

const useToastStore = create<{ toasts: ToastItem[]; push: (t: Omit<ToastItem, 'id'>) => void; dismiss: (id: number) => void }>(
  (set) => ({
    toasts: [],
    push: (t) =>
      set((s) => ({ toasts: [...s.toasts, { ...t, id: Date.now() + Math.random() }] })),
    dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  }),
);

/** Hook hiển thị toast: const { toast } = useToast(); toast('Đã lưu', 'success') */
export function useToast() {
  const push = useToastStore((s) => s.push);
  const toast = useCallback(
    (message: string, kind: ToastItem['kind'] = 'info') => push({ message, kind }),
    [push],
  );
  return { toast };
}

const toastStyles: Record<ToastItem['kind'], string> = {
  success: 'bg-emerald-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-slate-800 text-white dark:bg-slate-700',
};

/** Render 1 lần ở gốc app (đã gắn trong main.tsx). */
export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) => setTimeout(() => dismiss(t.id), 3500));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);
  return (
    <div className="pointer-events-none fixed bottom-20 left-0 right-0 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto min-h-touch rounded-lg px-4 py-2 text-sm font-medium shadow-lg ${toastStyles[t.kind]}`}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------- Spinner ------------------------------- */

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-10 w-10' : 'h-6 w-6';
  return (
    <span
      role="status"
      aria-label="Đang tải"
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${cls}`}
    />
  );
}

/* ------------------------------- EmptyState ------------------------------ */

export function EmptyState({
  icon = '📭',
  title,
  message,
  action,
}: {
  icon?: string;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900">
      <div className="text-4xl" aria-hidden>{icon}</div>
      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
      {message && <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{message}</p>}
      {action}
    </div>
  );
}

/* ------------------------------- EnvWarning ------------------------------ */

/** Cảnh báo khi thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (supabase.ts). */
export function EnvWarning() {
  const [show, setShow] = useState(true);
  if (supabaseConfigured || !show) return null;
  return (
    <div className="bg-amber-100 px-4 py-3 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-200" role="alert">
      <div className="mx-auto flex max-w-5xl items-start justify-between gap-3">
        <p>
          ⚠️ <strong>Chưa cấu hình Supabase.</strong> Copy <code>apps/web/.env.example</code> thành{' '}
          <code>.env</code> và điền <code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_ANON_KEY</code>,
          sau đó chạy lại dev server.
        </p>
        <button onClick={() => setShow(false)} aria-label="Ẩn cảnh báo" className="min-h-touch min-w-touch font-bold">
          ✕
        </button>
      </div>
    </div>
  );
}

/* -------------------------------- Context -------------------------------- */

const ToastContext = createContext<null>(null);
export function ToastProvider({ children }: { children: ReactNode }) {
  return <ToastContext.Provider value={null}>{children}</ToastContext.Provider>;
}
export function useToastContext() {
  return useContext(ToastContext);
}
