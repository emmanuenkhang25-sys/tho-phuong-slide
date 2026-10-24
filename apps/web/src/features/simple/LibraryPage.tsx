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
  type LibraryItem,
} from './library';

export function LibraryPage() {
  const { user } = useAuth();
  const { currentChurch, loading: churchLoading } = useChurch();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [libId, setLibId] = useState<string | null>(null);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

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
  }, [churchLoading, currentChurch, user]);

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
      const { error: slErr } = await supabase
        .from('slides')
        .delete()
        .eq('section_id', item.section.id);
      if (slErr) throw new Error(slErr.message);
      const { error: sErr } = await supabase.from('sections').delete().eq('id', item.section.id);
      if (sErr) throw new Error(sErr.message);
      setItems((prev) => prev.filter((x) => x.section.id !== item.section.id));
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

      {items.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-[#16181c] p-4 text-sm text-slate-400">
          Thư viện chưa có gì. Bấm “Thêm bài hát” hoặc “Thêm bài đọc” rồi làm slide như
          bình thường, bấm Lưu là bài nằm trong thư viện để dùng lại mãi.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div
              key={item.section.id}
              className="flex items-center gap-2 rounded-2xl border border-white/5 bg-[#16181c] p-3"
            >
              <button
                onClick={() => navigate(`/p/${libId}/muc/${item.section.id}`)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-base font-bold text-white">
                  {item.kind === 'lyrics' ? '🎵 ' : '📖 '}
                  {item.displayTitle}
                </p>
                <p className="text-xs text-slate-500">
                  {item.slides.length} slide · bấm để mở và sửa
                </p>
              </button>
              <button
                onClick={() => void deleteItem(item)}
                disabled={busy}
                aria-label={`Xóa ${item.displayTitle}`}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-red-900/50 text-lg text-red-400 disabled:opacity-50"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LibraryPage;
