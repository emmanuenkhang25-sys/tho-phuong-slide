// ============================================================
// Thờ Phượng Slide — nhóm EDITOR
// components/ProgramInfoPanel.tsx — panel "Thông tin chương trình":
// sửa tên/ngày/giờ/người phụ trách/chủ đề/câu Kinh Thánh/ghi chú +
// nhân bản, yêu thích, lưu trữ, xóa mềm.
// ============================================================
import { useEffect, useState } from 'react';
import type { Program } from '../../../lib/types';

export interface ProgramInfoPanelProps {
  open: boolean;
  onClose: () => void;
  program: Program;
  onSave: (patch: Partial<Program>) => void;
  onClone: () => void;
  onToggleFavorite: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

const inputCls =
  'w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 min-h-[40px]';
const btnCls =
  'inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium min-h-[40px]';
const primaryBtn = btnCls + ' bg-sky-600 text-white hover:bg-sky-700';
const ghostBtn = btnCls + ' border border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700';
const dangerBtn = btnCls + ' bg-red-600 text-white hover:bg-red-700';

export function ProgramInfoPanel(p: ProgramInfoPanelProps) {
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [leader, setLeader] = useState('');
  const [theme, setTheme] = useState('');
  const [themeVerse, setThemeVerse] = useState('');
  const [notes, setNotes] = useState('');
  const [confirming, setConfirming] = useState<'archive' | 'delete' | null>(null);

  useEffect(() => {
    if (p.open) {
      setTitle(p.program.title ?? '');
      setEventDate(p.program.event_date ?? '');
      setStartTime(p.program.start_time ?? '');
      setLeader(p.program.leader ?? '');
      setTheme(p.program.theme ?? '');
      setThemeVerse(p.program.theme_verse ?? '');
      setNotes(p.program.notes ?? '');
      setConfirming(null);
    }
  }, [p.open, p.program]);

  if (!p.open) return null;

  const handleSave = () => {
    p.onSave({
      title: title.trim() || 'Chương trình mới',
      event_date: eventDate || null,
      start_time: startTime || null,
      leader: leader.trim() || null,
      theme: theme.trim() || null,
      theme_verse: themeVerse.trim() || null,
      notes: notes.trim() || null,
    });
    p.onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2" role="dialog" aria-modal="true" aria-label="Thông tin chương trình">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-4 shadow-2xl dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">ℹ Thông tin chương trình</h2>
          <button className={ghostBtn} onClick={p.onClose} aria-label="Đóng">✕</button>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">Tên chương trình</label>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">Ngày tổ chức</label>
              <input type="date" className={inputCls} value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">Giờ bắt đầu</label>
              <input type="time" className={inputCls} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">Người phụ trách</label>
            <input className={inputCls} value={leader} onChange={(e) => setLeader(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">Chủ đề</label>
            <input className={inputCls} value={theme} onChange={(e) => setTheme(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">Câu Kinh Thánh chủ đề</label>
            <input className={inputCls} value={themeVerse} onChange={(e) => setThemeVerse(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">Ghi chú nội bộ</label>
            <textarea className={inputCls} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button className={ghostBtn} onClick={p.onClose}>Đóng</button>
          <button className={primaryBtn} onClick={handleSave}>Lưu thay đổi</button>
        </div>

        <hr className="my-4 border-slate-200 dark:border-slate-700" />
        <h3 className="mb-2 text-sm font-bold text-slate-600 dark:text-slate-300">Quản lý chương trình</h3>
        <div className="flex flex-wrap gap-2">
          <button className={ghostBtn} onClick={p.onClone} title="Tạo bản sao của toàn bộ chương trình">⧉ Nhân bản chương trình</button>
          <button className={ghostBtn} onClick={p.onToggleFavorite} title="Đánh dấu yêu thích">
            {p.program.is_favorite ? '★ Bỏ yêu thích' : '☆ Đánh dấu yêu thích'}
          </button>
          {confirming === 'archive' ? (
            <span className="flex gap-2">
              <button className={primaryBtn} onClick={() => { p.onArchive(); setConfirming(null); }}>Xác nhận lưu trữ</button>
              <button className={ghostBtn} onClick={() => setConfirming(null)}>Hủy</button>
            </span>
          ) : (
            <button className={ghostBtn} onClick={() => setConfirming('archive')}>📦 Lưu trữ</button>
          )}
          {confirming === 'delete' ? (
            <span className="flex gap-2">
              <button className={dangerBtn} onClick={() => { p.onDelete(); setConfirming(null); }}>Xác nhận xóa</button>
              <button className={ghostBtn} onClick={() => setConfirming(null)}>Hủy</button>
            </span>
          ) : (
            <button className={dangerBtn} onClick={() => setConfirming('delete')}>🗑 Xóa chương trình</button>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-400">Lưu trữ và xóa là xóa mềm — dữ liệu vẫn có thể khôi phục từ mục Sao lưu.</p>
      </div>
    </div>
  );
}
