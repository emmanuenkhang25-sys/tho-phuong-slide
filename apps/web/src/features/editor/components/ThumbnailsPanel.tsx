// ============================================================
// Thờ Phượng Slide — nhóm EDITOR
// components/ThumbnailsPanel.tsx — cột thumbnails bên trái, nhóm theo mục.
// Kéo-thả HTML5 để đổi thứ tự; trên mobile dùng nút lên/xuống.
// ============================================================
import { useState } from 'react';
import type { Section, Slide } from '../../../lib/types';
import { SlideRenderer } from './SlideRenderer';
import { sectionKindLabel } from '../lib/editorUtils';

export interface ThumbnailsPanelProps {
  sections: Section[];
  slides: Slide[];
  selectedSlideId: string | null;
  aspect: '16:9' | '4:3';
  onSelectSlide: (id: string) => void;
  onAddSlide: (sectionId: string | null) => void;
  onDuplicateSlide: (id: string) => void;
  onDeleteSlide: (id: string) => void;
  onMoveSlideUp: (id: string) => void;
  onMoveSlideDown: (id: string) => void;
  /** Kéo slide thả vào vị trí destIndex trong mục destSectionId. */
  onDropSlide: (dragId: string, destSectionId: string | null, destIndex: number) => void;
  /** Kéo mục thả trước mục beforeId (null = xuống cuối). */
  onDropSection: (dragId: string, beforeId: string | null) => void;
  onRenameSection: (id: string, title: string) => void;
  onDeleteSection: (id: string) => void;
  onMoveSectionUp: (id: string) => void;
  onMoveSectionDown: (id: string) => void;
  /** Mở modal "Thêm bài hát" và chọn sẵn mục này (nút nổi bật cho mục hát). */
  onOpenSplitForSection?: (sectionId: string) => void;
}

/** Các mục hát — hiện nút "Thêm bài hát" nổi bật. */
const SONG_SECTION_KINDS = new Set([
  'hat-tho-phuong',
  'thanh-ca',
  'ton-vinh-chua',
  'ton-vinh-chua-2',
  'dap-ung-loi-chua',
]);

const smallBtn =
  'inline-flex items-center justify-center rounded border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-100 min-w-[40px] min-h-[40px] px-1.5 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700';

export function ThumbnailsPanel(p: ThumbnailsPanelProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  // Accordion: mục nào đang thu gọn. Mặc định chỉ mở mục đầu tiên.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const orderedSections = [...p.sections].sort((a, b) => a.order_index - b.order_index);
  const sectionKey = (sectionId: string | null) => sectionId ?? '__none__';
  const isCollapsed = (sectionId: string | null, index: number) =>
    collapsed[sectionKey(sectionId)] ?? index !== 0;
  const toggleCollapsed = (sectionId: string | null, index: number) =>
    setCollapsed((c) => ({ ...c, [sectionKey(sectionId)]: !isCollapsed(sectionId, index) }));
  const slidesOf = (sectionId: string | null) =>
    p.slides.filter((s) => s.section_id === sectionId);

  const commitRename = (id: string) => {
    const v = renameValue.trim();
    if (v) p.onRenameSection(id, v);
    setRenamingId(null);
  };

  const renderThumb = (slide: Slide, indexInSection: number, sectionId: string | null) => {
    const selected = slide.id === p.selectedSlideId;
    return (
      <div
        key={slide.id}
        draggable
        onDragStart={(e) => {
          setDragId(slide.id);
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', slide.id);
        }}
        onDragEnd={() => setDragId(null)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const raw = e.dataTransfer.getData('text/plain') || dragId || '';
          if (raw.startsWith('section:')) return; // thả mục lên slide: bỏ qua
          if (raw && raw !== slide.id) p.onDropSlide(raw, sectionId, indexInSection);
        }}
        className={
          'group relative cursor-pointer rounded-md border-2 p-1 ' +
          (selected
            ? 'border-sky-500 bg-sky-50 dark:bg-sky-950'
            : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600') +
          (dragId === slide.id ? ' opacity-40' : '')
        }
        onClick={() => p.onSelectSlide(slide.id)}
        title={`Slide ${slide.order_index + 1} — kéo để đổi vị trí`}
      >
        <SlideRenderer slide={slide} width={132} aspect={p.aspect} />
        <div className="mt-0.5 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">#{slide.order_index + 1}</span>
          <span className="flex gap-0.5">
            <button className={smallBtn} title="Nhân bản slide" onClick={(e) => { e.stopPropagation(); p.onDuplicateSlide(slide.id); }}>⧉</button>
            <button className={smallBtn} title="Xóa slide" onClick={(e) => { e.stopPropagation(); p.onDeleteSlide(slide.id); }}>✕</button>
          </span>
        </div>
        {/* Nút lên/xuống luôn hiển thị (mobile không kéo-thả được) */}
        <div className="mt-1 flex gap-1">
          <button className={smallBtn + ' flex-1'} title="Chuyển slide lên trên" onClick={(e) => { e.stopPropagation(); p.onMoveSlideUp(slide.id); }}>▲ Lên</button>
          <button className={smallBtn + ' flex-1'} title="Chuyển slide xuống dưới" onClick={(e) => { e.stopPropagation(); p.onMoveSlideDown(slide.id); }}>▼ Xuống</button>
        </div>
      </div>
    );
  };

  const renderSection = (sec: Section | null, index: number) => {
    const sectionId = sec?.id ?? null;
    const list = slidesOf(sectionId);
    const title = sec ? sec.title : 'Chưa phân mục';
    const collapsedNow = isCollapsed(sectionId, index);
    const isSongSection = !!sec && SONG_SECTION_KINDS.has(sec.kind);
    return (
      <div
        key={sectionId ?? '__none__'}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const raw = e.dataTransfer.getData('text/plain') || dragId || '';
          if (raw.startsWith('section:')) {
            const sid = raw.slice('section:'.length);
            if (sec && sid !== sec.id) p.onDropSection(sid, sectionId);
            return;
          }
          if (raw) p.onDropSlide(raw, sectionId, list.length);
        }}
        className="mb-3 rounded-lg bg-slate-50 p-1.5 dark:bg-slate-800/60"
      >
        <div
          className={'mb-1 flex items-center gap-1 px-1' + (sec ? ' cursor-grab active:cursor-grabbing' : '')}
          draggable={!!sec}
          title={sec ? 'Kéo để đổi vị trí mục' : undefined}
          onDragStart={(e) => {
            if (!sec) return;
            e.stopPropagation();
            const key = `section:${sec.id}`;
            setDragId(key);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', key);
          }}
          onDragEnd={() => setDragId(null)}
        >
          {/* Nút xổ ra / thu gọn (accordion) */}
          <button
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-lg text-slate-500 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
            title={collapsedNow ? 'Mở rộng mục' : 'Thu gọn mục'}
            aria-label={collapsedNow ? `Mở rộng mục ${title}` : `Thu gọn mục ${title}`}
            onClick={() => toggleCollapsed(sectionId, index)}
          >
            {collapsedNow ? '▸' : '▾'}
          </button>
          {renamingId === sectionId ? (
            <input
              autoFocus
              className="min-w-0 flex-1 rounded border border-sky-400 px-1.5 py-1 text-sm dark:bg-slate-900"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => sec && commitRename(sec.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && sec) commitRename(sec.id);
                if (e.key === 'Escape') setRenamingId(null);
              }}
            />
          ) : (
            <span
              className="min-w-0 flex-1 cursor-pointer truncate text-sm font-semibold text-slate-700 dark:text-slate-200"
              title={sec ? `${title} (${sectionKindLabel(sec.kind)}) — bấm để ${collapsedNow ? 'mở rộng' : 'thu gọn'}` : title}
              onClick={() => toggleCollapsed(sectionId, index)}
            >
              {title}
              {sec && <span className="ml-1 text-[11px] font-normal text-slate-400">· {sectionKindLabel(sec.kind)}</span>}
              <span className="ml-1 rounded-full bg-slate-200 px-1.5 text-[11px] font-normal text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                {list.length}
              </span>
            </span>
          )}
          {sec && (
            <span className="flex gap-0.5">
              <button className={smallBtn} title="Đổi tên mục" onClick={() => { setRenamingId(sec.id); setRenameValue(sec.title); }}>✎</button>
              <button className={smallBtn} title="Chuyển mục lên" onClick={() => p.onMoveSectionUp(sec.id)}>▲</button>
              <button className={smallBtn} title="Chuyển mục xuống" onClick={() => p.onMoveSectionDown(sec.id)}>▼</button>
              <button className={smallBtn} title="Xóa mục (slide giữ lại ở 'Chưa phân mục')" onClick={() => p.onDeleteSection(sec.id)}>🗑</button>
            </span>
          )}
        </div>
        {!collapsedNow && (
          <>
            {/* Nút thêm bài hát nổi bật cho mục hát */}
            {isSongSection && p.onOpenSplitForSection && (
              <button
                className="mb-1.5 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 text-sm font-bold text-white hover:bg-violet-700"
                onClick={() => p.onOpenSplitForSection!(sec!.id)}
              >
                🎵 Thêm bài hát
              </button>
            )}
            <div className="flex flex-col gap-1.5">
              {list.map((s, i) => renderThumb(s, i, sectionId))}
            </div>
            <button
              className="mt-1.5 w-full rounded-md border border-dashed border-slate-300 py-1.5 text-sm text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700 min-h-[44px]"
              onClick={() => p.onAddSlide(sectionId)}
            >
              ＋ Thêm slide vào mục này
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-2">
        {orderedSections.map((s, i) => renderSection(s, i))}
        {renderSection(null, orderedSections.length)}
        {/* Vùng thả để chuyển mục xuống cuối */}
        <div
          className="rounded-md border border-dashed border-transparent p-2 text-center text-[11px] text-slate-400"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const raw = e.dataTransfer.getData('text/plain') || dragId || '';
            if (raw.startsWith('section:')) {
              p.onDropSection(raw.slice('section:'.length), null);
            }
          }}
        >
          Thả mục vào đây để chuyển xuống cuối
        </div>
        {p.slides.length === 0 && (
          <p className="p-4 text-center text-sm text-slate-400">Chưa có slide nào.<br />Nhấn ＋ để thêm slide đầu tiên.</p>
        )}
      </div>
    </div>
  );
}
