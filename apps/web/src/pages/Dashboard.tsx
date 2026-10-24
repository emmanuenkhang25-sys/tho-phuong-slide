import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Program } from '../lib/types';
import { useAuth } from '../stores/auth';
import { ensureChurchLoaded, useChurch } from '../stores/church';
import { useSyncStatus } from '../stores/sync';
import { canDeleteProgram, canEditProgram, canPresent } from '../lib/permissions';
import { formatDate, timeAgo, todayISODate } from '../lib/format';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  Spinner,
  useToast,
} from '../components/ui';

interface ProgramWithEditor extends Program {
  editor_name?: string;
}

export function Dashboard() {
  const { user, profile } = useAuth();
  const { currentChurch, myRole, loading: churchLoading } = useChurch();
  const { status: syncStatus, message: syncMessage } = useSyncStatus();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [programs, setPrograms] = useState<ProgramWithEditor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>(() => {
    try {
      return (localStorage.getItem('tps:program-view') as 'grid' | 'list') || 'grid';
    } catch {
      return 'grid';
    }
  });
  const [tab, setTab] = useState<'recent' | 'upcoming'>('recent');
  const [deleting, setDeleting] = useState<Program | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void ensureChurchLoaded();
  }, []);

  useEffect(() => {
    if (churchLoading) return;
    if (!currentChurch) {
      setPrograms([]);
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('programs')
        .select('*')
        .eq('church_id', currentChurch.id)
        .neq('status', 'deleted')
        .order('updated_at', { ascending: false })
        .limit(100);
      if (error) {
        toast(`Tải danh sách chương trình lỗi: ${error.message}`, 'error');
        setPrograms([]);
        setLoading(false);
        return;
      }
      const rows = (data ?? []) as Program[];
      // Tên người cập nhật gần nhất (gộp 1 query profiles)
      const ids = [...new Set(rows.map((p) => p.updated_by).filter(Boolean))] as string[];
      let names: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, display_name, email').in('id', ids);
        for (const p of (profs ?? []) as Array<{ id: string; display_name: string | null; email: string }>) {
          names[p.id] = p.display_name || p.email;
        }
      }
      setPrograms(rows.map((p) => ({ ...p, editor_name: p.updated_by ? names[p.updated_by] : undefined })));
      setLoading(false);
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChurch?.id, churchLoading]);

  const setViewMode = (v: 'grid' | 'list') => {
    setView(v);
    try {
      localStorage.setItem('tps:program-view', v);
    } catch {
      /* bỏ qua */
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = programs;
    if (q) list = list.filter((p) => p.title.toLowerCase().includes(q));
    if (tab === 'upcoming') {
      const today = todayISODate();
      list = list
        .filter((p) => p.event_date && p.event_date >= today)
        .sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''));
    }
    return list;
  }, [programs, search, tab]);

  const nearestUpcoming = useMemo(() => {
    const today = todayISODate();
    return programs
      .filter((p) => p.event_date && p.event_date >= today)
      .sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''))[0];
  }, [programs]);

  const createProgram = async () => {
    if (!currentChurch || !user) return;
    setBusy(true);
    const { data, error } = await supabase
      .from('programs')
      .insert({
        church_id: currentChurch.id,
        title: 'Chương trình mới',
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id')
      .single();
    setBusy(false);
    if (error || !data) {
      toast(`Tạo chương trình lỗi: ${error?.message ?? 'không rõ'}`, 'error');
      return;
    }
    toast('Đã tạo chương trình mới.', 'success');
    navigate(`/chuong-trinh/${(data as { id: string }).id}`);
  };

  const toggleFavorite = async (p: Program) => {
    const { error } = await supabase.from('programs').update({ is_favorite: !p.is_favorite }).eq('id', p.id);
    if (error) {
      toast(`Lỗi: ${error.message}`, 'error');
      return;
    }
    setPrograms((ps) => ps.map((x) => (x.id === p.id ? { ...x, is_favorite: !p.is_favorite } : x)));
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    // Xóa mềm: status='deleted' (RLS update yêu cầu editor+; nút chỉ hiện với admin+)
    const { error } = await supabase
      .from('programs')
      .update({ status: 'deleted', deleted_at: new Date().toISOString() })
      .eq('id', deleting.id);
    setBusy(false);
    setDeleting(null);
    if (error) {
      toast(`Xóa lỗi: ${error.message}`, 'error');
      return;
    }
    setPrograms((ps) => ps.filter((x) => x.id !== deleting.id));
    toast('Đã xóa chương trình.', 'success');
  };

  const greetingName = profile?.display_name || 'bạn';

  return (
    <div className="flex flex-col gap-6">
      {/* Chào + hội thánh */}
      <section className="rounded-2xl bg-gradient-to-r from-church-800 to-church-600 p-6 text-white">
        <h1 className="text-2xl font-bold">Xin chào {greetingName} 👋</h1>
        <p className="mt-1 text-church-100">
          {currentChurch ? (
            <>Hội thánh đang dùng: <strong>{currentChurch.name}</strong></>
          ) : (
            'Bạn chưa thuộc hội thánh nào — hãy tạo hoặc tham gia một hội thánh để bắt đầu.'
          )}
        </p>
        <p className="mt-2 text-xs text-church-200" title={syncMessage}>
          Trạng thái lưu: {syncStatus === 'da-dong-bo' ? '✅ Đã đồng bộ' : syncMessage}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {canEditProgram(myRole) && currentChurch && (
            <Button onClick={createProgram} loading={busy} className="!bg-gold-400 !text-church-950 hover:!bg-gold-500">
              ➕ Tạo chương trình mới
            </Button>
          )}
          {canPresent(myRole) && nearestUpcoming && (
            <Link to={`/trinh-chieu/${nearestUpcoming.id}`}>
              <Button variant="secondary">▶️ Trình chiếu: {nearestUpcoming.title}</Button>
            </Link>
          )}
          <Link to="/mau-slide">
            <Button variant="secondary">🎵 Thư viện bài hát</Button>
          </Link>
          <Link to="/hoi-thanh">
            <Button variant="secondary">⛪ Quản lý hội thánh</Button>
          </Link>
        </div>
      </section>

      {!currentChurch && !churchLoading ? (
        <EmptyState
          icon="⛪"
          title="Chưa có hội thánh"
          message="Tạo hội thánh mới hoặc bấm link lời mời từ quản trị viên để tham gia."
          action={
            <Link to="/hoi-thanh">
              <Button>Đến trang Hội thánh</Button>
            </Link>
          }
        />
      ) : (
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg bg-slate-200 p-1 dark:bg-slate-800">
              <button
                onClick={() => setTab('recent')}
                className={`min-h-touch rounded-md px-4 text-sm font-semibold ${tab === 'recent' ? 'bg-white shadow dark:bg-slate-700' : 'text-slate-600 dark:text-slate-300'}`}
              >
                🕘 Gần đây
              </button>
              <button
                onClick={() => setTab('upcoming')}
                className={`min-h-touch rounded-md px-4 text-sm font-semibold ${tab === 'upcoming' ? 'bg-white shadow dark:bg-slate-700' : 'text-slate-600 dark:text-slate-300'}`}
              >
                📅 Sắp diễn ra
              </button>
            </div>
            <div className="w-full sm:w-64">
              <Input placeholder="🔍 Tìm theo tên…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Tìm chương trình" />
            </div>
            <div className="ml-auto flex rounded-lg bg-slate-200 p-1 dark:bg-slate-800" role="group" aria-label="Kiểu hiển thị">
              <button
                onClick={() => setViewMode('grid')}
                aria-label="Hiển thị dạng lưới"
                className={`flex min-h-touch min-w-touch items-center justify-center rounded-md px-3 ${view === 'grid' ? 'bg-white shadow dark:bg-slate-700' : 'text-slate-600 dark:text-slate-300'}`}
              >
                🔲
              </button>
              <button
                onClick={() => setViewMode('list')}
                aria-label="Hiển thị dạng danh sách"
                className={`flex min-h-touch min-w-touch items-center justify-center rounded-md px-3 ${view === 'list' ? 'bg-white shadow dark:bg-slate-700' : 'text-slate-600 dark:text-slate-300'}`}
              >
                ☰
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="📝"
              title={search ? 'Không tìm thấy chương trình' : 'Chưa có chương trình nào'}
              message={search ? 'Thử từ khóa khác.' : 'Tạo chương trình thờ phượng đầu tiên cho hội thánh của bạn.'}
              action={
                canEditProgram(myRole) && !search ? <Button onClick={createProgram}>➕ Tạo chương trình mới</Button> : undefined
              }
            />
          ) : (
            <div className={view === 'grid' ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'flex flex-col gap-3'}>
              {filtered.map((p) => (
                <article
                  key={p.id}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <button
                      onClick={() => toggleFavorite(p)}
                      aria-label={p.is_favorite ? 'Bỏ đánh dấu yêu thích' : 'Đánh dấu yêu thích'}
                      className="min-h-touch min-w-touch text-xl"
                    >
                      {p.is_favorite ? '⭐' : '☆'}
                    </button>
                    {canDeleteProgram(myRole) && (
                      <button
                        onClick={() => setDeleting(p)}
                        aria-label={`Xóa ${p.title}`}
                        className="flex min-h-touch min-w-touch items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                  <Link to={`/chuong-trinh/${p.id}`} className="min-h-touch">
                    <h3 className="line-clamp-2 text-base font-bold text-slate-900 hover:text-church-700 dark:text-slate-100 dark:hover:text-church-300">
                      {p.title}
                    </h3>
                  </Link>
                  <dl className="mt-2 space-y-1 text-sm text-slate-500 dark:text-slate-400">
                    <div className="flex gap-2">
                      <dt>📅</dt>
                      <dd>{formatDate(p.event_date)}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt>✏️</dt>
                      <dd>
                        {p.editor_name ?? '—'} · {timeAgo(p.updated_at)}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex gap-2">
                    {canEditProgram(myRole) && (
                      <Link to={`/chuong-trinh/${p.id}`} className="flex-1">
                        <Button variant="secondary" className="w-full">
                          Mở
                        </Button>
                      </Link>
                    )}
                    {canPresent(myRole) && (
                      <Link to={`/trinh-chieu/${p.id}`} className="flex-1">
                        <Button className="w-full">▶️ Chiếu</Button>
                      </Link>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Xóa chương trình?"
        message={
          <>
            Bạn sắp xóa <strong>“{deleting?.title}”</strong>. Chương trình sẽ chuyển vào trạng thái đã
            xóa và không hiện trong danh sách nữa.
          </>
        }
        confirmLabel="Xóa"
        danger
        loading={busy}
      />
    </div>
  );
}

export default Dashboard;
