// ============================================================================
// Thờ Phượng Slide — Thanh Hoàn tác nổi (dùng chung mọi màn hình đơn giản)
// Hiện mục hoàn tác gần nhất ở cuối màn hình: bấm “↩ Hoàn tác” là đảo ngược
// thao tác vừa làm; bấm ✕ là bỏ qua. Lỗi khi hoàn tác thì giữ mục để thử lại.
// ============================================================================
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/ui';
import { useUndoStore } from './undoStore';

export function UndoBar() {
  const entry = useUndoStore((s) => s.entry);
  const undoing = useUndoStore((s) => s.undoing);
  const { toast } = useToast();
  const navigate = useNavigate();

  if (!entry) return null;

  const doUndo = async () => {
    useUndoStore.getState().setUndoing(true);
    try {
      await entry.run({ go: (path) => navigate(path) });
      useUndoStore.getState().clear();
      useUndoStore.getState().bump();
      toast(`Đã hoàn tác: ${entry.label}`, 'success');
    } catch (e) {
      toast(`Hoàn tác lỗi: ${(e as Error).message}`, 'error');
    } finally {
      useUndoStore.getState().setUndoing(false);
    }
  };

  const dismiss = () => {
    entry.onDismiss?.();
    useUndoStore.getState().clear();
  };

  return (
    <div className="fixed bottom-3 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center gap-2 rounded-2xl border border-white/15 bg-[#23262b] p-2 shadow-2xl">
      <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{entry.label}</span>
      <button
        type="button"
        onClick={() => void doUndo()}
        disabled={undoing}
        className="flex min-h-[48px] shrink-0 items-center rounded-xl bg-amber-500 px-4 text-sm font-bold text-black disabled:opacity-50"
      >
        ↩ Hoàn tác
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Đóng hoàn tác"
        className="flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-xl border border-white/10 text-lg text-slate-300"
      >
        ✕
      </button>
    </div>
  );
}

export default UndoBar;
