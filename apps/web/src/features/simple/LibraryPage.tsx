// ============================================================================
// Thờ Phượng Slide — Thư viện (mobile-first)
// Nơi tạo thủ công và lưu các bài hát thánh ca + bài đọc Kinh Thánh để dùng
// lại: làm chương trình chỉ cần gõ tên bài là chèn nguyên slide đã làm sẵn.
// Kỹ thuật: xem features/simple/library.ts (không cần migration mới).
// ============================================================================
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../stores/auth';
import { ensureChurchLoaded, useChurch } from '../../stores/church';
import { useToast } from '../../components/ui';
import { uuid } from '../editor/lib/editorUtils';
import {
  ensureLibraryProgram,
  fetchLibraryItems,
  foldVi,
  type LibraryItem,
} from './library';
import { pushUndo, useUndoStore } from './undoStore';

export function LibraryPage() {
  const { user } = useAuth();
  const { currentChurch, loading: churchLoading } = useChurch();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [libId, setLibId] = useState<string | null>(null);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  /** Từ khóa tìm trong thư viện (tên bài hát / tham chiếu, không cần gõ dấu). */
  const [query, setQuery] = useState('');
  /** Số lần hoàn tác thành công — tải lại thư viện để khớp dữ liệu sau hoàn tác. */
  const undoSeq = useUndoStore((s) => s.seq);

  useEffect(() => {
    void ensureChurchLoaded();
  }, []);

  useEffect(() => {
    if (churchLoading || !currentChurch || !user) return;
    const load = async () => {
      setLoading(true);
      try {
        const lib = await ensureLibraryProgram(supabase, currentChurch.id, user.id);
        setLibId(lib.id);
        setItems(await fetchLibraryItems(supabase, lib.id));
      } catch (e) {
        toast(`Mở thư viện lỗi: ${(e as Error).message}`, 'error');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [churchLoading, currentChurch, user, undoSeq]);

  /** Tạo mục mới trong Thư viện rồi mở trình sửa mục quen thuộc để làm slide. */
  const addItem = async (kind: 'song' | 'bible') => {
    if (!libId) return;
    setBusy(true);
    try {
      const sectionId = uuid();
      const { error } = await supabase.from('sections').insert({
        id: sectionId,
        program_id: libId,
        title: kind === 'song' ? 'Bài hát mới' : 'Bài đọc mới',
        kind: kind === 'song' ? 'ton-vinh-chua' : 'doc-kinh-thanh',
        order_index: items.length,
      });
      if (error) throw new Error(error.message);
      pushUndo({
        label: kind === 'song' ? 'Thêm bài hát vào thư viện' : 'Thêm bài đọc vào thư viện',
        run: async () => {
          const { error: slErr } = await supabase
            .from('slides')
            .delete()
            .eq('section_id', sectionId);
          if (slErr) throw new Error(`Không xóa được slide: ${slErr.message}`);
          const { error: sErr } = await supabase.from('sections').delete().eq('id', sectionId);
          if (sErr) throw new Error(`Xóa khỏi thư viện lỗi: ${sErr.message}`);
        },
      });
      navigate(`/p/${libId}/muc/${sectionId}`);
    } catch (e) {
      toast(`Tạo mục lỗi: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const deleteItem = async (item: LibraryItem) => {
    if (!libId) return;
    if (!window.confirm(`Xóa “${item.displayTitle}” khỏi thư viện?`)) return;
    setBusy(true);
    try {
      const sectionSnap = { ...item.section };
      const slidesSnap = item.slides.map((s) => ({
        id: s.id,
        program_id: s.program_id,
        section_id: s.section_id,
        order_index: s.order_index,
        content: JSON.parse(JSON.stringify(s.content)) as typeof s.content,
        background: JSON.parse(JSON.stringify(s.background)) as typeof s.background,
      }));
      const { error: slErr } = await supabase
        .from('slides')
        .delete()
        .eq('section_id', item.section.id);
      if (slErr) throw new Error(slErr.message);
      const { error: sErr } = await supabase.from('sections').delete().eq('id', item.section.id);
      if (sErr) throw new Error(sErr.message);
      setItems((prev) => prev.filter((x) => x.section.id !== item.section.id));
      pushUndo({
        label: `Xóa khỏi thư viện “${item.displayTitle}”`,
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
          setItems(await fetchLibraryItems(supabase, libId));
        },
      });
      toast('Đã xóa khỏi thư viện.', 'success');
    } catch (e) {
      toast(`Xóa lỗi: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center bg-[#0e0f11] px-4 text-slate-200">
        Đang mở thư viện…
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col bg-[#0e0f11] px-4 pb-10 pt-3 text-slate-100">
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={() => navigate('/bat-dau')}
          aria-label="Về chương trình"
          className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-[#1b1e22] text-xl text-slate-200"
        >
          ←
        </button>
        <h1 className="text-lg font-bold text-white">📚 Thư viện</h1>
      </div>
      <p className="mb-3 text-sm text-slate-400">
        Bài hát thánh ca và bài đọc Kinh Thánh làm sẵn, lưu ở đây để dùng lại. Khi làm
        chương trình, trong mục bài hát chỉ cần gõ tên bài là chèn nguyên slide vào.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <button
          onClick={() => void addItem('song')}
          disabled={busy}
          className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-violet-600 px-3 text-base font-bold text-white disabled:opacity-50"
        >
          🎵 Thêm bài hát
        </button>
        <button
          onClick={() => void addItem('bible')}
          disabled={busy}
          className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-[#1b6fe0] px-3 text-base font-bold text-white disabled:opacity-50"
        >
          📖 Thêm bài đọc
        </button>
      </div>

      {items.length > 0 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 Tìm theo tên bài hát hoặc tham chiếu…"
          aria-label="Tìm trong thư viện"
          className="mb-3 min-h-[52px] w-full rounded-2xl border border-white/10 bg-[#16181c] px-4 text-base text-white placeholder:text-slate-500"
        />
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-[#16181c] p-4 text-sm text-slate-400">
          Thư viện chưa có gì. Bấm “Thêm bài hát” hoặc “Thêm bài đọc” rồi làm slide như
          bình thường, bấm Lưu là bài nằm trong thư viện để dùng lại mãi.
        </div>
      ) : (
        <LibraryItemList
          items={
            query.trim() === ''
              ? items
              : items.filter((it) =>
                  foldVi(`${it.displayTitle} ${it.matchText}`).includes(foldVi(query.trim())),
                )
          }
          query={query}
          busy={busy}
          onOpen={(item) => navigate(`/p/${libId}/muc/${item.section.id}`)}
          onDelete={(item) => void deleteItem(item)}
        />
      )}
    </div>
  );
}

/** Danh sách mục thư viện (đã lọc theo ô tìm) + trạng thái không tìm thấy. */
function LibraryItemList({
  items,
  query,
  busy,
  onOpen,
  onDelete,
}: {
  items: LibraryItem[];
  query: string;
  busy: boolean;
  onOpen: (item: LibraryItem) => void;
  onDelete: (item: LibraryItem) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-white/5 bg-[#16181c] p-4 text-sm text-slate-400">
        Không tìm thấy gì cho “{query}”. Thử gõ tên bài hát hoặc tham chiếu khác (không cần gõ dấu).
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div
          key={item.section.id}
          className="flex items-center gap-2 rounded-2xl border border-white/5 bg-[#16181c] p-3"
        >
          <button onClick={() => onOpen(item)} className="min-w-0 flex-1 text-left">
            <p className="truncate text-base font-bold text-white">
              {item.kind === 'lyrics' ? '🎵 ' : '📖 '}
              {item.displayTitle}
            </p>
            <p className="text-xs text-slate-500">
              {item.slides.length} slide · bấm để mở và sửa
            </p>
          </button>
          <button
            onClick={() => onDelete(item)}
            disabled={busy}
            aria-label={`Xóa ${item.displayTitle}`}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-red-900/50 text-lg text-red-400 disabled:opacity-50"
          >
            🗑
          </button>
        </div>
      ))}
    </div>
  );
}

export default LibraryPage;
