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
  Modal,
  Spinner,
  useToast,
} from '../components/ui';
import { PROGRAM_TEMPLATES, buildProgramFromTemplate } from '../features/templates/programTemplates';
import { uuid } from '../features/editor/lib/editorUtils';

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
  const [showTemplateChoice, setShowTemplateChoice] = useState(false);

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

  const createProgram = async (templateId: string | null) => {
    if (!currentChurch || !user) return;
    // Xác thực phiên đăng nhập với server trước khi ghi (tránh token hết hạn)
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      setShowTemplateChoice(false);
      toast('Phiên đăng nhập đã hết hạn. Vui lòng đăng xuất rồi đăng nhập lại.', 'error');
      return;
    }
    setBusy(true);
    // Tạo id ở máy khách, INSERT không kèm .select() (không dùng RETURNING)
    const programId = uuid();
    const { error } = await supabase.from('programs').insert({
      id: programId,
      church_id: currentChurch.id,
      title: templateId ? 'Chương trình thờ phượng Chúa nhật' : 'Chương trình mới',
      created_by: userData.user.id,
      updated_by: userData.user.id,
    });
    if (error) {
      setBusy(false);
      toast(`Tạo chương trình lỗi: ${error.message}`, 'error');
      return;
    }
    // Dựng sẵn mục + slide từ mẫu chương trình (nếu chọn)
    if (templateId) {
      const template = PROGRAM_TEMPLATES.find((t) => t.id === templateId);
      if (template) {
        const { sections, slides } = buildProgramFromTemplate(programId, template);
        const { error: secErr } = await supabase.from('sections').insert(
          sections.map((s) => ({
            id: s.id,
            program_id: s.program_id,
            title: s.title,
            kind: s.kind,
            order_index: s.order_index,
          })),
        );
        if (!secErr && slides.length > 0) {
          const { error: sliErr } = await supabase.from('slides').insert(
            slides.map((s) => ({
              id: s.id,
              program_id: s.program_id,
              section_id: s.section_id,
              order_index: s.order_index,
              content: s.content,
              background: s.background,
            })),
          );
          if (sliErr) {
            toast(`Tạo mục mẫu xong, nhưng tạo slide mẫu lỗi: ${sliErr.message}`, 'error');
          }
        } else if (secErr) {
          toast(`Tạo chương trình xong, nhưng tạo mục mẫu lỗi: ${secErr.message}`, 'error');
        }
      }
    }
    setBusy(false);
    setShowTemplateChoice(false);
    toast('Đã tạo chương trình mới.', 'success');
    navigate(`/chuong-trinh/${programId}`);
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
            <Button onClick={() => setShowTemplateChoice(true)} loading={busy} className="!bg-gold-400 !text-church-950 hover:!bg-gold-500">
              ➕ Tạo chương trình mới
            </Button>
          )}
          {canPresent(myRole) && nearestUpcoming && (
            <Link to={`/trinh-chieu/${nearestUpcoming.id}`}>
              <Button variant="secondary">▶️ Trình chiếu: {nearestUpcoming.title}</Button>
            </Link>
          )}
          <Link to="/mau-slide">
            <Button variant="secondary">🎨 Mẫu slide</Button>
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
                canEditProgram(myRole) && !search ? <Button onClick={() => setShowTemplateChoice(true)}>➕ Tạo chương trình mới</Button> : undefined
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

      {/* Dialog chọn mẫu khi tạo chương trình mới */}
      <Modal open={showTemplateChoice} onClose={() => setShowTemplateChoice(false)} title="➕ Tạo chương trình mới">
        <div className="flex flex-col gap-3">
          <p className="-mt-1 text-sm text-slate-500 dark:text-slate-400">
            Chọn mẫu có sẵn để bắt đầu nhanh, hoặc tạo chương trình trống.
          </p>
          {PROGRAM_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => void createProgram(t.id)}
              disabled={busy}
              className="flex min-h-touch items-center gap-3 rounded-xl border-2 border-church-500 bg-church-50 p-4 text-left hover:bg-church-100 disabled:opacity-50 dark:border-church-600 dark:bg-church-900/30 dark:hover:bg-church-900/50"
            >
              <span className="text-3xl" aria-hidden>📄</span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold text-slate-900 dark:text-slate-100">
                  {t.name}
                </span>
                <span className="block text-sm text-slate-500 dark:text-slate-400">
                  {t.description} ({t.sections.length} mục)
                </span>
              </span>
              <span className="text-xl text-church-600 dark:text-church-300" aria-hidden>→</span>
            </button>
          ))}
          <button
            onClick={() => void createProgram(null)}
            disabled={busy}
            className="flex min-h-touch items-center gap-3 rounded-xl border border-slate-300 p-4 text-left hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            <span className="text-3xl" aria-hidden>📝</span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-bold text-slate-900 dark:text-slate-100">
                Chương trình trống
              </span>
              <span className="block text-sm text-slate-500 dark:text-slate-400">
                Tự thêm từng mục và slide theo ý bạn
              </span>
            </span>
            <span className="text-xl text-slate-400" aria-hidden>→</span>
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default Dashboard;
