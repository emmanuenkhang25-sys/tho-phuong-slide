// ============================================================
// Thờ Phượng Slide — nhóm EDITOR
// components/AutoSplitModal.tsx — modal "Thêm bài hát / Kinh Thánh":
// dán lời → xem trước TẤT CẢ slide sẽ thêm (SlideRenderer thu nhỏ) →
// sửa text từng slide → chọn mục đích → "Thêm vào chương trình".
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import type { Section, Slide, SlideBackground } from '../../../lib/types';
import { SlideRenderer } from './SlideRenderer';
import type { SlideDraft } from '../lib/split';
import { FONT_SIZE_PRESETS, scaleDraftFonts, splitBible, splitLyrics } from '../lib/split';
import { uuid } from '../lib/editorUtils';
import {
  deleteSongFromLibrary,
  getSongsByChurch,
  saveSongToLibrary,
  type SongLibraryEntry,
} from '../../../lib/dexie';

export interface AutoSplitModalProps {
  open: boolean;
  onClose: () => void;
  sections: Section[];
  defaultBackground: SlideBackground;
  aspect: '16:9' | '4:3';
  onInsert: (drafts: SlideDraft[], sectionId: string | null) => void;
  /** Mục được chọn sẵn (khi bấm "Thêm bài hát" trong một mục cụ thể). */
  initialSectionId?: string | null;
  /** Id hội thánh — dùng cho "Thư viện bài hát" (lưu cục bộ trên máy). */
  churchId?: string;
}

type Tab = 'lyrics' | 'bible';

/** Object text "thân bài" = object text có cỡ chữ lớn nhất (để sửa trong preview). */
function bodyIndex(d: SlideDraft): number {
  let best = -1;
  let bestSize = -1;
  d.objects.forEach((o, i) => {
    if (o.type === 'text' && (o.fontSize ?? 0) > bestSize) {
      bestSize = o.fontSize ?? 0;
      best = i;
    }
  });
  return best;
}

const inputCls =
  'w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 min-h-[40px]';
const btnCls =
  'inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium min-h-[40px]';
const primaryBtn = btnCls + ' bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-40';
const ghostBtn = btnCls + ' border border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700';
const checkRow = 'flex items-center gap-2 py-1 text-sm';

export function AutoSplitModal(p: AutoSplitModalProps) {
  const [tab, setTab] = useState<Tab>('lyrics');
  const [text, setText] = useState('');
  // Tùy chọn bài hát
  const [fontPresetId, setFontPresetId] = useState<'vua' | 'to' | 'cuc-to'>('vua');
  const fontPreset = FONT_SIZE_PRESETS.find((x) => x.id === fontPresetId) ?? FONT_SIZE_PRESETS[0];
  const [songTitle, setSongTitle] = useState('');
  const [showLabels, setShowLabels] = useState(true);
  const [highlightChorus, setHighlightChorus] = useState(true);
  const [repeatChorus, setRepeatChorus] = useState(false);
  // Tùy chọn Kinh Thánh
  const [versesPerSlide, setVersesPerSlide] = useState(2);
  const [reference, setReference] = useState('');
  const [showVerseNumbers, setShowVerseNumbers] = useState(true);

  const [preview, setPreview] = useState<{ title?: string; slides: SlideDraft[] } | null>(null);
  const [targetSectionId, setTargetSectionId] = useState<string>('');
  // Thư viện bài hát (lưu cục bộ trên máy, theo hội thánh)
  const [library, setLibrary] = useState<SongLibraryEntry[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryMsg, setLibraryMsg] = useState('');

  // Khi mở modal: chọn sẵn mục đích + tải thư viện bài hát
  useEffect(() => {
    if (!p.open) return;
    setTargetSectionId(p.initialSectionId ?? '');
    setPreview(null);
    setLibraryMsg('');
    if (p.churchId) {
      void getSongsByChurch(p.churchId).then(setLibrary).catch(() => setLibrary([]));
    } else {
      setLibrary([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.open]);

  const orderedSections = useMemo(
    () => [...p.sections].sort((a, b) => a.order_index - b.order_index),
    [p.sections],
  );

  if (!p.open) return null;

  const doPreview = () => {
    if (!text.trim()) {
      setPreview({ slides: [] });
      return;
    }
    if (tab === 'lyrics') {
      const res = splitLyrics(text, {
        linesPerSlide: fontPreset.linesPerSlide,
        title: songTitle.trim() || undefined,
        showSectionLabels: showLabels,
        highlightChorus,
        repeatChorusAfterEachVerse: repeatChorus,
        background: p.defaultBackground,
      });
      setPreview({ title: res.title, slides: scaleDraftFonts(res.slides, fontPreset.fontScale) });
    } else {
      const res = splitBible(text, {
        versesPerSlide,
        reference: reference.trim() || undefined,
        showVerseNumbers,
        background: p.defaultBackground,
      });
      setPreview({ title: res.title, slides: scaleDraftFonts(res.slides, fontPreset.fontScale) });
    }
  };

  /** Lưu bài hát đang nhập vào thư viện của hội thánh. */
  const saveToLibrary = async () => {
    if (!p.churchId) {
      setLibraryMsg('Không xác định được hội thánh.');
      return;
    }
    const lyrics = text.trim();
    if (!lyrics) {
      setLibraryMsg('Hãy dán lời bài hát trước khi lưu.');
      return;
    }
    const title = songTitle.trim() || lyrics.split('\n').map((l) => l.trim()).find(Boolean) || 'Bài hát chưa đặt tên';
    const entry: SongLibraryEntry = {
      id: uuid(),
      churchId: p.churchId,
      title,
      lyrics,
      updatedAt: new Date().toISOString(),
    };
    await saveSongToLibrary(entry);
    setLibrary((xs) => [entry, ...xs]);
    setLibraryMsg(`Đã lưu “${title}” vào thư viện.`);
  };

  /** Chọn một bài trong thư viện để dùng lại. */
  const pickFromLibrary = (entry: SongLibraryEntry) => {
    setSongTitle(entry.title);
    setText(entry.lyrics);
    setShowLibrary(false);
    setPreview(null);
  };

  const removeFromLibrary = async (id: string) => {
    await deleteSongFromLibrary(id);
    setLibrary((xs) => xs.filter((x) => x.id !== id));
  };

  const editSlideText = (idx: number, value: string) => {
    setPreview((prev) => {
      if (!prev) return prev;
      const slides = prev.slides.map((d, i) => {
        if (i !== idx) return d;
        const bi = bodyIndex(d);
        if (bi < 0) return d;
        const objects = d.objects.map((o, j) => (j === bi ? { ...o, text: value } : o));
        return { ...d, objects };
      });
      return { ...prev, slides };
    });
  };

  const removeSlide = (idx: number) => {
    setPreview((prev) =>
      prev ? { ...prev, slides: prev.slides.filter((_, i) => i !== idx) } : prev,
    );
  };

  const handleInsert = () => {
    if (!preview || preview.slides.length === 0) return;
    // Cấp id tạm mới cho preview (EditorPage sẽ cấp id thật khi chèn)
    const drafts = preview.slides.map((d) => ({
      ...d,
      objects: d.objects.map((o) => ({ ...o, id: uuid() })),
    }));
    p.onInsert(drafts, targetSectionId || null);
    setPreview(null);
    setText('');
    p.onClose();
  };

  // Slide "giả" cho SlideRenderer preview (chỉ cần content + background)
  const toPreviewSlide = (d: SlideDraft): Slide =>
    ({ id: d.label ?? uuid(), content: { objects: d.objects }, background: d.background }) as Slide;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2" role="dialog" aria-modal="true" aria-label="Thêm bài hát hoặc Kinh Thánh">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2 className="text-base font-bold">🎵 Thêm bài hát / Kinh Thánh tự động</h2>
          <button className={ghostBtn} onClick={p.onClose} aria-label="Đóng">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 px-4 pt-2 dark:border-slate-700">
          {(['lyrics', 'bible'] as Tab[]).map((t) => (
            <button
              key={t}
              className={
                'rounded-t-md px-4 py-2 text-sm font-medium min-h-[40px] ' +
                (tab === t
                  ? 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800')
              }
              onClick={() => { setTab(t); setPreview(null); }}
            >
              {t === 'lyrics' ? 'Bài hát' : 'Kinh Thánh'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!preview ? (
            <>
              <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
                {tab === 'lyrics'
                  ? 'Dán toàn bộ lời bài hát. Các đoạn cách nhau bằng dòng trống; dòng bắt đầu bằng "ĐK"/"Điệp khúc" được nhận diện là điệp khúc. Nội dung được giữ nguyên 100%.'
                  : 'Dán đoạn Kinh Thánh, mỗi câu bắt đầu bằng số câu (VD "16." hoặc "16 "). Văn bản được giữ nguyên tuyệt đối.'}
              </p>
              <textarea
                className={inputCls + ' min-h-[180px] font-mono'}
                placeholder={tab === 'lyrics' ? 'Dán lời bài hát vào đây…' : 'Dán đoạn Kinh Thánh vào đây…'}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              {tab === 'lyrics' ? (
                <>
                  {/* Thư viện bài hát của hội thánh */}
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className={ghostBtn}
                      onClick={() => setShowLibrary((v) => !v)}
                    >
                      📚 {showLibrary ? 'Ẩn thư viện' : `Thư viện bài hát (${library.length})`}
                    </button>
                    <button
                      type="button"
                      className={ghostBtn}
                      onClick={() => void saveToLibrary()}
                      title="Lưu tên + lời bài hát đang nhập vào thư viện để lần sau dùng lại"
                    >
                      💾 Lưu vào thư viện
                    </button>
                  </div>
                  {libraryMsg && (
                    <p className="mb-2 text-sm text-emerald-600 dark:text-emerald-400">{libraryMsg}</p>
                  )}
                  {showLibrary && (
                    <div className="mb-3 max-h-44 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-700">
                      {library.length === 0 ? (
                        <p className="p-3 text-sm text-slate-400">
                          Chưa có bài nào. Nhập tên + lời bài hát rồi bấm “💾 Lưu vào thư viện”.
                        </p>
                      ) : (
                        library.map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 last:border-0 dark:border-slate-800"
                          >
                            <button
                              type="button"
                              className="min-w-0 flex-1 truncate text-left text-sm font-medium text-sky-700 hover:underline dark:text-sky-300 min-h-[40px]"
                              onClick={() => pickFromLibrary(s)}
                              title="Dùng bài này"
                            >
                              {s.title}
                            </button>
                            <button
                              type="button"
                              className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950 min-h-[36px] min-w-[36px]"
                              title="Xóa khỏi thư viện"
                              onClick={() => void removeFromLibrary(s.id)}
                            >
                              ✕
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                      Cỡ chữ slide (cho người lớn tuổi đọc rõ)
                    </label>
                    <div className="flex gap-2">
                      {FONT_SIZE_PRESETS.map((fp) => (
                        <button
                          key={fp.id}
                          type="button"
                          onClick={() => setFontPresetId(fp.id)}
                          className={
                            'flex-1 rounded-md border px-3 py-2 text-sm font-medium min-h-[44px] ' +
                            (fontPresetId === fp.id
                              ? 'border-violet-600 bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-200'
                              : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800')
                          }
                          title={`${fp.linesPerSlide} dòng mỗi slide`}
                        >
                          {fp.id === 'vua' ? '🔤 Vừa' : fp.id === 'to' ? '🔠 To' : '🔡 Cực to'}
                          <span className="block text-[11px] font-normal opacity-70">{fp.linesPerSlide} dòng/slide</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 dark:text-slate-300">Tiêu đề bài hát (tùy chọn)</label>
                    <input className={inputCls} value={songTitle} onChange={(e) => setSongTitle(e.target.value)} placeholder="Để trống = tự lấy dòng đầu" />
                  </div>
                  <label className={checkRow}><input type="checkbox" className="h-4 w-4" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} /> Hiện nhãn “Điệp khúc”</label>
                  <label className={checkRow}><input type="checkbox" className="h-4 w-4" checked={highlightChorus} onChange={(e) => setHighlightChorus(e.target.checked)} /> Tô nổi bật slide điệp khúc</label>
                  <label className={checkRow + ' sm:col-span-2'}><input type="checkbox" className="h-4 w-4" checked={repeatChorus} onChange={(e) => setRepeatChorus(e.target.checked)} /> Lặp lại điệp khúc sau mỗi đoạn</label>
                </div>
                </>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-sm text-slate-600 dark:text-slate-300">Số câu mỗi slide</label>
                    <input type="number" min={1} max={10} className={inputCls} value={versesPerSlide}
                      onChange={(e) => setVersesPerSlide(Math.max(1, Number(e.target.value) || 2))} />
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 dark:text-slate-300">Tham chiếu (VD Giăng 3:16)</label>
                    <input className={inputCls} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Giăng 3:16" />
                  </div>
                  <label className={checkRow + ' sm:col-span-2'}><input type="checkbox" className="h-4 w-4" checked={showVerseNumbers} onChange={(e) => setShowVerseNumbers(e.target.checked)} /> Hiện số câu</label>
                </div>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button className={ghostBtn} onClick={p.onClose}>Hủy</button>
                <button className={primaryBtn} onClick={doPreview} disabled={!text.trim()}>Xem trước</button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button className={ghostBtn} onClick={() => setPreview(null)}>← Sửa văn bản</button>
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  Sẽ thêm <b>{preview.slides.length}</b> slide
                  {preview.title ? <> — “{preview.title}”</> : null}
                </span>
                <label className="ml-auto flex items-center gap-2 text-sm">
                  Thêm vào mục:
                  <select
                    className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 min-h-[40px]"
                    value={targetSectionId}
                    onChange={(e) => setTargetSectionId(e.target.value)}
                  >
                    <option value="">— Cuối chương trình —</option>
                    {orderedSections.map((s) => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                    ))}
                  </select>
                </label>
              </div>
              {preview.slides.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-400">Không tách được slide nào từ văn bản đã dán.</p>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {preview.slides.map((d, i) => {
                  const bi = bodyIndex(d);
                  return (
                    <div key={i} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-semibold text-sky-700 dark:text-sky-300">
                          {i + 1}. {d.label ?? 'Slide'}
                        </span>
                        <button
                          className="rounded px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950 min-h-[32px] min-w-[32px]"
                          title="Bỏ slide này"
                          onClick={() => removeSlide(i)}
                        >✕</button>
                      </div>
                      <SlideRenderer slide={toPreviewSlide(d)} width={220} aspect={p.aspect} highlightChorus={tab === 'lyrics' && highlightChorus} />
                      <label className="mt-1 block text-xs text-slate-500">Sửa nội dung slide:</label>
                      <textarea
                        className={inputCls + ' mt-0.5 font-mono text-xs min-h-[64px]'}
                        rows={4}
                        value={bi >= 0 ? (d.objects[bi].text ?? '') : ''}
                        onChange={(e) => editSlideText(i, e.target.value)}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button className={ghostBtn} onClick={() => setPreview(null)}>← Quay lại</button>
                <button className={primaryBtn} onClick={handleInsert} disabled={preview.slides.length === 0}>
                  Thêm {preview.slides.length} slide vào chương trình
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
