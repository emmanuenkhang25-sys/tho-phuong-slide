// ============================================================================
// Thờ Phượng Slide — giao diện đơn giản (mobile-first, nền tối)
// SimpleProgramList — danh sách chương trình: một cột, chữ to, nút lớn.
// (Màn hình phụ — màn hình chính sau đăng nhập là /bat-dau → chương trình.)
// ============================================================================
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../stores/auth';
import { ensureChurchLoaded, useChurch } from '../../stores/church';
import { useToast } from '../../components/ui';
import { Modal } from '../../components/ui';
import { PROGRAM_TEMPLATES } from '../templates/programTemplates';
import { cloneSimpleProgram, createSimpleProgram } from './programApi';
import { isLibraryProgram } from './library';
import { formatDate } from '../../lib/format';

interface ProgramRow {
  id: string;
  church_id: string;
  title: string;
  event_date: string | null;
  updated_at: string;
}

export function SimpleProgramList() {
  const { user } = useAuth();
  const { currentChurch, loading: churchLoading } = useChurch();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showChoice, setShowChoice] = useState(false);

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
      const { data } = await supabase
        .from('programs')
        .select('id,church_id,title,event_date,updated_at,design_template')
        .eq('church_id', currentChurch.id)
        .neq('status', 'deleted')
        .order('updated_at', { ascending: false })
        .limit(100);
      // Giấu chương trình Thư viện khỏi danh sách chương trình.
      setPrograms(
        ((data ?? []) as (ProgramRow & { design_template?: unknown })[]).filter(
          (p) => !isLibraryProgram(p),
        ),
      );
      setLoading(false);
    };
    void load();
  }, [churchLoading, currentChurch?.id]);

  const doCreate = async (templateId: string | null) => {
    if (!currentChurch || !user) return;
    setBusy(true);
    try {
      const id = await createSimpleProgram(supabase, {
        churchId: currentChurch.id,
        userId: user.id,
        templateId,
      });
      setShowChoice(false);
      toast('Đã tạo chương trình mới.', 'success');
      navigate(`/p/${id}`);
    } catch (e) {
      toast(`Tạo chương trình lỗi: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const doClone = async (p: ProgramRow) => {
    if (!user) return;
    if (!window.confirm(`Sao chép toàn bộ chương trình “${p.title}”?`)) return;
    setBusy(true);
    try {
      const id = await cloneSimpleProgram(supabase, p, user.id);
      const { data } = await supabase
        .from('programs')
        .select('id,church_id,title,event_date,updated_at')
        .eq('id', id)
        .single();
      if (data) setPrograms((xs) => [data as ProgramRow, ...xs]);
      toast('Đã sao chép chương trình.', 'success');
    } catch (e) {
      toast(`Sao chép lỗi: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col bg-[#0e0f11] px-4 pb-10 pt-3 text-slate-100">
      <div className="mb-1 flex items-center gap-2">
        <button
          onClick={() => navigate('/bat-dau')}
          aria-label="Về chương trình hiện tại"
          className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-[#1b1e22] text-xl text-slate-200"
        >
          ←
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold text-white">Chương trình thờ phượng</h1>
          {currentChurch && (
            <p className="truncate text-sm text-slate-400">{currentChurch.name}</p>
          )}
        </div>
        {currentChurch && (
          <button
            onClick={() => setShowChoice(true)}
            disabled={busy}
            className="flex min-h-[48px] shrink-0 items-center gap-1 rounded-full bg-[#1b6fe0] px-4 text-base font-bold text-white disabled:opacity-50"
          >
            ➕ Mới
          </button>
        )}
      </div>

      {churchLoading || loading ? (
        <p className="py-10 text-center text-slate-400">Đang tải…</p>
      ) : !currentChurch ? (
        <div className="mt-10 rounded-2xl bg-[#16181c] p-6 text-center">
          <p className="mb-2 text-4xl">⛪</p>
          <p className="mb-4 font-medium text-slate-300">Bạn chưa thuộc hội thánh nào.</p>
          <Link
            to="/hoi-thanh"
            className="inline-flex min-h-[52px] items-center rounded-2xl bg-[#1b6fe0] px-6 font-bold text-white"
          >
            Tạo / tham gia hội thánh
          </Link>
        </div>
      ) : programs.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-[#16181c] p-6 text-center">
          <p className="mb-2 text-4xl">📝</p>
          <p className="mb-4 font-medium text-slate-300">Chưa có chương trình nào.</p>
          <button
            onClick={() => setShowChoice(true)}
            disabled={busy}
            className="inline-flex min-h-[52px] items-center rounded-2xl bg-[#1b6fe0] px-6 font-bold text-white disabled:opacity-50"
          >
            ➕ Tạo chương trình đầu tiên
          </button>
        </div>
      ) : (
        <ul className="mt-2 flex flex-col gap-2.5">
          {programs.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-2 rounded-2xl border border-white/5 bg-[#16181c] p-3"
            >
              <button
                onClick={() => navigate(`/p/${p.id}`)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left"
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2b2f34] text-xl"
                  aria-hidden
                >
                  📋
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-bold text-white">{p.title}</span>
                  <span className="block text-sm text-slate-400">
                    {p.event_date ? formatDate(p.event_date) : 'Chưa đặt ngày'}
                  </span>
                </span>
                <span className="text-xl text-slate-500" aria-hidden>
                  ›
                </span>
              </button>
              <button
                onClick={() => void doClone(p)}
                disabled={busy}
                title="Sao chép chương trình"
                aria-label={`Sao chép ${p.title}`}
                className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl border border-white/10 text-lg text-slate-300 disabled:opacity-50"
              >
                ⧉
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Chọn mẫu khi tạo mới */}
      <Modal open={showChoice} onClose={() => setShowChoice(false)} title="➕ Chương trình mới">
        <div className="flex flex-col gap-3">
          {PROGRAM_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => void doCreate(t.id)}
              disabled={busy}
              className="flex min-h-[64px] items-center gap-3 rounded-2xl border-2 border-[#1b6fe0] bg-[#1b6fe0]/10 p-4 text-left disabled:opacity-50"
            >
              <span className="text-3xl" aria-hidden>
                📄
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold text-white">{t.name}</span>
                <span className="block text-sm text-slate-400">{t.description}</span>
              </span>
              <span className="text-xl text-[#5b9bf5]" aria-hidden>
                →
              </span>
            </button>
          ))}
          <button
            onClick={() => void doCreate(null)}
            disabled={busy}
            className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-white/10 p-4 text-left disabled:opacity-50"
          >
            <span className="text-3xl" aria-hidden>
              📝
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-bold text-white">Chương trình trống</span>
              <span className="block text-sm text-slate-400">Tự thêm từng mục theo ý bạn</span>
            </span>
            <span className="text-xl text-slate-500" aria-hidden>
              →
            </span>
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default SimpleProgramList;
