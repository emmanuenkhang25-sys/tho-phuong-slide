// ============================================================
// Thờ Phượng Slide — nhóm EDITOR
// components/StatusBar.tsx — thanh trạng thái dưới cùng.
// ============================================================
import type { AspectRatio } from '../../../lib/types';
import { useSyncStatus } from '../../../stores/sync';

export interface StatusBarProps {
  slideCount: number;
  objectCount: number;
  aspect: AspectRatio;
  selectedSlideIndex: number; // 0-based, -1 nếu chưa chọn
}

export function StatusBar(p: StatusBarProps) {
  const { status, message } = useSyncStatus();
  return (
    <div className="flex items-center gap-4 border-t border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
      <span title="Tổng số slide trong chương trình">
        📄 {p.slideCount} slide{p.selectedSlideIndex >= 0 ? ` — đang ở slide ${p.selectedSlideIndex + 1}` : ''}
      </span>
      <span title="Tỉ lệ khung hình">🖥 {p.aspect}</span>
      <span title="Số đối tượng trên slide đang chọn">🧩 {p.objectCount} đối tượng</span>
      <span className="ml-auto" title={message}>{message || status}</span>
    </div>
  );
}
