// ============================================================
// Thờ Phượng Slide — nhóm EDITOR
// components/Toolbar.tsx — thanh công cụ trên cùng của editor.
// ============================================================
import { Link } from 'react-router-dom';
import type { AspectRatio, Program, Section, Slide } from '../../../lib/types';
import { useSyncStatus } from '../../../stores/sync';
import { ExportMenu } from '../../export/components/ExportMenu';

export interface ToolbarProps {
  /** Chương trình đang mở — truyền vào ExportMenu. */
  program: Program;
  sections: Section[];
  slides: Slide[];
  onAddSlide: () => void;
  onDuplicateSlide: () => void;
  onDeleteSlide: () => void;
  onAddSection: () => void;
  onOpenSplit: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onAddText: () => void;
  onAddShape: (shape: 'rect' | 'ellipse' | 'line') => void;
  onAddImage: () => void;
  onOpenLibrary: () => void;
  aspect: AspectRatio;
  onAspectChange: (a: AspectRatio) => void;
  onPresent: () => void;
  onOpenInfo: () => void;
  onSyncNow: () => void;
}

const btn =
  'inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-40 disabled:pointer-events-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 min-h-[36px]';
const iconBtn =
  'inline-flex items-center justify-center rounded-md border border-slate-300 bg-white w-9 h-9 text-slate-700 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-40 disabled:pointer-events-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
const group = 'flex items-center gap-1 flex-wrap';
const sep = 'mx-1 h-6 w-px bg-slate-300 dark:bg-slate-600';

const SYNC_LABEL: Record<string, string> = {
  'dang-luu': 'Đang lưu…',
  'da-luu-may': 'Đã lưu trên máy',
  'da-dong-bo': 'Đã lưu trên đám mây',
  'ngoai-tuyen': 'Ngoại tuyến',
  'loi': 'Lỗi đồng bộ',
};

export function Toolbar(p: ToolbarProps) {
  const { status, message } = useSyncStatus();
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900">
      {/* Nhóm slide */}
      <div className={group} role="toolbar" aria-label="Thao tác slide">
        <button className={iconBtn} title="Thêm slide (vào mục đang chọn)" onClick={p.onAddSlide}>＋</button>
        <button className={iconBtn} title="Nhân bản slide (Ctrl+D)" onClick={p.onDuplicateSlide}>⧉</button>
        <button className={iconBtn} title="Xóa slide đang chọn" onClick={p.onDeleteSlide}>🗑</button>
      </div>
      <div className={sep} />
      {/* Nhóm mục + chèn nội dung */}
      <div className={group}>
        <button className={btn} title="Thêm mục mới vào chương trình" onClick={p.onAddSection}>＋ Mục</button>
        <button className={btn} title="Tự động chia bài hát / Kinh Thánh thành nhiều slide" onClick={p.onOpenSplit}>🎵 Bài hát / Kinh Thánh</button>
        <Link className={btn} to="/mau-slide" title="Mở thư viện mẫu slide">🎨 Mẫu slide</Link>
      </div>
      <div className={sep} />
      {/* Undo / redo */}
      <div className={group}>
        <button className={iconBtn} title="Hoàn tác (Ctrl+Z)" disabled={!p.canUndo} onClick={p.onUndo}>↩</button>
        <button className={iconBtn} title="Làm lại (Ctrl+Y)" disabled={!p.canRedo} onClick={p.onRedo}>↪</button>
      </div>
      <div className={sep} />
      {/* Thêm đối tượng */}
      <div className={group} aria-label="Thêm đối tượng">
        <button className={btn} title="Thêm hộp chữ" onClick={p.onAddText}>T Chữ</button>
        <button className={iconBtn} title="Thêm hình chữ nhật" onClick={() => p.onAddShape('rect')}>▭</button>
        <button className={iconBtn} title="Thêm hình bầu dục" onClick={() => p.onAddShape('ellipse')}>⬭</button>
        <button className={iconBtn} title="Thêm đường thẳng" onClick={() => p.onAddShape('line')}>╱</button>
        <button className={btn} title="Thêm ảnh từ máy" onClick={p.onAddImage}>🖼 Ảnh</button>
        <button className={btn} title="Chọn ảnh từ thư viện hội thánh" onClick={p.onOpenLibrary}>🗂 Thư viện</button>
      </div>

      <div className="flex-1" />

      {/* Nhóm phải */}
      <div className={group}>
        <label className="text-sm text-slate-600 dark:text-slate-300" htmlFor="aspect-select">Tỉ lệ</label>
        <select
          id="aspect-select"
          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 min-h-[36px]"
          value={p.aspect}
          onChange={(e) => p.onAspectChange(e.target.value as AspectRatio)}
        >
          <option value="16:9">16:9</option>
          <option value="4:3">4:3</option>
        </select>
        <button className={btn} title="Mở trình chiếu" onClick={p.onPresent}>▶ Trình chiếu</button>
        <button className={btn} title="Thông tin chương trình" onClick={p.onOpenInfo}>ℹ Thông tin</button>
        <button className={btn} title="Đồng bộ ngay lên đám mây" onClick={p.onSyncNow}>⟳ Đồng bộ</button>
        {/* COORDINATOR: gắn ExportMenu tại đây */}
        <ExportMenu program={p.program} sections={p.sections} slides={p.slides} />
        <span
          className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
          title={message || SYNC_LABEL[status]}
        >
          <span
            className={
              'mr-1.5 inline-block h-2 w-2 rounded-full ' +
              (status === 'da-dong-bo'
                ? 'bg-green-500'
                : status === 'dang-luu'
                  ? 'bg-amber-500 animate-pulse'
                  : status === 'ngoai-tuyen'
                    ? 'bg-slate-400'
                    : status === 'loi'
                      ? 'bg-red-500'
                      : 'bg-sky-500')
            }
          />
          {message || SYNC_LABEL[status] || status}
        </span>
      </div>
    </div>
  );
}
