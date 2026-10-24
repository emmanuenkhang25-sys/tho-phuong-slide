// ============================================================================
// Thờ Phượng Slide — giao diện đơn giản (mobile-first)
// SimpleProgramPage — màn hình CHƯƠNG TRÌNH: header gọn + danh sách mục.
// ============================================================================
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useChurch } from '../../stores/church';
import { Modal, useToast } from '../../components/ui';
import { SECTION_KINDS, sectionKindLabel } from '../editor/lib/editorUtils';
import { SlideRenderer } from '../editor/components/SlideRenderer';
import { exportPPTX } from '../export/lib/pptx';
import { downloadBlob, exportFilename } from '../export/lib/units';
import type { Program, Section, Slide } from '../../lib/types';
import { uuid } from '../editor/lib/editorUtils';

export function SimpleProgramPage() {
  const { id } = useParams<{ id: string }>();
  const { currentChurch } = useChurch();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [program, setProgram] = useState<Program | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState('custom');
  const [showPreview, setShowPreview] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      const { data: p } = await supabase.from('programs').select('*').eq('id', id).single();
      if (!p) {
        toast('Không tìm thấy chương trình.', 'error');
        navigate('/p', { replace: true });
        return;
      }
      const prog = p as Program;
      setProgram(prog);
      setTitle(prog.title);
      setEventDate(prog.event_date ?? '');
      const { data: secs } = await supabase
        .from('sections')
        .select('*')
        .eq('program_id', id)
        .order('order_index');
      setSections(((secs ?? []) as Section[]).sort((a, b) => a.order_index - b.order_index));
      const { data: sls } = await supabase
        .from('slides')
        .select('*')
        .eq('program_id', id)
        .order('order_index');
      setSlides(((sls ?? []) as Slide[]).sort((a, b) => a.order_index - b.order_index));
      setLoading(false);
    };
    void load();
  }, [id]);

  const slideCountOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of slides) {
      const k = s.section_id ?? '__none__';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return (sectionId: string | null) => m.get(sectionId ?? '__none__') ?? 0;
  }, [slides]);

  const orderedSlides = useMemo(
    () => [...slides].sort((a, b) => a.order_index - b.order_index),
    [slides],
  );

  /** Lưu tên + ngày chương trình. */
  const saveHeader = async () => {
    if (!program || !id) return;
    setBusy(true);
    const { error } = await supabase
      .from('programs')
      .update({ title: title.trim() || program.title, event_date: eventDate || null })
      .eq('id', id);
    setBusy(false);
    if (error) {
      toast(`Lưu lỗi: ${error.message}`, 'error');
      return;
    }
    setProgram({ ...program, title: title.trim() || program.title, event_date: eventDate || null });
    toast('Đã lưu chương trình.', 'success');
  };

  /** Đổi thứ tự 2 mục kề nhau (lên/xuống). */
  const moveSection = async (index: number, delta: -1 | 1) => {
    const j = index + delta;
    if (j < 0 || j >= sections.length) return;
    const a = sections[index];
    const b = sections[j];
    const next = [...sections];
    next[index] = { ...b, order_index: index };
    next[j] = { ...a, order_index: j };
    setSections(next);
    const { error } = await supabase.from('sections').upsert([
      { id: a.id, order_index: j },
      { id: b.id, order_index: index },
    ]);
    if (error) {
      toast(`Đổi thứ tự lỗi: ${error.message}`, 'error');
      void reloadSections();
    }
  };

  const reloadSections = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('sections')
      .select('*')
      .eq('program_id', id)
      .order('order_index');
    setSections(((data ?? []) as Section[]).sort((a, b) => a.order_index - b.order_index));
  };

  /** Thêm mục mới vào cuối. */
  const addSection = async () => {
    if (!id || !newName.trim()) {
      toast('Vui lòng nhập tên mục.', 'error');
      return;
    }
    setBusy(true);
    const row = {
      id: uuid(),
      program_id: id,
      title: newName.trim(),
      kind: newKind,
      order_index: sections.length,
    };
    const { error } = await supabase.from('sections').insert(row);
    setBusy(false);
    if (error) {
      toast(`Thêm mục lỗi: ${error.message}`, 'error');
      return;
    }
    setSections((xs) => [...xs, row as Section]);
    setNewName('');
    setNewKind('custom');
    setShowAdd(false);
    toast('Đã thêm mục mới.', 'success');
  };

  const doExportPPTX = async () => {
    if (!program) return;
    if (slides.length === 0) {
      toast('Chương trình chưa có slide nào.', 'error');
      return;
    }
    setExporting(true);
    try {
      const result = await exportPPTX(program, sections, slides);
      downloadBlob(result.blob, exportFilename(program.title, 'pptx'));
      toast(
        result.warnings.length > 0
          ? `Đã xuất PPTX (có ${result.warnings.length} lưu ý).`
          : 'Đã xuất file PowerPoint.',
        'success',
      );
    } catch (e) {
      toast(`Xuất PPTX lỗi: ${(e as Error).message}`, 'error');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-xl bg-slate-50 px-4 py-10 text-center text-slate-400">
        Đang tải chương trình…
      </div>
    );
  }
  if (!program) return null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col bg-slate-50 px-4 pb-10 pt-4">
      {/* Header chương trình */}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <button
            onClick={() => navigate('/p')}
            aria-label="Quay lại danh sách"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-xl text-slate-500"
          >
            ←
          </button>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => void saveHeader()}
            aria-label="Tên chương trình"
            className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1 text-lg font-bold text-slate-900 focus:border-blue-400"
          />
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-sm text-slate-500">
          <span className="truncate">⛪ {currentChurch?.name ?? ''}</span>
          <label className="flex items-center gap-1">
            📅
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              onBlur={() => void saveHeader()}
              aria-label="Ngày tổ chức"
              className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-700"
            />
          </label>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => void saveHeader()}
            disabled={busy}
            className="flex min-h-[52px] flex-col items-center justify-center rounded-xl bg-blue-600 font-bold text-white disabled:opacity-50"
          >
            <span className="text-lg">💾</span>
            <span className="text-xs">Lưu</span>
          </button>
          <button
            onClick={() => setShowPreview(true)}
            className="flex min-h-[52px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white font-bold text-slate-700"
          >
            <span className="text-lg">👁</span>
            <span className="text-xs">Xem trước</span>
          </button>
          <button
            onClick={() => navigate(`/trinh-chieu/${program.id}`)}
            className="flex min-h-[52px] flex-col items-center justify-center rounded-xl bg-emerald-600 font-bold text-white"
          >
            <span className="text-lg">▶️</span>
            <span className="text-xs">Chiếu</span>
          </button>
          <button
            onClick={() => void doExportPPTX()}
            disabled={exporting || slides.length === 0}
            className="flex min-h-[52px] flex-col items-center justify-center rounded-xl bg-amber-500 font-bold text-white disabled:opacity-50"
          >
            <span className="text-lg">⬇</span>
            <span className="text-xs">{exporting ? '…' : 'PPTX'}</span>
          </button>
        </div>
      </div>

      {/* Danh sách mục */}
      <h2 className="mb-2 mt-4 px-1 text-sm font-bold uppercase tracking-wide text-slate-400">
        Các mục trong chương trình ({sections.length})
      </h2>
      <ul className="flex flex-col gap-2">
        {sections.map((s, i) => (
          <li key={s.id} className="rounded-2xl bg-white p-2 shadow-sm">
            <div className="flex items-center gap-1">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-base font-bold text-blue-700">
                {i + 1}
              </span>
              <button
                onClick={() => navigate(`/p/${program.id}/muc/${s.id}`)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-xl p-2 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-bold text-slate-900">{s.title}</span>
                  <span className="block text-xs text-slate-400">
                    {sectionKindLabel(s.kind)} · {slideCountOf(s.id)} slide
                  </span>
                </span>
                <span className="text-xl text-slate-300" aria-hidden>›</span>
              </button>
              <span className="flex shrink-0 flex-col gap-1">
                <button
                  onClick={() => void moveSection(i, -1)}
                  disabled={i === 0}
                  title="Chuyển mục lên"
                  aria-label={`Chuyển ${s.title} lên`}
                  className="flex min-h-[40px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  onClick={() => void moveSection(i, 1)}
                  disabled={i === sections.length - 1}
                  title="Chuyển mục xuống"
                  aria-label={`Chuyển ${s.title} xuống`}
                  className="flex min-h-[40px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30"
                >
                  ▼
                </button>
              </span>
            </div>
          </li>
        ))}
      </ul>

      <button
        onClick={() => setShowAdd(true)}
        className="mt-3 flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 text-base font-bold text-slate-500"
      >
        ＋ Thêm mục mới
      </button>

      <Link
        to={`/chuong-trinh/${program.id}`}
        className="mt-4 text-center text-sm text-slate-400 underline"
      >
        🛠 Chế độ nâng cao (chỉnh nền, vị trí chữ…)
      </Link>

      {/* Dialog thêm mục */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="＋ Thêm mục mới">
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Tên mục</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="VD: Hát ngợi khen"
              className="min-h-[48px] w-full rounded-xl border border-slate-300 px-3 text-base"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Loại mục</label>
            <select
              value={newKind}
              onChange={(e) => setNewKind(e.target.value)}
              className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
            >
              {SECTION_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => void addSection()}
            disabled={busy}
            className="min-h-[52px] rounded-xl bg-blue-600 text-base font-bold text-white disabled:opacity-50"
          >
            Thêm mục
          </button>
        </div>
      </Modal>

      {/* Xem trước toàn bộ slide */}
      <Modal open={showPreview} onClose={() => setShowPreview(false)} title="👁 Xem trước" wide>
        <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
          {orderedSlides.length === 0 && (
            <p className="py-6 text-center text-slate-400">Chưa có slide nào.</p>
          )}
          {orderedSlides.map((s, i) => (
            <div key={s.id} className="rounded-xl border border-slate-200 p-2">
              <p className="mb-1 text-xs font-bold text-slate-400">Slide {i + 1}</p>
              <SlideRenderer slide={s} width={320} aspect={program.aspect_ratio} />
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

export default SimpleProgramPage;
