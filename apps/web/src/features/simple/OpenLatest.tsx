// ============================================================================
// Thờ Phượng Slide — giao diện đơn giản (mobile-first, nền tối)
// OpenLatest — màn hình trung gian sau đăng nhập: mở ngay chương trình mới
// nhất để người dùng thấy luôn thứ tự chương trình. Nếu chưa có chương trình
// nào thì tự tạo một chương trình Chúa Nhật từ mẫu.
// ============================================================================
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../stores/auth';
import { ensureChurchLoaded, useChurch } from '../../stores/church';
import { useToast } from '../../components/ui';
import { createSimpleProgram } from './programApi';

/** Ngày Chúa Nhật gần nhất (kể cả hôm nay nếu hôm nay là Chúa Nhật), dạng YYYY-MM-DD. */
function nextSundayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function sundayTitle(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return `Chương trình Chúa Nhật ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function OpenLatest() {
  const { user } = useAuth();
  const { currentChurch, loading: churchLoading } = useChurch();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [noChurch, setNoChurch] = useState(false);
  const [failed, setFailed] = useState('');
  const [creating, setCreating] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    void ensureChurchLoaded();
  }, []);

  useEffect(() => {
    if (churchLoading || started.current || !user) return;
    started.current = true;
    const run = async () => {
      if (!currentChurch) {
        setNoChurch(true);
        return;
      }
      const { data, error } = await supabase
        .from('programs')
        .select('id')
        .eq('church_id', currentChurch.id)
        .neq('status', 'deleted')
        .order('updated_at', { ascending: false })
        .limit(1);
      if (error) {
        setFailed(error.message);
        return;
      }
      if (data && data.length > 0) {
        navigate(`/p/${data[0].id}`, { replace: true });
        return;
      }
      // Chưa có chương trình nào → tự tạo từ mẫu Chúa Nhật
      setCreating(true);
      try {
        const pid = await createSimpleProgram(supabase, {
          churchId: currentChurch.id,
          userId: user.id,
          templateId: 'chu-nhat',
          title: sundayTitle(),
          eventDate: nextSundayISO(),
        });
        navigate(`/p/${pid}`, { replace: true });
      } catch (e) {
        setCreating(false);
        setFailed((e as Error).message);
      }
    };
    void run();
  }, [churchLoading, currentChurch, user, navigate, toast]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center bg-[#0e0f11] px-6 text-center">
      {noChurch ? (
        <>
          <p className="mb-3 text-5xl">⛪</p>
          <h1 className="mb-2 text-xl font-bold text-white">Chào mừng đến Thờ Phượng Slide</h1>
          <p className="mb-6 text-slate-400">
            Bạn chưa thuộc hội thánh nào. Hãy tạo hội thánh để bắt đầu.
          </p>
          <Link
            to="/hoi-thanh"
            className="flex min-h-[56px] items-center rounded-2xl bg-[#1b6fe0] px-8 text-base font-bold text-white"
          >
            ＋ Tạo hội thánh
          </Link>
        </>
      ) : failed ? (
        <>
          <p className="mb-3 text-5xl">😕</p>
          <p className="mb-6 text-slate-300">Mở chương trình lỗi: {failed}</p>
          <Link
            to="/p"
            className="flex min-h-[56px] items-center rounded-2xl bg-[#1b6fe0] px-8 text-base font-bold text-white"
          >
            Mở danh sách chương trình
          </Link>
        </>
      ) : (
        <>
          <p className="mb-3 text-5xl">⛪</p>
          <p className="text-slate-400">
            {creating ? 'Đang tạo chương trình Chúa Nhật…' : 'Đang mở chương trình…'}
          </p>
        </>
      )}
    </div>
  );
}

export default OpenLatest;
