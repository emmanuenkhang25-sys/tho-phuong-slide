// ============================================================================
// Thờ Phượng Slide — giao diện đơn giản (mobile-first)
// SimpleSectionEditor — sửa MỘT mục: form đúng loại nội dung, dán chữ →
// tự tạo slide → xem trước → lưu. Không cần biết gì về slide thủ công.
// ============================================================================
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui';
import { SlideRenderer } from '../editor/components/SlideRenderer';
import { uuid } from '../editor/lib/editorUtils';
import {
  FONT_SIZE_PRESETS,
  scaleDraftFonts,
  splitBible,
  splitLyrics,
  splitPlainText,
  type SlideDraft,
} from '../editor/lib/split';
import type {
  AspectRatio,
  Program,
  Section,
  Slide,
  SlideBackground,
  SlideObject,
} from '../../lib/types';
import { sectionEditorType, sectionFormHint, type SectionEditorType } from './sectionForms';
import { duplicateSimpleSection } from './programApi';
import {
  fetchLibraryItems,
  findLibraryProgram,
  foldVi,
  type LibraryItem,
} from './library';

/** Object text có cỡ chữ lớn nhất trong slide (phần "thân bài"). */
function biggestText(slide: { content: { objects: SlideObject[] } }): SlideObject | undefined {
  let best: SlideObject | undefined;
  for (const o of slide.content.objects) {
    if (o.type === 'text' && o.text && (o.fontSize ?? 0) > (best?.fontSize ?? -1)) best = o;
  }
  return best;
}

/** Object text nhỏ (tiêu đề/phụ đề, fontSize <= 32) trong slide. */
function smallText(slide: { content: { objects: SlideObject[] } }): SlideObject | undefined {
  let best: SlideObject | undefined;
  for (const o of slide.content.objects) {
    if (o.type === 'text' && o.text && (o.fontSize ?? 99) <= 32) {
      if (!best || (o.fontSize ?? 0) > (best.fontSize ?? 0)) best = o;
    }
  }
  return best;
}

/** Object text thân bài (chữ lớn nhất, có nội dung) trong một mảng object. */
function bodyObjOf(objects: SlideObject[]): SlideObject | undefined {
  let best: SlideObject | undefined;
  for (const o of objects) {
    if (o.type === 'text' && o.text && (o.fontSize ?? 0) > (best?.fontSize ?? -1)) best = o;
  }
  return best;
}

/** Đọc file thành data URL (dùng cho video — video không thu nhỏ được như ảnh). */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('Không đọc được file.'));
    r.readAsDataURL(file);
  });
}
function downscaleImage(file: File, maxDim = 1280): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx2 = canvas.getContext('2d');
        if (!ctx2) throw new Error('Không vẽ được ảnh.');
        ctx2.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được ảnh. Hãy chọn ảnh khác.'));
    };
    img.src = url;
  });
}

/** Nén một ảnh dataURL (VD: ảnh trích từ PowerPoint) về ≤1280px JPEG. */
async function downscaleDataUrl(dataUrl: string, maxDim = 1280): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  return downscaleImage(new File([blob], 'slide', { type: blob.type || 'image/png' }), maxDim);
}
const btnPrimary =
  'flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 text-base font-bold text-white disabled:opacity-50';
const btnSecondary =
  'flex min-h-[52px] flex-1 items-center justify-center gap-1 rounded-2xl border border-white/10 bg-[#1b1e22] px-2 text-sm font-bold text-slate-200 disabled:opacity-50';
const inputCls =
  'min-h-[52px] w-full rounded-xl border border-white/10 bg-[#0e0f11] px-3 py-2 text-base text-white';
const labelCls = 'mb-1 block text-sm font-bold text-slate-300';

/** Bảng màu chữ nhanh cho slide (kèm ô chọn màu tùy ý). */
const TEXT_COLORS = ['#ffffff', '#fde047', '#f87171', '#fb923c', '#60a5fa', '#4ade80', '#000000'];

/** Hàng chọn màu chữ, luôn hiện dưới slide nháp có chữ. */
function TextColorRow({
  body,
  onPatchBody,
}: {
  body: SlideObject;
  onPatchBody: (patch: Partial<SlideObject>) => void;
}) {
  const colorValue = /^#[0-9a-fA-F]{6}$/.test(body.color ?? '') ? (body.color as string) : '#ffffff';
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-xs font-bold text-slate-400">Màu chữ:</span>
      {TEXT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onPatchBody({ color: c })}
          aria-label={`Đổi màu chữ ${c}`}
          aria-pressed={body.color === c}
          className={
            'h-9 w-9 rounded-full border-2 ' +
            (body.color === c ? 'border-violet-400' : 'border-white/20')
          }
          style={{ backgroundColor: c }}
        />
      ))}
      <input
        type="color"
        value={colorValue}
        onChange={(e) => onPatchBody({ color: e.target.value })}
        aria-label="Chọn màu chữ tùy ý"
        className="h-9 w-9 cursor-pointer rounded-full border-2 border-white/20 bg-transparent p-0.5"
      />
    </div>
  );
}

/** Slide xem trước từ bản nháp (đặt ngoài component để memo dùng chung được). */
function toPreviewSlide(d: SlideDraft): Slide {
  return { id: uuid(), content: { objects: d.objects }, background: d.background } as Slide;
}

/**
 * Một thẻ slide nháp — memo để chỉ vẽ lại khi ĐÚNG slide này đổi. Trước đây
 * đổi cỡ/màu/kéo một slide là cả 21 thẻ vẽ lại theo nên rất giật.
 */
const DraftCard = memo(function DraftCard({
  d,
  i,
  scale,
  editing,
  aspect,
  onPatchObject,
  onPatchBody,
  onFontScale,
  onStepFontSize,
  fontSizeMode,
  onEditText,
  onToggleEdit,
  onDelete,
}: {
  d: SlideDraft;
  i: number;
  scale: number;
  editing: boolean;
  aspect: AspectRatio;
  onPatchObject: (idx: number, objId: string, patch: Partial<SlideObject>) => void;
  onPatchBody: (idx: number, patch: Partial<SlideObject>) => void;
  onFontScale: (idx: number, scale: number) => void;
  /** Chế độ số (bài hát): tăng/giảm 74–80 thay cho Nhỏ/Vừa/To. */
  onStepFontSize?: (idx: number, delta: number) => void;
  fontSizeMode?: 'scale' | 'numeric';
  onEditText: (idx: number, value: string) => void;
  onToggleEdit: (idx: number) => void;
  onDelete: (idx: number) => void;
}) {
  const preview = useMemo(() => toPreviewSlide(d), [d]);
  const textDrag = useMemo(
    () => ({ onTextMove: (objId: string, patch: Partial<SlideObject>) => onPatchObject(i, objId, patch) }),
    [onPatchObject, i],
  );
  const colorPatch = useMemo(
    () => (patch: Partial<SlideObject>) => onPatchBody(i, patch),
    [onPatchBody, i],
  );
  const body = bodyObjOf(d.objects);
  const editValue = (() => {
    let bi = -1;
    let best = -1;
    d.objects.forEach((o, j) => {
      if (o.type === 'text' && (o.fontSize ?? 0) > best) {
        best = o.fontSize ?? 0;
        bi = j;
      }
    });
    return bi >= 0 ? (d.objects[bi].text ?? '') : '';
  })();
  return (
    <div className="rounded-xl border border-white/10 p-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-500">Slide {i + 1}</p>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <div className="flex items-center gap-1" role="group" aria-label={`Cỡ chữ slide ${i + 1}`}>
            {fontSizeMode === 'numeric' ? (
              <>
                <button
                  type="button"
                  aria-label={`Giảm cỡ chữ slide ${i + 1}`}
                  onClick={() => onStepFontSize?.(i, -1)}
                  className="min-h-[36px] min-w-[36px] rounded-lg border border-white/10 px-2 text-sm font-bold text-slate-300"
                >
                  −
                </button>
                <span className="min-w-[32px] text-center text-sm font-bold text-white">
                  {(() => {
                    const b = bodyObjOf(d.objects);
                    return b?.fontSize != null ? Math.round(b.fontSize) : '—';
                  })()}
                </span>
                <button
                  type="button"
                  aria-label={`Tăng cỡ chữ slide ${i + 1}`}
                  onClick={() => onStepFontSize?.(i, 1)}
                  className="min-h-[36px] min-w-[36px] rounded-lg border border-white/10 px-2 text-sm font-bold text-slate-300"
                >
                  +
                </button>
              </>
            ) : (
              (
                [
                  ['Nhỏ', 0.8],
                  ['Vừa', 1],
                  ['To', 1.25],
                ] as const
              ).map(([label, s]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => onFontScale(i, s)}
                  aria-pressed={scale === s}
                  className={
                    'min-h-[36px] rounded-lg border px-2.5 text-xs font-bold ' +
                    (scale === s
                      ? 'border-violet-500 bg-violet-500/20 text-violet-200'
                      : 'border-white/10 text-slate-400')
                  }
                >
                  {label}
                </button>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={() => onToggleEdit(i)}
            aria-pressed={editing}
            aria-label={`Sửa chữ slide ${i + 1}`}
            className={
              'min-h-[36px] rounded-lg border px-2.5 text-xs font-bold ' +
              (editing
                ? 'border-violet-500 bg-violet-500/20 text-violet-200'
                : 'border-white/10 text-slate-400')
            }
          >
            {editing ? '✓ Xong' : '✏️ Sửa'}
          </button>
          <button
            type="button"
            onClick={() => onDelete(i)}
            aria-label={`Xóa slide ${i + 1}`}
            className="min-h-[36px] rounded-lg border border-red-900/50 px-2.5 text-xs font-bold text-red-400"
          >
            🗑 Xóa
          </button>
        </div>
      </div>
      {editing ? (
        <textarea
          value={editValue}
          onChange={(e) => onEditText(i, e.target.value)}
          rows={4}
          aria-label={`Nội dung slide ${i + 1}`}
          className="min-h-[120px] w-full rounded-lg border border-white/10 bg-[#0e0f11] px-2 py-1 text-base text-slate-100"
        />
      ) : (
        <div>
          <SlideRenderer slide={preview} width={300} aspect={aspect} textDrag={textDrag} />
          {body && <TextColorRow body={body} onPatchBody={colorPatch} />}
        </div>
      )}
    </div>
  );
});

/** Gợi ý từ Thư viện khi gõ tên bài hát / tham chiếu (bấm là chèn nguyên slide). */
function LibraryDropdown({
  matches,
  loading,
  loaded,
  query,
  onPick,
}: {
  matches: LibraryItem[];
  loading: boolean;
  loaded: boolean;
  query: string;
  onPick: (item: LibraryItem) => void;
}) {
  if (query.trim() === '') return null;
  return (
    <div className="mt-2 flex flex-col gap-1">
      {loading && <p className="text-xs text-slate-500">Đang tìm trong thư viện…</p>}
      {!loading &&
        matches.map((item) => (
          <button
            key={item.section.id}
            type="button"
            onClick={() => onPick(item)}
            className="flex min-h-[48px] items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 text-left text-sm font-bold text-violet-200"
          >
            <span>{item.kind === 'lyrics' ? '🎵' : '📖'}</span>
            <span className="min-w-0 flex-1 truncate">{item.displayTitle}</span>
            <span className="shrink-0 text-xs font-normal text-slate-400">
              {item.slides.length} slide · bấm để chèn
            </span>
          </button>
        ))}
      {!loading && loaded && query.trim().length >= 2 && matches.length === 0 && (
        <p className="text-xs text-slate-500">Không tìm thấy trong thư viện.</p>
      )}
    </div>
  );
}

export function SimpleSectionEditor() {
  const { id: programId, sectionId } = useParams<{ id: string; sectionId: string }>();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [program, setProgram] = useState<Program | null>(null);
  const [section, setSection] = useState<Section | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Form theo loại mục
  const [secTitle, setSecTitle] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [content, setContent] = useState('');
  const [reference, setReference] = useState('');
  const [sermonTopic, setSermonTopic] = useState('');
  const [sermonVerse, setSermonVerse] = useState('');
  const [fontPresetId, setFontPresetId] = useState<'vua' | 'to' | 'cuc-to'>('vua');
  /** Cỡ chữ bài hát: nhỏ nhất 74, tăng được tới 80 (thay cho kiểu chọn Nhỏ/Vừa/To). */
  const [lyricsFontSize, setLyricsFontSize] = useState(74);

  const [drafts, setDrafts] = useState<SlideDraft[] | null>(null);
  const [draftScales, setDraftScales] = useState<number[]>([]);
  /** Cỡ chữ gốc của từng object trong bản nháp — để chỉnh cỡ từng slide luôn tính từ gốc. */
  const basesRef = useRef<number[][]>([]);
  const [customBg, setCustomBg] = useState<SlideBackground | null>(null);
  const [bgBusy, setBgBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const pptxRef = useRef<HTMLInputElement>(null);
  const [videoBusy, setVideoBusy] = useState(false);
  const [pptxBusy, setPptxBusy] = useState(false);
  /** Slide đang sửa chữ tại chỗ (null = không sửa slide nào). */
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  /** Gợi ý Thư viện: tải lười khi bắt đầu gõ tên bài / tham chiếu. */
  const [libItems, setLibItems] = useState<LibraryItem[] | null>(null);
  const [libLoading, setLibLoading] = useState(false);
  const [libOpen, setLibOpen] = useState(false);

  const editorType: SectionEditorType = useMemo(
    () => sectionEditorType(section?.kind ?? ''),
    [section?.kind],
  );
  const hint = useMemo(() => sectionFormHint(section?.kind ?? ''), [section?.kind]);
  const fontPreset = FONT_SIZE_PRESETS.find((x) => x.id === fontPresetId) ?? FONT_SIZE_PRESETS[0];

  useEffect(() => {
    if (!programId || !sectionId) return;
    const load = async () => {
      setLoading(true);
      // Ba câu hỏi độc lập nhau (id đã có sẵn từ URL) — gọi song song thay
      // vì nối tiếp để mở mục nhanh hơn.
      const [{ data: p }, { data: s }, { data: sls }] = await Promise.all([
        supabase.from('programs').select('*').eq('id', programId).single(),
        supabase.from('sections').select('*').eq('id', sectionId).single(),
        supabase.from('slides').select('*').eq('section_id', sectionId).order('order_index'),
      ]);
      if (!p || !s) {
        toast('Không tìm thấy mục.', 'error');
        navigate(`/p/${programId}`, { replace: true });
        return;
      }
      const prog = p as Program;
      const sec = s as Section;
      setProgram(prog);
      setSection(sec);
      setSecTitle(sec.title);
      const ordered = ((sls ?? []) as Slide[]).sort((a, b) => a.order_index - b.order_index);
      setSlides(ordered);
      // Dựng lại nội dung nguồn từ các slide hiện có (mục có thể chưa có slide nào)
      const type = sectionEditorType(sec.kind);
      const firstSlide = ordered[0];
      const bodies = ordered.map((sl) => biggestText(sl)?.text?.trim() ?? '').filter(Boolean);
      if (type === 'lyrics') {
        setSongTitle(firstSlide ? (smallText(firstSlide)?.text?.trim() ?? '') : '');
        setContent(bodies.join('\n\n'));
      } else if (type === 'bible') {
        setReference(firstSlide ? (smallText(firstSlide)?.text?.trim() ?? '') : '');
        setContent(bodies.join('\n\n'));
      } else if (type === 'sermon') {
        setSermonTopic(firstSlide ? (biggestText(firstSlide)?.text?.trim() ?? '') : '');
        setSermonVerse(firstSlide ? (smallText(firstSlide)?.text?.trim() ?? '') : '');
        setContent(
          ordered
            .slice(1)
            .map((sl) => biggestText(sl)?.text?.trim() ?? '')
            .filter(Boolean)
            .join('\n\n'),
        );
      } else {
        setContent(bodies.join('\n\n'));
      }
      setLoading(false);
    };
    void load();
  }, [programId, sectionId]);

  /** Nền mặc định của mục: luôn nền đen chữ trắng (không dùng gradient mẫu nữa). */
  const defaultSectionBg: SlideBackground = useMemo(
    () => ({ type: 'color', color: '#000000' }),
    [],
  );
  /** Nền đang dùng: ảnh tải lên ưu tiên, rồi nền slide hiện tại, rồi mặc định. */
  const background: SlideBackground = useMemo(() => {
    if (customBg) return customBg;
    const first = slides[0]?.background;
    if (first) return first;
    return defaultSectionBg;
  }, [customBg, slides, defaultSectionBg]);

  /** Tải Thư viện (lười — chỉ khi bắt đầu gõ tên bài / tham chiếu). */
  const maybeLoadLibrary = useCallback(() => {
    if (libItems !== null || libLoading || !program) return;
    setLibLoading(true);
    findLibraryProgram(supabase, program.church_id)
      .then((lib) => (lib ? fetchLibraryItems(supabase, lib.id) : []))
      .then((items) => setLibItems(items))
      .catch(() => setLibItems([]))
      .finally(() => setLibLoading(false));
  }, [libItems, libLoading, program]);

  /** Từ khóa đang gõ để tìm trong Thư viện (tên bài hát / tham chiếu). */
  const libQuery = editorType === 'lyrics' ? songTitle : editorType === 'bible' ? reference : '';
  const libMatches = useMemo(() => {
    if (!libItems || libQuery.trim() === '') return [];
    const q = foldVi(libQuery.trim());
    const want = editorType === 'lyrics' ? 'lyrics' : 'bible';
    return libItems
      .filter((it) => it.kind === want && foldVi(it.matchText).includes(q))
      .slice(0, 6);
  }, [libItems, libQuery, editorType]);

  /**
   * Chèn bài từ Thư viện: copy NGUYÊN slide đã làm sẵn (giữ đúng chia dòng,
   * màu, vị trí chữ) thành bản nháp — bấm “Lưu nội dung” là vào chương trình.
   */
  const insertLibraryItem = (item: LibraryItem) => {
    const fromLib: SlideDraft[] = item.slides.map((s) => ({
      objects: s.content.objects.map((o) => ({ ...o, id: uuid() })),
      background: s.background,
      label: item.displayTitle,
    }));
    basesRef.current = fromLib.map((d) => d.objects.map((o) => o.fontSize ?? 0));
    setDraftScales(fromLib.map(() => 1));
    setDrafts(fromLib);
    setEditingIdx(null);
    const bodies = item.slides
      .map((sl) => biggestText(sl)?.text?.trim() ?? '')
      .filter(Boolean)
      .join('\n\n');
    if (item.kind === 'lyrics') {
      setSongTitle(item.displayTitle);
    } else {
      const first = item.slides[0];
      setReference(first ? smallText(first)?.text?.trim() || item.section.title : '');
    }
    setContent(bodies);
    setLibOpen(false);
    toast(
      `Đã chèn “${item.displayTitle}” (${fromLib.length} slide). Bấm “Lưu nội dung” để lưu.`,
      'success',
    );
  };

  /** Tạo slide từ nội dung đã nhập (theo loại mục). */
  const generateSlides = () => {
    // Không nhập gì vẫn tạo được 1 slide chỉ có ảnh nền — có những slide chỉ
    // cần chiếu một bức ảnh đã đủ thông tin, không cần thêm chữ.
    const hasContent =
      content.trim() !== '' || (editorType === 'sermon' && sermonTopic.trim() !== '');
    if (!hasContent) {
      const fresh: SlideDraft[] = [
        { objects: [], background: { ...background }, label: 'Ảnh nền' },
      ];
      basesRef.current = [[]];
      setDraftScales([1]);
      setDrafts(fresh);
      setEditingIdx(null);
      toast('Đã tạo 1 slide chỉ có ảnh nền. Bấm “Lưu nội dung” để lưu.', 'success');
      return;
    }
    let res: { title?: string; slides: SlideDraft[] };
    if (editorType === 'lyrics') {
      const r = splitLyrics(content, {
        // Slide bài hát tối đa 3 dòng HIỂN THỊ.
        linesPerSlide: 3,
        // Cỡ chữ số do người dùng chọn (74–80) — đã là cỡ cuối, không nhân thêm hệ số.
        fontSize: lyricsFontSize,
        // Chỉ tên bài hát do người dùng nhập mới lên slide — không tự gắn tên mục.
        title: songTitle.trim() || undefined,
        background,
      });
      res = { title: r.title, slides: r.slides };
    } else if (editorType === 'bible') {
      const r = splitBible(content, {
        // Mỗi câu Kinh Thánh thành đúng 1 slide (17 câu → 17 slide).
        versesPerSlide: 1,
        reference: reference.trim() || undefined,
        background,
      });
      res = { title: r.title, slides: scaleDraftFonts(r.slides, fontPreset.fontScale) };
    } else if (editorType === 'sermon') {
      const ds: SlideDraft[] = [];
      // Slide tiêu đề: chủ đề + câu gốc
      const titleObjs: SlideObject[] = [
        {
          id: uuid(), type: 'text', x: 8, y: 30, w: 84, h: 26, z: 5,
          text: sermonTopic.trim() || 'Bài giảng',
          fontFamily: 'Arial, sans-serif', fontSize: 64, color: '#ffffff',
          bold: true, align: 'center', lineHeight: 1.3,
        },
      ];
      if (sermonVerse.trim()) {
        titleObjs.push({
          id: uuid(), type: 'text', x: 12, y: 60, w: 76, h: 18, z: 5,
          text: sermonVerse.trim(),
          fontFamily: 'Arial, sans-serif', fontSize: 32, color: '#f1f5f9',
          bold: false, align: 'center', lineHeight: 1.4,
        });
      }
      ds.push({ objects: titleObjs, background: { ...background }, label: 'Chủ đề' });
      if (content.trim()) {
        const r = splitPlainText(content, { maxLinesPerSlide: 5, background });
        ds.push(...scaleDraftFonts(r.slides, fontPreset.fontScale));
      }
      res = { slides: ds };
    } else {
      // Không gắn tên mục lên slide.
      const r = splitPlainText(content, {
        maxLinesPerSlide: 6,
        background,
      });
      res = { title: r.title, slides: scaleDraftFonts(r.slides, fontPreset.fontScale) };
    }
    if (res.slides.length === 0) {
      toast('Không tạo được slide nào từ nội dung đã nhập.', 'error');
      return;
    }
    // Cấp id object mới cho bản nháp + lưu cỡ chữ gốc để chỉnh từng slide sau
    const fresh = res.slides.map((d) => ({
      ...d,
      objects: d.objects.map((o) => ({ ...o, id: uuid() })),
    }));
    basesRef.current = fresh.map((d) => d.objects.map((o) => o.fontSize ?? 0));
    setDraftScales(fresh.map(() => 1));
    setDrafts(fresh);
    setEditingIdx(null);
    toast(`Đã tạo ${res.slides.length} slide. Bấm “Lưu nội dung” để lưu.`, 'success');
  };

  /** Đổi cỡ chữ của RIÊNG slide thứ idx (Nhỏ 0.8 / Vừa 1 / To 1.25) — tính lại từ cỡ gốc. */
  const setDraftFontScale = useCallback((idx: number, scale: number) => {
    const bases = basesRef.current[idx];
    if (!bases) return;
    setDraftScales((prev) => prev.map((s, i) => (i === idx ? scale : s)));
    setDrafts((prev) => {
      if (!prev) return prev;
      return prev.map((d, i) => {
        if (i !== idx) return d;
        return {
          ...d,
          objects: d.objects.map((o, j) => {
            const base = bases[j] ?? 0;
            if (o.type !== 'text' || base <= 0) return o;
            return { ...o, fontSize: Math.max(10, Math.round(base * scale)) };
          }),
        };
      });
    });
  }, []);

  /** Tăng/giảm cỡ chữ số của 1 slide bài hát (74–80), chỉ đổi object thân bài lớn nhất. */
  const stepDraftFontSize = useCallback((idx: number, delta: number) => {
    setDrafts((prev) => {
      if (!prev) return prev;
      return prev.map((d, i) => {
        if (i !== idx) return d;
        const body = bodyObjOf(d.objects);
        if (!body) return d;
        return {
          ...d,
          objects: d.objects.map((o) => {
            if (o.id !== body.id || o.type !== 'text' || !o.fontSize) return o;
            return { ...o, fontSize: Math.min(80, Math.max(74, o.fontSize + delta)) };
          }),
        };
      });
    });
  }, []);

  /** Tải ảnh lên làm nền cho toàn bộ slide của mục. */
  const onPickBackground = async (file: File | undefined) => {
    if (!file || !programId || !sectionId) return;
    setBgBusy(true);
    try {
      const dataUrl = await downscaleImage(file);
      const bg: SlideBackground = { type: 'image', image: dataUrl, overlayOpacity: 0.35 };
      setCustomBg(bg);
      if (drafts) {
        setDrafts(drafts.map((d) => ({ ...d, background: bg })));
        toast('Đã đổi ảnh nền cho bản nháp — bấm “Lưu nội dung” để lưu.', 'success');
      } else if (slides.length > 0) {
        const ordered = [...slides].sort((a, b) => a.order_index - b.order_index);
        await Promise.all(
          ordered.map((s) =>
            supabase
              .from('slides')
              .update({ background: bg })
              .eq('id', s.id)
              .then(({ error }) => {
                if (error) throw new Error(`Đổi nền slide lỗi: ${error.message}`);
              }),
          ),
        );
        setSlides(ordered.map((s) => ({ ...s, background: bg })));
        toast(`Đã đổi ảnh nền cho ${ordered.length} slide.`, 'success');
      } else {
        toast('Đã đặt ảnh nền — sẽ dùng khi bấm “Tự động tạo slide”.', 'success');
      }
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBgBusy(false);
    }
  };

  /** Chèn video thành 1 slide riêng (video phủ kín slide, phát khi trình chiếu). */
  const onPickVideo = async (file: File | undefined) => {
    if (!file || !programId || !sectionId) return;
    const MAX_VIDEO = 30 * 1024 * 1024;
    if (file.size > MAX_VIDEO) {
      toast(
        `Video quá lớn (${(file.size / 1048576).toFixed(0)}MB). Hãy chọn video dưới 30MB (cắt ngắn hoặc giảm chất lượng) để lưu được.`,
        'error',
      );
      return;
    }
    setVideoBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const videoSlide: SlideDraft = {
        objects: [
          { id: uuid(), type: 'video', x: 0, y: 0, w: 100, h: 100, z: 5, src: dataUrl },
        ],
        background: { ...background },
        label: 'Video',
      };
      const next = drafts ? [...drafts, videoSlide] : [videoSlide];
      basesRef.current = next.map((d) => d.objects.map((o) => o.fontSize ?? 0));
      setDraftScales(next.map(() => 1));
      setDrafts(next);
      toast('Đã thêm slide video. Bấm “Lưu nội dung” để lưu.', 'success');
    } catch {
      toast('Không đọc được file video.', 'error');
    } finally {
      setVideoBusy(false);
    }
  };

  /** Nhập PowerPoint vào mục giảng: mỗi slide .pptx thành 1 slide — có chữ thì lấy chữ, chỉ có hình thì lấy nguyên hình làm nền. */
  const onPickPptx = async (file: File | undefined) => {
    if (!file || !programId || !sectionId) return;
    const MAX_PPTX = 30 * 1024 * 1024;
    if (file.size > MAX_PPTX) {
      toast('File PowerPoint quá lớn (tối đa 30MB).', 'error');
      return;
    }
    setPptxBusy(true);
    try {
      // Tải lười để code đọc zip không nằm trong gói chính.
      const { extractPptxSlides } = await import('../export/lib/pptxImport');
      const { slides: found, skipped } = await extractPptxSlides(file);
      if (found.length === 0) {
        toast('Không trích được chữ hay ảnh nào từ file PowerPoint này.', 'error');
        return;
      }
      const imported: SlideDraft[] = [];
      let textCount = 0;
      let imageCount = 0;
      for (let k = 0; k < found.length; k++) {
        const s = found[k];
        // Ảnh slide nén về ≤1280px JPEG cho nhẹ (ảnh gốc trong file có thể nặng hàng MB).
        let bg = { ...background };
        if (s.image) {
          try {
            bg = { type: 'image', image: await downscaleDataUrl(s.image), overlayOpacity: 0.35 };
          } catch {
            bg = { type: 'image', image: s.image, overlayOpacity: 0.35 };
          }
          imageCount++;
        }
        if (s.text) {
          textCount++;
          imported.push({
            objects: [
              {
                id: uuid(),
                type: 'text',
                x: 8,
                y: 22,
                w: 84,
                h: 60,
                z: 5,
                text: s.text,
                fontFamily: 'Arial, sans-serif',
                fontSize: 40,
                color: '#ffffff',
                bold: false,
                align: 'center',
                lineHeight: 1.4,
              },
            ],
            background: bg,
            label: `PowerPoint ${k + 1}`,
          });
        } else if (s.image) {
          // Slide chỉ có hình (chữ nằm chết trong hình) → slide hình, không chữ.
          imported.push({ objects: [], background: bg, label: `PowerPoint ${k + 1}` });
        }
      }
      const next = drafts ? [...drafts, ...imported] : imported;
      basesRef.current = next.map((d) => d.objects.map((o) => o.fontSize ?? 0));
      setDraftScales(next.map(() => 1));
      setDrafts(next);
      const detail: string[] = [];
      if (textCount > 0) detail.push(`${textCount} slide chữ`);
      if (imageCount > 0) detail.push(`${imageCount} slide hình`);
      if (skipped > 0) detail.push(`${skipped} slide trống đã bỏ qua`);
      toast(
        `Đã nhập ${imported.length} slide từ PowerPoint (${detail.join(', ')}). Bấm “Lưu nội dung” để lưu.`,
        'success',
      );
    } catch (e) {
      toast(`Nhập PowerPoint lỗi: ${(e as Error).message}`, 'error');
    } finally {
      setPptxBusy(false);
    }
  };

  /** Về nền mặc định (nền đen). */
  const resetBackground = async () => {
    if (!programId || !sectionId) return;
    setCustomBg(null);
    if (drafts) {
      setDrafts(drafts.map((d) => ({ ...d, background: defaultSectionBg })));
      toast('Đã về nền mặc định cho bản nháp.', 'success');
      return;
    }
    if (slides.length > 0) {
      setBgBusy(true);
      try {
        const ordered = [...slides].sort((a, b) => a.order_index - b.order_index);
        await Promise.all(
          ordered.map((s) =>
            supabase
              .from('slides')
              .update({ background: defaultSectionBg })
              .eq('id', s.id)
              .then(({ error }) => {
                if (error) throw new Error(`Đổi nền slide lỗi: ${error.message}`);
              }),
          ),
        );
        setSlides(ordered.map((s) => ({ ...s, background: defaultSectionBg })));
        toast('Đã về nền mặc định.', 'success');
      } catch (e) {
        toast((e as Error).message, 'error');
      } finally {
        setBgBusy(false);
      }
    }
  };

  /** Sửa chữ của slide thứ i trong bản xem trước (chỉ sửa object thân bài). */
  const editDraftText = useCallback((idx: number, value: string) => {
    setDrafts((prev) => {
      if (!prev) return prev;
      return prev.map((d, i) => {
        if (i !== idx) return d;
        let bi = -1;
        let best = -1;
        d.objects.forEach((o, j) => {
          if (o.type === 'text' && (o.fontSize ?? 0) > best) {
            best = o.fontSize ?? 0;
            bi = j;
          }
        });
        if (bi < 0) return d;
        return { ...d, objects: d.objects.map((o, j) => (j === bi ? { ...o, text: value } : o)) };
      });
    });
  }, []);

  /** Đổi thuộc tính của object thân bài trong bản nháp (dùng cho kéo-thả, đổi màu). */
  const patchDraftBody = useCallback((idx: number, patch: Partial<SlideObject>) => {
    setDrafts((prev) => {
      if (!prev) return prev;
      return prev.map((d, i) => {
        if (i !== idx) return d;
        const body = bodyObjOf(d.objects);
        if (!body) return d;
        return { ...d, objects: d.objects.map((o) => (o.id === body.id ? { ...o, ...patch } : o)) };
      });
    });
  }, []);

  /** Đổi thuộc tính của một object bất kỳ trong bản nháp (dùng cho kéo chữ trực tiếp). */
  const patchDraftObject = useCallback((idx: number, objId: string, patch: Partial<SlideObject>) => {
    setDrafts((prev) => {
      if (!prev) return prev;
      return prev.map((d, i) => {
        if (i !== idx) return d;
        return { ...d, objects: d.objects.map((o) => (o.id === objId ? { ...o, ...patch } : o)) };
      });
    });
  }, []);

  /** Bật/tắt sửa chữ tại chỗ của một slide. */
  const toggleEdit = useCallback((idx: number) => {
    setEditingIdx((cur) => (cur === idx ? null : idx));
  }, []);

  /**
   * Xóa một slide khỏi bản nháp (slide thừa do tạo nhầm). Chỉ xóa ở bản
   * nháp — muốn xóa khỏi chương trình thì bấm “Lưu nội dung” sau đó (lưu
   * vốn đã tự xóa các slide thừa cuối). Đồng bộ cả cỡ chữ gốc và thang cỡ
   * theo chỉ số mới để các slide còn lại không bị lệch cỡ.
   */
  const deleteDraft = useCallback((idx: number) => {
    if (!window.confirm(`Xóa slide ${idx + 1} khỏi bản nháp?`)) return;
    basesRef.current = basesRef.current.filter((_, i) => i !== idx);
    setDraftScales((prev) => prev.filter((_, i) => i !== idx));
    setDrafts((prev) => (prev ? prev.filter((_, i) => i !== idx) : prev));
    setEditingIdx(null);
  }, []);

  /** Lưu: cập nhật slide cũ theo vị trí, thêm mới nếu thừa, xóa bớt nếu dư. */
  const saveContent = async () => {
    if (!drafts || drafts.length === 0) {
      toast('Hãy bấm “Tự động tạo slide” trước khi lưu.', 'error');
      return;
    }
    if (!programId || !sectionId) return;
    setBusy(true);
    try {
      const ordered = [...slides].sort((a, b) => a.order_index - b.order_index);
      const n = Math.min(ordered.length, drafts.length);
      // Cập nhật TẤT CẢ slide cùng lúc thay vì từng slide nối tiếp nhau —
      // trước đây lưu 21 slide là 21 lần chờ mạng liên tiếp nên rất lag.
      await Promise.all(
        ordered.slice(0, n).map((s, i) =>
          supabase
            .from('slides')
            .update({
              content: { objects: drafts[i].objects },
              background: drafts[i].background,
            })
            .eq('id', s.id)
            .then(({ error }) => {
              if (error) throw new Error(`Cập nhật slide ${i + 1} lỗi: ${error.message}`);
            }),
        ),
      );
      if (drafts.length > ordered.length) {
        const extras = drafts.slice(ordered.length).map((d, k) => ({
          id: uuid(),
          program_id: programId,
          section_id: sectionId,
          order_index: ordered.length + k,
          content: { objects: d.objects },
          background: d.background,
        }));
        const { error } = await supabase.from('slides').insert(extras);
        if (error) throw new Error(`Thêm slide mới lỗi: ${error.message}`);
      }
      if (ordered.length > drafts.length) {
        const surplus = ordered.slice(drafts.length).map((s) => s.id);
        const { error } = await supabase.from('slides').delete().in('id', surplus);
        if (error)
          throw new Error(
            `Không xóa được ${surplus.length} slide thừa (cần quyền Quản trị viên): ${error.message}`,
          );
      }
      if (secTitle.trim() && section && secTitle.trim() !== section.title) {
        const { error } = await supabase
          .from('sections')
          .update({ title: secTitle.trim() })
          .eq('id', sectionId);
        if (error) throw new Error(`Đổi tên mục lỗi: ${error.message}`);
        setSection({ ...section, title: secTitle.trim() });
      }
      // Tải lại slides để đồng bộ
      const { data } = await supabase
        .from('slides')
        .select('*')
        .eq('section_id', sectionId)
        .order('order_index');
      setSlides(((data ?? []) as Slide[]).sort((a, b) => a.order_index - b.order_index));
      toast('Đã lưu nội dung mục.', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const duplicateSection = async () => {
    if (!programId || !section) return;
    if (!window.confirm(`Sao chép mục “${section.title}” kèm toàn bộ slide?`)) return;
    setBusy(true);
    try {
      await duplicateSimpleSection(supabase, programId, section, slides);
      toast('Đã sao chép mục.', 'success');
      navigate(`/p/${programId}`);
    } catch (e) {
      toast(`Sao chép lỗi: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const deleteSection = async () => {
    if (!programId || !section) return;
    if (!window.confirm(`Xóa mục “${section.title}” và toàn bộ ${slides.length} slide của nó?`)) return;
    setBusy(true);
    try {
      const { error: slErr } = await supabase.from('slides').delete().eq('section_id', sectionId);
      if (slErr) throw new Error(`Không xóa được slide (cần quyền Quản trị viên): ${slErr.message}`);
      const { error: sErr } = await supabase.from('sections').delete().eq('id', sectionId);
      if (sErr) throw new Error(`Xóa mục lỗi: ${sErr.message}`);
      toast('Đã xóa mục.', 'success');
      navigate(`/p/${programId}`);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center bg-[#0e0f11] px-4">
        Đang tải mục…
      </div>
    );
  }
  if (!section || !program) return null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col bg-[#0e0f11] px-4 pb-10 pt-3 text-slate-100">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={() => navigate(`/p/${programId}`)}
          aria-label="Quay lại chương trình"
          className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-[#1b1e22] text-xl text-slate-200"
        >
          ←
        </button>
        <input
          value={secTitle}
          onChange={(e) => setSecTitle(e.target.value)}
          aria-label="Tên mục"
          className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 py-1 text-lg font-bold text-white focus:border-[#1b6fe0]"
        />
      </div>

      {/* Thao tác mục */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button onClick={() => void duplicateSection()} disabled={busy} className={btnSecondary}>
          ⧉ Sao chép
        </button>
        <button
          onClick={() => void deleteSection()}
          disabled={busy}
          className="flex min-h-[52px] flex-1 items-center justify-center gap-1 rounded-2xl border border-red-900/50 bg-[#1b1e22] px-2 text-sm font-bold text-red-400 disabled:opacity-50"
        >
          🗑 Xóa mục
        </button>
      </div>

      {/* Form theo loại mục */}
      <div className="rounded-2xl border border-white/5 bg-[#16181c] p-4">
        <h2 className="text-base font-bold text-white">{hint.heading}</h2>
        <p className="mb-3 text-sm text-slate-400">{hint.hint}</p>

        {editorType === 'lyrics' && (
          <div className="mb-3">
            <label className={labelCls}>Tên bài hát</label>
            <input
              value={songTitle}
              onChange={(e) => {
                setSongTitle(e.target.value);
                setLibOpen(true);
                void maybeLoadLibrary();
              }}
              onFocus={() => {
                setLibOpen(true);
                void maybeLoadLibrary();
              }}
              placeholder="VD: Ngợi khen Chúa"
              className={inputCls}
            />
            <p className="mt-1 text-xs text-slate-500">
              Gõ tên bài đã lưu trong 📚 Thư viện là hiện gợi ý — bấm là chèn nguyên slide.
            </p>
            {libOpen && (
              <LibraryDropdown
                matches={libMatches}
                loading={libLoading}
                loaded={libItems !== null}
                query={songTitle}
                onPick={insertLibraryItem}
              />
            )}
          </div>
        )}
        {editorType === 'bible' && (
          <div className="mb-3">
            <label className={labelCls}>Tham chiếu (VD: Giăng 3:16)</label>
            <input
              value={reference}
              onChange={(e) => {
                setReference(e.target.value);
                setLibOpen(true);
                void maybeLoadLibrary();
              }}
              onFocus={() => {
                setLibOpen(true);
                void maybeLoadLibrary();
              }}
              placeholder="Giăng 3:16"
              className={inputCls}
            />
            {libOpen && (
              <LibraryDropdown
                matches={libMatches}
                loading={libLoading}
                loaded={libItems !== null}
                query={reference}
                onPick={insertLibraryItem}
              />
            )}
          </div>
        )}
        {editorType === 'sermon' && (
          <>
            <div className="mb-3">
              <label className={labelCls}>Chủ đề bài giảng</label>
              <input
                value={sermonTopic}
                onChange={(e) => setSermonTopic(e.target.value)}
                placeholder="VD: Tình yêu thương của Chúa"
                className={inputCls}
              />
            </div>
            <div className="mb-3">
              <label className={labelCls}>Câu gốc</label>
              <input
                value={sermonVerse}
                onChange={(e) => setSermonVerse(e.target.value)}
                placeholder="VD: Giăng 3:16"
                className={inputCls}
              />
            </div>
          </>
        )}

        {editorType === 'lyrics' && (
          <div className="mb-3">
            <label className={labelCls}>Cỡ chữ bài hát (nhỏ nhất 74, tối đa 80)</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Giảm cỡ chữ bài hát"
                onClick={() => setLyricsFontSize((v) => Math.max(74, v - 1))}
                className="min-h-[48px] min-w-[48px] rounded-xl border border-white/10 text-xl font-bold text-slate-300"
              >
                −
              </button>
              <span className="min-w-[56px] text-center text-2xl font-bold text-white">{lyricsFontSize}</span>
              <button
                type="button"
                aria-label="Tăng cỡ chữ bài hát"
                onClick={() => setLyricsFontSize((v) => Math.min(80, v + 1))}
                className="min-h-[48px] min-w-[48px] rounded-xl border border-white/10 text-xl font-bold text-slate-300"
              >
                +
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Chữ to, in đậm, chiếm nhiều màn hình — đọc rõ cho cả trẻ em và người già.
            </p>
          </div>
        )}

        {editorType === 'bible' && (
          <div className="mb-3">
            <label className={labelCls}>Cỡ chữ slide</label>
            <div className="flex gap-2">
              {FONT_SIZE_PRESETS.map((fp) => (
                <button
                  key={fp.id}
                  type="button"
                  onClick={() => setFontPresetId(fp.id)}
                  className={
                    'flex-1 rounded-xl border px-2 py-2 text-sm font-bold min-h-[48px] ' +
                    (fontPresetId === fp.id
                      ? 'border-violet-500 bg-violet-500/15 text-violet-300'
                      : 'border-white/10 text-slate-400')
                  }
                >
                  {fp.id === 'vua' ? '🔤' : fp.id === 'to' ? '🔠' : '🔡'} {fp.label} ·{' '}
                  {fp.linesPerSlide} dòng
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-3">
          <label className={labelCls}>
            {editorType === 'lyrics'
              ? 'Lời bài hát'
              : editorType === 'bible'
                ? 'Nội dung Kinh Thánh'
                : editorType === 'sermon'
                  ? 'Nội dung cần trình chiếu'
                  : 'Nội dung'}
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={hint.contentPlaceholder}
            rows={10}
            className="min-h-[220px] w-full rounded-xl border border-white/10 bg-[#0e0f11] px-3 py-2 text-base text-white"
          />
        </div>

        {/* Ảnh nền của mục */}
        <div className="mb-3">
          <label className={labelCls}>Ảnh nền của mục</label>
          <div className="flex items-center gap-2">
            {background.type === 'image' && background.image && (
              <img
                src={background.image}
                alt="Ảnh nền hiện tại"
                className="h-12 w-20 shrink-0 rounded-lg object-cover"
              />
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={bgBusy}
              className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#1b1e22] px-3 text-sm font-bold text-slate-200 disabled:opacity-50"
            >
              {bgBusy ? '⏳ Đang xử lý…' : '🖼 Tải ảnh nền lên'}
            </button>
            {(customBg || background.type === 'image') && (
              <button
                type="button"
                onClick={() => void resetBackground()}
                disabled={bgBusy}
                className="flex min-h-[52px] items-center justify-center rounded-2xl border border-white/10 px-3 text-sm font-bold text-slate-300 disabled:opacity-50"
              >
                ↩ Mặc định
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Ảnh sẽ phủ kín slide; chữ vẫn đọc rõ nhờ lớp phủ tối.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Chọn ảnh nền"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              void onPickBackground(f);
            }}
          />
        </div>

        {/* Chèn video thành 1 slide riêng */}
        <div className="mb-3">
          <button
            type="button"
            onClick={() => videoRef.current?.click()}
            disabled={videoBusy}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#1b1e22] px-3 text-sm font-bold text-slate-200 disabled:opacity-50"
          >
            {videoBusy ? '⏳ Đang xử lý…' : '🎬 Chèn video vào slide'}
          </button>
          <p className="mt-1 text-xs text-slate-500">
            Video sẽ thành 1 slide riêng (tối đa 30MB) — bấm “Lưu nội dung” để lưu.
          </p>
          <input
            ref={videoRef}
            type="file"
            accept="video/*"
            className="hidden"
            aria-label="Chọn video"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              void onPickVideo(f);
            }}
          />
        </div>

        {/* Nhập PowerPoint làm sẵn vào mục giảng */}
        {editorType === 'sermon' && (
          <div className="mb-3">
            <button
              type="button"
              onClick={() => pptxRef.current?.click()}
              disabled={pptxBusy}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#1b1e22] px-3 text-sm font-bold text-slate-200 disabled:opacity-50"
            >
              {pptxBusy ? '⏳ Đang đọc file…' : '📊 Nhập PowerPoint (.pptx)'}
            </button>
            <p className="mt-1 text-xs text-slate-500">
              Mỗi slide PowerPoint thành 1 slide trong mục giảng — slide có chữ thì
              lấy chữ, slide chỉ có hình thì lấy nguyên hình (nén về ≤1280px) — bấm
              “Lưu nội dung” để lưu.
            </p>
            <input
              ref={pptxRef}
              type="file"
              accept=".pptx"
              className="hidden"
              aria-label="Chọn file PowerPoint"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                void onPickPptx(f);
              }}
            />
          </div>
        )}

        <button onClick={generateSlides} disabled={busy} className={btnPrimary + ' w-full'}>
          ✨ Tự động tạo slide
        </button>
      </div>

      {/* Bản xem trước các slide vừa tạo */}
      {drafts && (
        <div className="mt-3 rounded-2xl border border-white/5 bg-[#16181c] p-4">
          <h3 className="mb-2 text-base font-bold text-white">
            Xem trước ({drafts.length} slide)
          </h3>
          <div className="flex flex-col gap-3">
            {drafts.map((d, i) => (
              <DraftCard
                key={i}
                d={d}
                i={i}
                scale={draftScales[i] ?? 1}
                editing={editingIdx === i}
                aspect={program.aspect_ratio}
                onPatchObject={patchDraftObject}
                onPatchBody={patchDraftBody}
                onFontScale={setDraftFontScale}
                onStepFontSize={stepDraftFontSize}
                fontSizeMode={editorType === 'lyrics' ? 'numeric' : 'scale'}
                onEditText={editDraftText}
                onToggleEdit={toggleEdit}
                onDelete={deleteDraft}
              />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => setPreviewIdx(0)}
              className="flex min-h-[52px] items-center justify-center gap-1 rounded-2xl border border-white/10 bg-[#1b1e22] font-bold text-slate-200"
            >
              👁 Xem trước
            </button>
            <button
              onClick={() => void saveContent()}
              disabled={busy}
              className="flex min-h-[52px] items-center justify-center gap-1 rounded-2xl bg-[#1b6fe0] font-bold text-white disabled:opacity-50"
            >
              💾 Lưu nội dung
            </button>
          </div>
        </div>
      )}

      {/* Slide hiện tại của mục (trước khi tạo mới) */}
      {!drafts && slides.length > 0 && (
        <div className="mt-3 rounded-2xl border border-white/5 bg-[#16181c] p-4">
          <h3 className="mb-2 text-base font-bold text-white">
            Slide hiện tại ({slides.length})
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {slides.map((s, i) => (
              <div key={s.id} className="w-40 shrink-0">
                <p className="mb-0.5 text-[11px] font-bold text-slate-500">#{i + 1}</p>
                <SlideRenderer slide={s} width={160} aspect={program.aspect_ratio} />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Nhập nội dung ở trên rồi bấm “Tự động tạo slide” để làm mới.
          </p>
        </div>
      )}

      {/* Xem trước toàn màn hình */}
      {previewIdx !== null && drafts && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between p-3 text-white">
            <span className="text-sm font-bold">
              Slide {previewIdx + 1} / {drafts.length}
            </span>
            <button
              onClick={() => setPreviewIdx(null)}
              aria-label="Đóng xem trước"
              className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl bg-white/10 text-xl"
            >
              ✕
            </button>
          </div>
          <button
            className="flex flex-1 items-center justify-center p-2"
            onClick={() => setPreviewIdx((v) => (v === null ? v : (v + 1) % (drafts?.length ?? 1)))}
            aria-label="Slide tiếp theo"
          >
            <SlideRenderer
              slide={toPreviewSlide(drafts[previewIdx])}
              width={Math.min(520, typeof window !== 'undefined' ? window.innerWidth - 16 : 360)}
              aspect={program.aspect_ratio}
            />
          </button>
          <div className="flex gap-2 p-4">
            <button
              onClick={() =>
                setPreviewIdx((v) => (v === null ? v : (v - 1 + (drafts?.length ?? 1)) % (drafts?.length ?? 1)))
              }
              className="flex min-h-[56px] flex-1 items-center justify-center rounded-2xl bg-white/10 text-lg font-bold text-white"
            >
              ‹ Trước
            </button>
            <button
              onClick={() => setPreviewIdx((v) => (v === null ? v : (v + 1) % (drafts?.length ?? 1)))}
              className="flex min-h-[56px] flex-1 items-center justify-center rounded-2xl bg-white/10 text-lg font-bold text-white"
            >
              Sau ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SimpleSectionEditor;
