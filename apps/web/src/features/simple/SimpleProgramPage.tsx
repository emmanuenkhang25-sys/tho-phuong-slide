// ============================================================================
// Thờ Phượng Slide — giao diện đơn giản (mobile-first, nền tối)
// SimpleProgramPage — MÀN HÌNH CHÍNH: mở app là thấy ngay thứ tự chương trình.
// Thẻ xanh tiêu đề + danh sách mục đánh số (xóa, lên/xuống), bấm vào mục để sửa.
// ============================================================================
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../stores/auth';
import { ensureChurchLoaded, useChurch } from '../../stores/church';
import { Modal, useToast } from '../../components/ui';
import { SECTION_KINDS, sectionKindLabel } from '../editor/lib/editorUtils';
import { SlideRenderer } from '../editor/components/SlideRenderer';
import { exportPPTX } from '../export/lib/pptx';
import { downloadBlob, exportFilename } from '../export/lib/units';
import type { Program, Section, Slide } from '../../lib/types';
import { uuid } from '../editor/lib/editorUtils';
import { sectionFormHint } from './sectionForms';
import { createSimpleProgram } from './programApi';
import { formatDate } from '../../lib/format';

export function SimpleProgramPage() {
  const { id } = useParams<{ id: string }>();
  const { user, signOut } = useAuth();
  const { currentChurch } = useChurch();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [program, setProgram] = useState<Program | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [showEditHeader, setShowEditHeader] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState('custom');
  const [showPreview, setShowPreview] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    void ensureChurchLoaded();
  }, []);

  // Đóng ngăn kéo menu bằng phím Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      const { data: p } = await supabase.from('programs').select('*').eq('id', id).single();
      if (!p) {
        toast('Không tìm thấy chương trình.', 'error');
        navigate('/bat-dau', { replace: true });
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
    setShowEditHeader(false);
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

  /** Xóa một mục kèm toàn bộ slide của nó (cần xác nhận). */
  const deleteSection = async (s: Section) => {
    if (!id) return;
    const n = slideCountOf(s.id);
    if (!window.confirm(`Xóa mục “${s.title}”${n > 0 ? ` và ${n} slide` : ''} của nó?`)) return;
    setBusy(true);
    try {
      const { error: slErr } = await supabase.from('slides').delete().eq('section_id', s.id);
      if (slErr)
        throw new Error(`Không xóa được slide (cần quyền Quản trị viên): ${slErr.message}`);
      const { error: sErr } = await supabase.from('sections').delete().eq('id', s.id);
      if (sErr) throw new Error(`Xóa mục lỗi: ${sErr.message}`);
      setSections((xs) => xs.filter((x) => x.id !== s.id).map((x, i) => ({ ...x, order_index: i })));
      toast('Đã xóa mục.', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  /** Tạo nhanh chương trình Chúa Nhật mới từ mẫu rồi mở ngay. */
  const quickNewProgram = async () => {
    if (!currentChurch || !user) {
      toast('Chưa có hội thánh. Hãy tạo hội thánh trước.', 'error');
      navigate('/hoi-thanh');
      return;
    }
    setBusy(true);
    try {
      const pid = await createSimpleProgram(supabase, {
        churchId: currentChurch.id,
        userId: user.id,
        templateId: 'chu-nhat',
      });
      toast('Đã tạo chương trình Chúa Nhật mới.', 'success');
      navigate(`/p/${pid}`);
    } catch (e) {
      toast(`Tạo chương trình lỗi: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
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

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    navigate('/dang-nhap', { replace: true });
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center bg-[#0e0f11] px-4">
        <p className="text-slate-400">Đang tải chương trình…</p>
      </div>
    );
  }
  if (!program) return null;

  const rowDesc = (s: Section) => {
    const hint = sectionFormHint(s.kind);
    const base = hint.heading !== 'Nội dung mục' ? hint.heading : sectionKindLabel(s.kind);
    const n = slideCountOf(s.id);
    return `${base} · ${n} slide`;
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col bg-[#0e0f11] px-4 pb-10 pt-3 text-slate-100">
      {/* Thanh trên: menu + tạo nhanh */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Mở menu"
          className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-[#1b1e22] text-xl text-slate-200"
        >
          ☰
        </button>
        <button
          onClick={() => void quickNewProgram()}
          disabled={busy}
          aria-label="Tạo chương trình Chúa Nhật mới"
          title="Tạo chương trình Chúa Nhật mới"
          className="flex min-h-[48px] items-center gap-1 rounded-full bg-[#1b1e22] px-4 text-base font-bold text-slate-200 disabled:opacity-50"
        >
          <span className="text-xl">＋</span> Mới
        </button>
      </div>

      {/* Thẻ xanh tiêu đề chương trình */}
      <button
        onClick={() => setShowEditHeader(true)}
        className="block w-full rounded-3xl bg-gradient-to-b from-[#35684a] to-[#234a31] p-6 text-center shadow-lg"
        aria-label="Chạm để sửa tên và ngày chương trình"
      >
        <span className="block text-2xl font-extrabold uppercase leading-snug tracking-wide text-white">
          {program.title}
        </span>
        <span className="mt-2 block text-sm font-medium uppercase tracking-wider text-white/70">
          {currentChurch?.name ?? 'Hội Thánh'} ·{' '}
          {program.event_date ? formatDate(program.event_date) : 'Chúa Nhật'}
        </span>
        <span className="mt-1 block text-xs text-white/40">✎ chạm để sửa tên / ngày</span>
      </button>

      {/* Hàng nút thao tác */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        <button
          onClick={() => void saveHeader()}
          disabled={busy}
          className="flex min-h-[60px] flex-col items-center justify-center gap-0.5 rounded-2xl bg-[#1b6fe0] font-bold text-white disabled:opacity-50"
        >
          <span className="text-xl">💾</span>
          <span className="text-xs">Lưu</span>
        </button>
        <button
          onClick={() => setShowPreview(true)}
          className="flex min-h-[60px] flex-col items-center justify-center gap-0.5 rounded-2xl bg-[#1b1e22] font-bold text-slate-200"
        >
          <span className="text-xl">👁</span>
          <span className="text-xs">Xem trước</span>
        </button>
        <button
          onClick={() => navigate(`/trinh-chieu/${program.id}`)}
          className="flex min-h-[60px] flex-col items-center justify-center gap-0.5 rounded-2xl bg-[#0d9d5b] font-bold text-white"
        >
          <span className="text-xl">▶️</span>
          <span className="text-xs">Chiếu</span>
        </button>
        <button
          onClick={() => void doExportPPTX()}
          disabled={exporting || slides.length === 0}
          className="flex min-h-[60px] flex-col items-center justify-center gap-0.5 rounded-2xl bg-[#c07f10] font-bold text-white disabled:opacity-50"
        >
          <span className="text-xl">⬇</span>
          <span className="text-xs">{exporting ? '…' : 'PPTX'}</span>
        </button>
      </div>

      {/* Tiêu đề danh sách mục */}
      <div className="mb-1 mt-5 flex items-center justify-between px-1">
        <h2 className="text-lg font-bold text-white">Nội dung chương trình</h2>
        <span className="rounded-full bg-[#23262b] px-3 py-1 text-xs font-bold text-slate-300">
          {sections.length} mục
        </span>
      </div>
      <p className="mb-3 px-1 text-sm text-slate-400">
        Bấm vào từng mục để nhập nội dung và tạo slide.
      </p>

      {/* Danh sách mục */}
      <ul className="flex flex-col gap-2.5">
        {sections.map((s, i) => (
          <li
            key={s.id}
            className="flex items-center gap-3 rounded-2xl border border-white/5 bg-[#16181c] p-3"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2b2f34] text-xl font-extrabold text-white">
              {i + 1}
            </span>
            <button
              onClick={() => navigate(`/p/${program.id}/muc/${s.id}`)}
              className="min-w-0 flex-1 rounded-xl py-1 text-left"
              aria-label={`Mở mục ${s.title}`}
            >
              <span className="block truncate text-lg font-bold text-white">{s.title}</span>
              <span className="block truncate text-sm text-slate-400">{rowDesc(s)}</span>
            </button>
            <span className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => void deleteSection(s)}
                disabled={busy}
                title="Xóa mục"
                aria-label={`Xóa mục ${s.title}`}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-lg text-slate-400 disabled:opacity-30"
              >
                🗑
              </button>
              <button
                onClick={() => void moveSection(i, -1)}
                disabled={i === 0 || busy}
                title="Chuyển mục lên"
                aria-label={`Chuyển ${s.title} lên`}
                className="flex min-h-[44px] min-w-[40px] items-center justify-center rounded-xl text-lg text-slate-300 disabled:opacity-20"
              >
                ∧
              </button>
              <button
                onClick={() => void moveSection(i, 1)}
                disabled={i === sections.length - 1 || busy}
                title="Chuyển mục xuống"
                aria-label={`Chuyển ${s.title} xuống`}
                className="flex min-h-[44px] min-w-[40px] items-center justify-center rounded-xl text-lg text-slate-300 disabled:opacity-20"
              >
                ∨
              </button>
            </span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => setShowAdd(true)}
        className="mt-3 flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 text-base font-bold text-slate-300"
      >
        ＋ Thêm mục mới
      </button>

      {/* Ngăn kéo menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-label="Menu">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMenuOpen(false)}
            aria-hidden
          />
          <nav className="absolute left-0 top-0 flex h-full w-72 max-w-[80vw] flex-col bg-[#141619] p-4 shadow-2xl">
            <p className="mb-1 px-2 text-lg font-extrabold text-white">⛪ Thờ Phượng Slide</p>
            {currentChurch && (
              <p className="mb-4 truncate px-2 text-sm text-slate-400">{currentChurch.name}</p>
            )}
            <div className="flex flex-col gap-1">
              <Link
                to="/p"
                onClick={() => setMenuOpen(false)}
                className="flex min-h-[52px] items-center gap-3 rounded-xl px-3 text-base font-medium text-slate-200 hover:bg-white/5"
              >
                <span className="text-xl">📋</span> Danh sách chương trình
              </Link>
              <Link
                to="/hoi-thanh"
                onClick={() => setMenuOpen(false)}
                className="flex min-h-[52px] items-center gap-3 rounded-xl px-3 text-base font-medium text-slate-200 hover:bg-white/5"
              >
                <span className="text-xl">⛪</span> Hội thánh
              </Link>
              <Link
                to="/sao-luu"
                onClick={() => setMenuOpen(false)}
                className="flex min-h-[52px] items-center gap-3 rounded-xl px-3 text-base font-medium text-slate-200 hover:bg-white/5"
              >
                <span className="text-xl">💾</span> Sao lưu
              </Link>
              <Link
                to="/huong-dan"
                onClick={() => setMenuOpen(false)}
                className="flex min-h-[52px] items-center gap-3 rounded-xl px-3 text-base font-medium text-slate-200 hover:bg-white/5"
              >
                <span className="text-xl">❓</span> Hướng dẫn
              </Link>
              <Link
                to="/cai-dat"
                onClick={() => setMenuOpen(false)}
                className="flex min-h-[52px] items-center gap-3 rounded-xl px-3 text-base font-medium text-slate-200 hover:bg-white/5"
              >
                <span className="text-xl">⚙️</span> Cài đặt
              </Link>
            </div>
            <div className="mt-auto">
              <button
                onClick={() => void handleSignOut()}
                className="flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-base font-medium text-red-400 hover:bg-white/5"
              >
                <span className="text-xl">🚪</span> Đăng xuất
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* Sửa tên + ngày chương trình */}
      <Modal open={showEditHeader} onClose={() => setShowEditHeader(false)} title="✎ Tên & ngày">
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-300">Tên chương trình</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Chương trình Chúa Nhật"
              className="min-h-[52px] w-full rounded-xl border border-white/10 bg-[#0e0f11] px-3 text-base text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-300">Ngày tổ chức</label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="min-h-[52px] w-full rounded-xl border border-white/10 bg-[#0e0f11] px-3 text-base text-white"
            />
          </div>
          <button
            onClick={() => void saveHeader()}
            disabled={busy}
            className="min-h-[54px] rounded-2xl bg-[#1b6fe0] text-base font-bold text-white disabled:opacity-50"
          >
            💾 Lưu
          </button>
        </div>
      </Modal>

      {/* Dialog thêm mục */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="＋ Thêm mục mới">
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-300">Tên mục</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="VD: Hát ngợi khen"
              className="min-h-[52px] w-full rounded-xl border border-white/10 bg-[#0e0f11] px-3 text-base text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-300">Loại mục</label>
            <select
              value={newKind}
              onChange={(e) => setNewKind(e.target.value)}
              className="min-h-[52px] w-full rounded-xl border border-white/10 bg-[#0e0f11] px-3 text-base text-white"
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
            className="min-h-[54px] rounded-2xl bg-[#1b6fe0] text-base font-bold text-white disabled:opacity-50"
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
            <div key={s.id} className="rounded-xl border border-white/10 p-2">
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
