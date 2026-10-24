// ============================================================================
// Thờ Phượng Slide — giao diện đơn giản (mobile-first)
// SimpleSectionEditor — sửa MỘT mục: form đúng loại nội dung, dán chữ →
// tự tạo slide → xem trước → lưu. Không cần biết gì về slide thủ công.
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui';
import { SlideRenderer } from '../editor/components/SlideRenderer';
import { uuid } from '../editor/lib/editorUtils';
import { defaultSlideBackground } from '../editor/lib/editorUtils';
import { SUNDAY_PROGRAM_TEMPLATE } from '../templates/programTemplates';
import {
  FONT_SIZE_PRESETS,
  scaleDraftFonts,
  splitBible,
  splitLyrics,
  splitPlainText,
  type SlideDraft,
} from '../editor/lib/split';
import type { Program, Section, Slide, SlideBackground, SlideObject } from '../../lib/types';
import { sectionEditorType, sectionFormHint, type SectionEditorType } from './sectionForms';
import { duplicateSimpleSection } from './programApi';

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

/** Thu nhỏ ảnh tải lên thành JPEG data URL (tối đa 1280px) — nhẹ, lưu thẳng vào slide. */
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
const btnPrimary =
  'flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 text-base font-bold text-white disabled:opacity-50';
const btnSecondary =
  'flex min-h-[52px] flex-1 items-center justify-center gap-1 rounded-2xl border border-white/10 bg-[#1b1e22] px-2 text-sm font-bold text-slate-200 disabled:opacity-50';
const inputCls =
  'min-h-[52px] w-full rounded-xl border border-white/10 bg-[#0e0f11] px-3 py-2 text-base text-white';
const labelCls = 'mb-1 block text-sm font-bold text-slate-300';

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

  const [drafts, setDrafts] = useState<SlideDraft[] | null>(null);
  const [draftScales, setDraftScales] = useState<number[]>([]);
  /** Cỡ chữ gốc của từng object trong bản nháp — để chỉnh cỡ từng slide luôn tính từ gốc. */
  const basesRef = useRef<number[][]>([]);
  const [customBg, setCustomBg] = useState<SlideBackground | null>(null);
  const [bgBusy, setBgBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  /** Slide đang sửa chữ tại chỗ (null = không sửa slide nào). */
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);

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
      const { data: p } = await supabase.from('programs').select('*').eq('id', programId).single();
      const { data: s } = await supabase.from('sections').select('*').eq('id', sectionId).single();
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
      const { data: sls } = await supabase
        .from('slides')
        .select('*')
        .eq('section_id', sectionId)
        .order('order_index');
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

  /** Nền mặc định của mục (gradient mẫu theo loại mục, rồi nền chung chương trình). */
  const defaultSectionBg: SlideBackground = useMemo(() => {
    const fromTemplate = SUNDAY_PROGRAM_TEMPLATE.sections.find(
      (t) => t.kind === section?.kind,
    )?.background;
    if (fromTemplate) return { ...fromTemplate };
    const progBg = program?.design_template?.defaultBackground as SlideBackground | undefined;
    return progBg ?? defaultSlideBackground();
  }, [section?.kind, program]);
  /** Nền đang dùng: ảnh tải lên ưu tiên, rồi nền slide hiện tại, rồi mặc định. */
  const background: SlideBackground = useMemo(() => {
    if (customBg) return customBg;
    const first = slides[0]?.background;
    if (first) return first;
    return defaultSectionBg;
  }, [customBg, slides, defaultSectionBg]);

  /** Tạo slide từ nội dung đã nhập (theo loại mục). */
  const generateSlides = () => {
    if (editorType === 'sermon') {
      if (!sermonTopic.trim() && !content.trim()) {
        toast('Hãy nhập chủ đề hoặc nội dung bài giảng.', 'error');
        return;
      }
    } else if (!content.trim()) {
      toast('Hãy nhập nội dung trước.', 'error');
      return;
    }
    let res: { title?: string; slides: SlideDraft[] };
    if (editorType === 'lyrics') {
      const r = splitLyrics(content, {
        // Slide bài hát tối đa 3 dòng — preset nào cũng không vượt quá.
        linesPerSlide: Math.min(fontPreset.linesPerSlide, 3),
        title: songTitle.trim() || section?.title,
        background,
      });
      res = { title: r.title, slides: scaleDraftFonts(r.slides, fontPreset.fontScale) };
    } else if (editorType === 'bible') {
      const r = splitBible(content, {
        versesPerSlide: 2,
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
          text: sermonTopic.trim() || section?.title || 'Bài giảng',
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
      const r = splitPlainText(content, {
        maxLinesPerSlide: 6,
        title: section?.title,
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
  const setDraftFontScale = (idx: number, scale: number) => {
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
  };

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
        for (const s of ordered) {
          const { error } = await supabase.from('slides').update({ background: bg }).eq('id', s.id);
          if (error) throw new Error(`Đổi nền slide lỗi: ${error.message}`);
        }
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

  /** Về nền mặc định (gradient mẫu của loại mục). */
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
        for (const s of ordered) {
          const { error } = await supabase
            .from('slides')
            .update({ background: defaultSectionBg })
            .eq('id', s.id);
          if (error) throw new Error(`Đổi nền slide lỗi: ${error.message}`);
        }
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
  const editDraftText = (idx: number, value: string) => {
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
  };

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
      for (let i = 0; i < n; i++) {
        const { error } = await supabase
          .from('slides')
          .update({
            content: { objects: drafts[i].objects },
            background: drafts[i].background,
          })
          .eq('id', ordered[i].id);
        if (error) throw new Error(`Cập nhật slide ${i + 1} lỗi: ${error.message}`);
      }
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

  const toPreviewSlide = (d: SlideDraft): Slide =>
    ({ id: uuid(), content: { objects: d.objects }, background: d.background }) as Slide;

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
              onChange={(e) => setSongTitle(e.target.value)}
              placeholder="VD: Ngợi khen Chúa"
              className={inputCls}
            />
          </div>
        )}
        {editorType === 'bible' && (
          <div className="mb-3">
            <label className={labelCls}>Tham chiếu (VD: Giăng 3:16)</label>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Giăng 3:16"
              className={inputCls}
            />
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

        {(editorType === 'lyrics' || editorType === 'bible') && (
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
              <div key={i} className="rounded-xl border border-white/10 p-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-500">Slide {i + 1}</p>
                  <div className="flex items-center gap-1">
                    <div
                      className="flex items-center gap-1"
                      role="group"
                      aria-label={`Cỡ chữ slide ${i + 1}`}
                    >
                      {(
                        [
                          ['Nhỏ', 0.8],
                          ['Vừa', 1],
                          ['To', 1.25],
                        ] as const
                      ).map(([label, scale]) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setDraftFontScale(i, scale)}
                          aria-pressed={(draftScales[i] ?? 1) === scale}
                          className={
                            'min-h-[36px] rounded-lg border px-2.5 text-xs font-bold ' +
                            ((draftScales[i] ?? 1) === scale
                              ? 'border-violet-500 bg-violet-500/20 text-violet-200'
                              : 'border-white/10 text-slate-400')
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingIdx(editingIdx === i ? null : i)}
                      aria-pressed={editingIdx === i}
                      aria-label={`Sửa chữ slide ${i + 1}`}
                      className={
                        'min-h-[36px] rounded-lg border px-2.5 text-xs font-bold ' +
                        (editingIdx === i
                          ? 'border-violet-500 bg-violet-500/20 text-violet-200'
                          : 'border-white/10 text-slate-400')
                      }
                    >
                      {editingIdx === i ? '✓ Xong' : '✏️ Sửa'}
                    </button>
                  </div>
                </div>
                {editingIdx === i ? (
                  <textarea
                    value={
                      (() => {
                        let bi = -1;
                        let best = -1;
                        d.objects.forEach((o, j) => {
                          if (o.type === 'text' && (o.fontSize ?? 0) > best) {
                            best = o.fontSize ?? 0;
                            bi = j;
                          }
                        });
                        return bi >= 0 ? (d.objects[bi].text ?? '') : '';
                      })()
                    }
                    onChange={(e) => editDraftText(i, e.target.value)}
                    rows={4}
                    aria-label={`Nội dung slide ${i + 1}`}
                    className="min-h-[120px] w-full rounded-lg border border-white/10 bg-[#0e0f11] px-2 py-1 text-base text-slate-100"
                  />
                ) : (
                  <SlideRenderer slide={toPreviewSlide(d)} width={300} aspect={program.aspect_ratio} />
                )}
              </div>
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
