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
import { downloadBlob, exportFilename } from '../export/lib/units';
import type { Program, Section, Slide } from '../../lib/types';
import { orderProgramSlides } from '../../lib/slideOrder';
import { uuid } from '../editor/lib/editorUtils';
import { sectionFormHint } from './sectionForms';
import { createSimpleProgram, duplicateSimpleSection } from './programApi';
import { formatDate } from '../../lib/format';
import { pushUndo, useUndoStore } from './undoStore';

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
  /** Số lần hoàn tác thành công — tải lại chương trình để khớp dữ liệu sau hoàn tác. */
  const undoSeq = useUndoStore((s) => s.seq);

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
      // Mục và slide độc lập nhau — tải song song thay vì nối tiếp.
      const [{ data: secs }, { data: sls }] = await Promise.all([
        supabase.from('sections').select('*').eq('program_id', id).order('order_index'),
        supabase.from('slides').select('*').eq('program_id', id).order('order_index'),
      ]);
      setSections(((secs ?? []) as Section[]).sort((a, b) => a.order_index - b.order_index));
      setSlides(((sls ?? []) as Slide[]).sort((a, b) => a.order_index - b.order_index));
      setLoading(false);
    };
    void load();
  }, [id, undoSeq]);

  const slideCountOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of slides) {
      const k = s.section_id ?? '__none__';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return (sectionId: string | null) => m.get(sectionId ?? '__none__') ?? 0;
  }, [slides]);

  /** Toàn bộ slide đúng thứ tự chương trình: hết mục trước rồi mới tới mục sau. */
  const orderedSlides = useMemo(
    () => orderProgramSlides(sections, slides),
    [sections, slides],
  );

  /** Lưu tên + ngày chương trình. */
  const saveHeader = async () => {
    if (!program || !id) return;
    setBusy(true);
    const oldTitle = program.title;
    const oldDate = program.event_date;
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
    pushUndo({
      label: 'Lưu tiêu đề chương trình',
      run: async () => {
        const { error: e2 } = await supabase
          .from('programs')
          .update({ title: oldTitle, event_date: oldDate })
          .eq('id', id);
        if (e2) throw e2;
        setProgram((prev) => (prev ? { ...prev, title: oldTitle, event_date: oldDate } : prev));
        setTitle(oldTitle);
        setEventDate(oldDate ?? '');
      },
    });
    toast('Đã lưu chương trình.', 'success');
  };

  /** Đổi thứ tự 2 mục kề nhau (lên/xuống). */
  const moveSection = async (index: number, delta: -1 | 1) => {
    const j = index + delta;
    if (j < 0 || j >= sections.length) return;
    const a = sections[index];
    const b = sections[j];
    const prev = sections;
    const next = [...sections];
    next[index] = { ...b, order_index: index };
    next[j] = { ...a, order_index: j };
    setSections(next);
    // Dùng update từng dòng (không dùng upsert): upsert chỉ gửi {id,
    // order_index} nên dòng mới thiếu program_id → luật sections_insert kiểm
    // tra hội thánh qua program_id bị rỗng và từ chối ("new row violates
    // row-level security policy"). Update chỉ kiểm tra quyền trên dòng cũ
    // nên chạy đúng. Hai dòng khác nhau nên cập nhật song song được.
    const results = await Promise.all([
      supabase.from('sections').update({ order_index: j }).eq('id', a.id),
      supabase.from('sections').update({ order_index: index }).eq('id', b.id),
    ]);
    const error = results.find((r) => r.error)?.error;
    if (error) {
      toast(`Đổi thứ tự lỗi: ${error.message}`, 'error');
      void reloadSections();
      return;
    }
    pushUndo({
      label: 'Đổi thứ tự mục',
      run: async () => {
        const res = await Promise.all([
          supabase.from('sections').update({ order_index: a.order_index }).eq('id', a.id),
          supabase.from('sections').update({ order_index: b.order_index }).eq('id', b.id),
        ]);
        const e2 = res.find((r) => r.error)?.error;
        if (e2) throw e2;
        setSections(prev);
      },
    });
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

  const reloadSlides = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('slides')
      .select('*')
      .eq('program_id', id)
      .order('order_index');
    setSlides(((data ?? []) as Slide[]).sort((a, b) => a.order_index - b.order_index));
  };

  /** Nhân bản một mục kèm slide (đặt ngay sau mục gốc) — dùng cho thờ phượng 3–5 bài. */
  const duplicateSection = async (s: Section) => {
    if (!id) return;
    setBusy(true);
    try {
      const newId = await duplicateSimpleSection(supabase, id, s, slides);
      await reloadSections();
      await reloadSlides();
      pushUndo({
        label: `Nhân bản mục “${s.title}”`,
        run: async () => {
          // Xóa bản sao + dồn lại các mục đứng sau nó (khoảng trống thứ tự vô hại
          // nhưng dồn lại cho gọn); trang tự tải lại nhờ seq sau hoàn tác.
          const { data: copy } = await supabase
            .from('sections')
            .select('id,order_index')
            .eq('id', newId)
            .single();
          const { error: slErr } = await supabase
            .from('slides')
            .delete()
            .eq('section_id', newId);
          if (slErr) throw new Error(`Không xóa được slide bản sao: ${slErr.message}`);
          const { error: sErr } = await supabase.from('sections').delete().eq('id', newId);
          if (sErr) throw new Error(`Xóa bản sao lỗi: ${sErr.message}`);
          if (copy) {
            const { data: later } = await supabase
              .from('sections')
              .select('id,order_index')
              .eq('program_id', id)
              .gt('order_index', (copy as { order_index: number }).order_index);
            await Promise.all(
              ((later ?? []) as { id: string; order_index: number }[]).map((row) =>
                supabase
                  .from('sections')
                  .update({ order_index: row.order_index - 1 })
                  .eq('id', row.id),
              ),
            );
          }
        },
      });
      toast(`Đã nhân bản “${s.title}” — mở bản sao để nhập bài hát mới.`, 'success');
    } catch (e) {
      toast(`Nhân bản lỗi: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  /** Thêm nhanh 1 mục thờ phượng (đủ 2 ô: tên bài hát + lời) rồi mở ngay màn sửa. */
  const quickAddSong = async () => {
    if (!id) return;
    setBusy(true);
    try {
      const newId = uuid();
      const { error } = await supabase.from('sections').insert({
        id: newId,
        program_id: id,
        title: 'Tôn vinh Chúa',
        kind: 'ton-vinh-chua',
        // Số thứ tự = lớn nhất hiện có + 1 (không dùng sections.length vì sau
        // khi xóa mục sẽ còn khoảng trống gây trùng số thứ tự).
        order_index:
          sections.length > 0 ? Math.max(...sections.map((s) => s.order_index)) + 1 : 0,
      });
      if (error) throw new Error(`Thêm bài hát lỗi: ${error.message}`);
      pushUndo({
        label: 'Thêm bài hát mới',
        run: async ({ go }) => {
          const { error: e2 } = await supabase.from('sections').delete().eq('id', newId);
          if (e2) throw e2;
          go(`/p/${id}`);
        },
      });
      navigate(`/p/${id}/muc/${newId}`);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
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
      order_index:
        sections.length > 0 ? Math.max(...sections.map((s) => s.order_index)) + 1 : 0,
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
    pushUndo({
      label: `Thêm mục “${row.title}”`,
      run: async () => {
        const { error: e2 } = await supabase.from('sections').delete().eq('id', row.id);
        if (e2) throw e2;
        setSections((xs) => xs.filter((x) => x.id !== row.id));
      },
    });
    toast('Đã thêm mục mới.', 'success');
  };

  /** Xóa một mục kèm toàn bộ slide của nó (cần xác nhận). */
  const deleteSection = async (s: Section) => {
    if (!id) return;
    const n = slideCountOf(s.id);
    if (!window.confirm(`Xóa mục “${s.title}”${n > 0 ? ` và ${n} slide` : ''} của nó?`)) return;
    setBusy(true);
    try {
      const sectionSnap = { ...s };
      const slidesSnap = slides
        .filter((sl) => sl.section_id === s.id)
        .map((sl) => ({
          id: sl.id,
          program_id: sl.program_id,
          section_id: sl.section_id,
          order_index: sl.order_index,
          content: JSON.parse(JSON.stringify(sl.content)) as Slide['content'],
          background: JSON.parse(JSON.stringify(sl.background)) as Slide['background'],
        }));
      const { error: slErr } = await supabase.from('slides').delete().eq('section_id', s.id);
      if (slErr)
        throw new Error(`Không xóa được slide (cần quyền Quản trị viên): ${slErr.message}`);
      const { error: sErr } = await supabase.from('sections').delete().eq('id', s.id);
      if (sErr) throw new Error(`Xóa mục lỗi: ${sErr.message}`);
      setSections((xs) => xs.filter((x) => x.id !== s.id).map((x, i) => ({ ...x, order_index: i })));
      pushUndo({
        label: `Xóa mục “${s.title}”`,
        run: async () => {
          const { error: e2 } = await supabase.from('sections').insert({
            id: sectionSnap.id,
            program_id: sectionSnap.program_id,
            title: sectionSnap.title,
            kind: sectionSnap.kind,
            order_index: sectionSnap.order_index,
          });
          if (e2) throw new Error(`Khôi phục mục lỗi: ${e2.message}`);
          if (slidesSnap.length > 0) {
            const { error: e3 } = await supabase.from('slides').insert(slidesSnap);
            if (e3) throw new Error(`Khôi phục slide lỗi: ${e3.message}`);
          }
        },
      });
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
      pushUndo({
        label: 'Tạo chương trình Chúa Nhật mới',
        run: async ({ go }) => {
          const { error } = await supabase
            .from('programs')
            .update({ status: 'deleted' })
            .eq('id', pid);
          if (error) throw error;
          go('/p');
        },
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
      // Tải code xuất PPTX khi bấm nút (thay vì kèm sẵn trong gói chính) —
      // gói chính nhẹ đi, mở app nhanh hơn; lần xuất đầu chờ tải thêm 1 lúc.
      const { exportPPTX } = await import('../export/lib/pptx');
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

  /** Khôi phục chương trình đang xem (đang ở trạng thái đã xóa mềm). */
  const restoreProgram = async () => {
    if (!id) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from('programs')
        .update({ status: 'draft' })
        .eq('id', id);
      if (error) throw error;
      setProgram({ ...program, status: 'draft' });
      pushUndo({
        label: `Khôi phục chương trình “${program.title}”`,
        run: async ({ go }) => {
          const { error: e2 } = await supabase
            .from('programs')
            .update({ status: 'deleted' })
            .eq('id', id);
          if (e2) throw e2;
          go('/p');
        },
      });
      toast('Đã khôi phục chương trình.', 'success');
    } catch (e) {
      toast(`Khôi phục lỗi: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (program.status === 'deleted') {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col bg-[#0e0f11] px-4 pb-10 pt-3 text-slate-100">
        <div className="mt-10 rounded-2xl border border-white/5 bg-[#16181c] p-6 text-center">
          <p className="mb-2 text-4xl">🗑</p>
          <p className="mb-2 text-lg font-bold text-white">Chương trình này đã bị xóa.</p>
          <p className="mb-4 text-sm text-slate-400">
            Chương trình chỉ bị ẩn đi, vẫn khôi phục lại nguyên vẹn được.
          </p>
          <button
            onClick={() => void restoreProgram()}
            disabled={busy}
            className="mb-2 flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-amber-500 font-bold text-black disabled:opacity-50"
          >
            ↩ Khôi phục chương trình
          </button>
          <button
            onClick={() => navigate('/p')}
            className="flex min-h-[52px] w-full items-center justify-center rounded-2xl border border-white/10 font-bold text-slate-200"
          >
            Về danh sách
          </button>
        </div>
      </div>
    );
  }

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
            <span className="flex shrink-0 items-center gap-0.5">
              <button
                onClick={() => void duplicateSection(s)}
                disabled={busy}
                title="Nhân bản mục (thêm bài hát mới)"
                aria-label={`Nhân bản mục ${s.title}`}
                className="flex min-h-[44px] min-w-[40px] items-center justify-center rounded-xl text-lg text-slate-300 disabled:opacity-30"
              >
                ⧉
              </button>
              <button
                onClick={() => void deleteSection(s)}
                disabled={busy}
                title="Xóa mục"
                aria-label={`Xóa mục ${s.title}`}
                className="flex min-h-[44px] min-w-[40px] items-center justify-center rounded-xl text-lg text-slate-400 disabled:opacity-30"
              >
                🗑
              </button>
              <button
                onClick={() => void moveSection(i, -1)}
                disabled={i === 0 || busy}
                title="Chuyển mục lên"
                aria-label={`Chuyển ${s.title} lên`}
                className="flex min-h-[44px] min-w-[36px] items-center justify-center rounded-xl text-lg text-slate-300 disabled:opacity-20"
              >
                ∧
              </button>
              <button
                onClick={() => void moveSection(i, 1)}
                disabled={i === sections.length - 1 || busy}
                title="Chuyển mục xuống"
                aria-label={`Chuyển ${s.title} xuống`}
                className="flex min-h-[44px] min-w-[36px] items-center justify-center rounded-xl text-lg text-slate-300 disabled:opacity-20"
              >
                ∨
              </button>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => setShowAdd(true)}
          className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 text-base font-bold text-slate-300"
        >
          ＋ Thêm mục mới
        </button>
        <button
          onClick={() => void quickAddSong()}
          disabled={busy}
          className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-violet-500/40 text-base font-bold text-violet-200 disabled:opacity-50"
        >
          🎵 Thêm bài hát
        </button>
      </div>

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
                to="/thu-vien"
                onClick={() => setMenuOpen(false)}
                className="flex min-h-[52px] items-center gap-3 rounded-xl px-3 text-base font-medium text-slate-200 hover:bg-white/5"
              >
                <span className="text-xl">📚</span> Thư viện bài hát &amp; Kinh Thánh
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
