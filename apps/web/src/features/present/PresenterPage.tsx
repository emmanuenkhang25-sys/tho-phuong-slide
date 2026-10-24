import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { supabase } from '../../lib/supabase';
import type { PresentSession, Program, Slide } from '../../lib/types';
import { roleRank } from '../../lib/permissions';
import { useAuth } from '../../stores/auth';
import { SlideRenderer } from '../editor/components/SlideRenderer';
import {
  generateSessionCode,
  isSessionExpired,
  remoteChannelName,
  REMOTE_EVENT_CMD,
  REMOTE_EVENT_STATE,
  validateRemoteCommand,
  type PresentSessionState,
  type RemoteAction,
} from './remoteProtocol';

// GHI CHÚ QUAN TRỌNG (theo brief):
// Bản web chạy 1 màn hình: màn hình điều khiển và màn hình khán giả là MỘT.
// Muốn tách 2 màn hình (máy tính điều khiển + máy chiếu cho khán giả),
// dùng chế độ Extend của hệ điều hành rồi mở 2 cửa sổ trình duyệt:
// một cửa sổ /trinh-chieu/:id để chiếu, một cửa sổ để điều khiển.
// Filmstrip chọn slide và thanh điều khiển chỉ hiện trên màn hình điều khiển.

const CONTROLS_HIDE_MS = 3000;
const DB_PUSH_THROTTLE_MS = 1000;

function formatElapsed(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function PresenterPage() {
  const { id: programId } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [denyReason, setDenyReason] = useState<string | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);

  const [presenting, setPresenting] = useState(false);
  const [index, setIndex] = useState(0);
  const [blank, setBlank] = useState(false);
  const [paused, setPaused] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  const [session, setSession] = useState<PresentSession | null>(null);
  const [showPairPanel, setShowPairPanel] = useState(false);
  const [pairBusy, setPairBusy] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const [now, setNow] = useState(() => new Date());
  const [elapsedSec, setElapsedSec] = useState(0);
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 720,
  }));

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const sessionRef = useRef<PresentSession | null>(null);
  const indexRef = useRef(0);
  const pausedRef = useRef(false);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDbPushRef = useRef(0);
  const pendingDbPushRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slideCount = slides.length;

  // ---------- tải program + slides + kiểm tra quyền presenter+ ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!programId || !user) {
        if (!cancelled) {
          setDenyReason('Thiếu thông tin chương trình hoặc chưa đăng nhập.');
          setLoading(false);
        }
        return;
      }
      try {
        const { data: prog, error: progErr } = await supabase
          .from('programs')
          .select('*')
          .eq('id', programId)
          .single();
        if (progErr || !prog) {
          throw new Error('Không tìm thấy chương trình (có thể bạn không phải thành viên hội thánh này).');
        }
        const p = prog as Program;
        const { data: member, error: memErr } = await supabase
          .from('church_members')
          .select('role')
          .eq('church_id', p.church_id)
          .eq('user_id', user.id)
          .maybeSingle();
        if (memErr) throw memErr;
        if (!member) {
          throw new Error('Bạn không phải thành viên của hội thánh sở hữu chương trình này.');
        }
        if (roleRank(member.role as string) < 2) {
          throw new Error(
            'Tài khoản của bạn không có quyền trình chiếu hội thánh này (cần vai trò Người trình chiếu trở lên).',
          );
        }
        const { data: slideRows, error: slideErr } = await supabase
          .from('slides')
          .select('*')
          .eq('program_id', programId)
          .order('order_index', { ascending: true });
        if (slideErr) throw slideErr;
        if (!cancelled) {
          setProgram(p);
          setSlides((slideRows ?? []) as Slide[]);
          setMyRole(member.role as string);
        }
      } catch (e) {
        if (!cancelled) setDenyReason(e instanceof Error ? e.message : 'Không tải được dữ liệu.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [programId, user]);

  // ---------- mirrors cho handler realtime ----------
  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // ---------- đồng hồ + bộ đếm thời gian ----------
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!presenting) return;
    const t = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [presenting]);
  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ---------- đẩy state: broadcast ngay + ghi DB throttle ~1s ----------
  const pushState = useCallback((idx: number, blanked: boolean, pausedNow: boolean) => {
    const state: PresentSessionState = pausedNow ? 'paused' : blanked ? 'blank' : 'live';
    const payload = { current_slide: idx, state };
    const ch = channelRef.current;
    if (ch) {
      ch.send({ type: 'broadcast', event: REMOTE_EVENT_STATE, payload }).catch(() => {});
    }
    const sess = sessionRef.current;
    if (!sess) return;
    const write = () => {
      lastDbPushRef.current = Date.now();
      supabase
        .from('present_sessions')
        .update({ current_slide: idx, state })
        .eq('id', sess.id)
        .then(() => {});
    };
    const elapsed = Date.now() - lastDbPushRef.current;
    if (elapsed >= DB_PUSH_THROTTLE_MS) {
      write();
    } else {
      if (pendingDbPushRef.current) clearTimeout(pendingDbPushRef.current);
      pendingDbPushRef.current = setTimeout(write, DB_PUSH_THROTTLE_MS - elapsed);
    }
  }, []);

  useEffect(() => {
    if (presenting && session) pushState(index, blank, paused);
  }, [presenting, session, index, blank, paused, pushState]);

  // ---------- điều hướng slide ----------
  const goTo = useCallback(
    (i: number) => {
      if (slideCount === 0) return;
      const clamped = Math.max(0, Math.min(i, slideCount - 1));
      setBlank(false);
      setIndex(clamped);
    },
    [slideCount],
  );
  const goNext = useCallback(() => goTo(indexRef.current + 1), [goTo]);
  const goPrev = useCallback(() => goTo(indexRef.current - 1), [goTo]);
  const toggleBlank = useCallback(() => setBlank((b) => !b), []);
  const togglePause = useCallback(() => setPaused((p) => !p), []);

  const applyRemoteAction = useCallback(
    (action: RemoteAction, slideIndex?: number) => {
      switch (action) {
        case 'next':
          goNext();
          break;
        case 'prev':
          goPrev();
          break;
        case 'goto':
          if (typeof slideIndex === 'number') goTo(slideIndex);
          break;
        case 'pause':
          setPaused(true);
          break;
        case 'resume':
          setPaused(false);
          break;
        case 'blank':
          setBlank(true);
          break;
        case 'unblank':
          setBlank(false);
          break;
        case 'end':
          void endSession();
          break;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [goNext, goPrev, goTo],
  );

  // ---------- channel realtime ----------
  const joinChannel = useCallback(
    (code: string) => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      const ch = supabase.channel(remoteChannelName(code));
      ch.on('broadcast', { event: REMOTE_EVENT_CMD }, ({ payload }: { payload: unknown }) => {
        if (!validateRemoteCommand(payload)) return;
        // Khi tạm dừng: dừng nhận lệnh remote, chỉ nhận 'resume' và 'end'
        if (pausedRef.current && payload.action !== 'resume' && payload.action !== 'end') return;
        applyRemoteAction(payload.action, payload.slideIndex);
      });
      ch.subscribe();
      channelRef.current = ch;
    },
    [applyRemoteAction],
  );

  // ---------- tạo / kết thúc session ----------
  const createSession = useCallback(async () => {
    if (!program || !user) return;
    if (roleRank(myRole) < 2) {
      setPairError('Bạn không có quyền tạo phiên điều khiển từ xa (cần vai trò Người trình chiếu trở lên).');
      return;
    }
    setPairBusy(true);
    setPairError(null);
    try {
      const code = generateSessionCode();
      const { data, error } = await supabase
        .from('present_sessions')
        .insert({
          program_id: program.id,
          church_id: program.church_id,
          code,
          created_by: user.id,
        })
        .select()
        .single();
      if (error || !data) throw error ?? new Error('Không tạo được phiên.');
      const sess = data as PresentSession;
      setSession(sess);
      setShowPairPanel(true);
      joinChannel(sess.code);
      // đẩy state hiện tại ngay cho thiết bị vào sau đồng bộ
      pushState(indexRef.current, false, false);
    } catch (e) {
      setPairError(e instanceof Error ? e.message : 'Không tạo được phiên điều khiển từ xa.');
    } finally {
      setPairBusy(false);
    }
  }, [program, user, myRole, joinChannel, pushState]);

  const endSession = useCallback(async () => {
    const sess = sessionRef.current;
    if (sess) {
      await supabase.from('present_sessions').update({ state: 'ended' }).eq('id', sess.id);
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (pendingDbPushRef.current) {
      clearTimeout(pendingDbPushRef.current);
      pendingDbPushRef.current = null;
    }
    sessionRef.current = null;
    setSession(null);
    setShowPairPanel(false);
    setConfirmEnd(false);
  }, []);

  // tự đóng session khi hết hạn
  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => {
      if (isSessionExpired(session.expires_at)) {
        void endSession();
      }
    }, 30000);
    return () => clearInterval(t);
  }, [session, endSession]);

  // dọn channel khi unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (pendingDbPushRef.current) clearTimeout(pendingDbPushRef.current);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, []);

  // ---------- fullscreen ----------
  const startPresenting = useCallback(async () => {
    setElapsedSec(0);
    setPresenting(true);
    setControlsVisible(true);
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Không vào được fullscreen (trình duyệt chặn) vẫn chiếu trong cửa sổ
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setPresenting(false);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ---------- phím tắt ----------
  useEffect(() => {
    if (!presenting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'b' || e.key === 'B') {
        toggleBlank();
      } else if (e.key === 'p' || e.key === 'P') {
        togglePause();
      } else if (e.key === 'Home') {
        goTo(0);
      } else if (e.key === 'End') {
        goTo(slideCount - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [presenting, goNext, goPrev, goTo, toggleBlank, togglePause, slideCount]);

  // ---------- tự ẩn thanh điều khiển sau 3s ----------
  const pokeControls = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS);
  }, []);
  useEffect(() => {
    if (presenting) pokeControls();
  }, [presenting, pokeControls]);

  // ---------- kích thước slide giữ đúng tỉ lệ ----------
  const aspect = program?.aspect_ratio === '4:3' ? 4 / 3 : 16 / 9;
  const scale = Math.min(viewport.w / 960, viewport.h / (960 / aspect));
  const slideW = Math.max(160, Math.floor(960 * scale));
  const slideH = Math.max(90, Math.floor((960 / aspect) * scale));

  const pairUrl = session
    ? `${window.location.origin}/dieu-khien?code=${session.code}`
    : '';

  // ================= render =================
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <p>Đang tải chương trình…</p>
      </div>
    );
  }

  if (denyReason) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow p-6 text-center">
          <h1 className="text-xl font-bold mb-2">Không thể trình chiếu</h1>
          <p className="text-slate-600 mb-4">{denyReason}</p>
          <Link to="/bat-dau" className="inline-block px-4 py-2 rounded-lg bg-blue-600 text-white">
            Về trang tổng quan
          </Link>
        </div>
      </div>
    );
  }

  if (slideCount === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow p-6 text-center">
          <h1 className="text-xl font-bold mb-2">{program?.title}</h1>
          <p className="text-slate-600 mb-4">Chương trình chưa có slide nào để trình chiếu.</p>
          <Link to="/bat-dau" className="inline-block px-4 py-2 rounded-lg bg-blue-600 text-white">
            Về trang tổng quan
          </Link>
        </div>
      </div>
    );
  }

  // ---------- màn hình chuẩn bị ----------
  if (!presenting) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        <div className="max-w-2xl mx-auto">
          <Link to="/bat-dau" className="text-slate-400 hover:text-white text-sm">
            ← Về trang tổng quan
          </Link>
          <h1 className="text-2xl font-bold mt-4">{program?.title}</h1>
          <p className="text-slate-400 mt-1">
            {slideCount} slide • Tỉ lệ {program?.aspect_ratio ?? '16:9'} • Vai trò của bạn: {myRole}
          </p>

          <div className="mt-6 grid gap-3">
            <button
              onClick={startPresenting}
              className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-lg font-bold"
            >
              ▶ Bắt đầu trình chiếu
            </button>
            {!session ? (
              <button
                onClick={createSession}
                disabled={pairBusy}
                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 font-semibold disabled:opacity-50"
              >
                {pairBusy ? 'Đang tạo mã…' : '📱 Điều khiển bằng điện thoại'}
              </button>
            ) : (
              <button
                onClick={() => setShowPairPanel(true)}
                className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 font-semibold"
              >
                📱 Đang ghép nối — xem mã {session.code}
              </button>
            )}
          </div>

          {pairError && (
            <p className="mt-3 text-sm text-red-400">{pairError}</p>
          )}

          <div className="mt-6 text-sm text-slate-400 bg-slate-900 rounded-xl p-4 leading-relaxed">
            <p className="font-semibold text-slate-200 mb-1">Lưu ý</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Phím tắt khi chiếu: ←/→ hoặc Space chuyển slide, B = màn hình đen, P = tạm dừng, Esc = thoát.</li>
              <li>Bản web chạy 1 màn hình. Muốn tách màn hình điều khiển và màn hình khán giả: dùng chế độ Extend của hệ điều hành rồi mở 2 cửa sổ trình duyệt.</li>
              <li>Điều khiển từ xa cần Internet trên cả máy tính và điện thoại (kết nối qua máy chủ).</li>
            </ul>
          </div>
        </div>

        {showPairPanel && session && (
          <PairPanel
            session={session}
            pairUrl={pairUrl}
            onClose={() => setShowPairPanel(false)}
            onEnd={() => setConfirmEnd(true)}
          />
        )}
        {confirmEnd && (
          <ConfirmEndDialog
            onCancel={() => setConfirmEnd(false)}
            onConfirm={() => void endSession()}
          />
        )}
      </div>
    );
  }

  // ---------- màn hình trình chiếu ----------
  const slide = slides[index];
  return (
    <div
      className={`fixed inset-0 bg-black text-white select-none ${controlsVisible ? '' : 'cursor-none'}`}
      onMouseMove={pokeControls}
      onTouchStart={pokeControls}
    >
      <style>{`@keyframes tpsFade { from { opacity: 0; } to { opacity: 1; } }`}</style>

      {/* slide — KHÔNG hiển thị UI quản trị trên slide */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          key={slide.id}
          style={{ width: slideW, height: slideH, animation: 'tpsFade .18s ease' }}
          className="overflow-hidden"
        >
          <SlideRenderer slide={slide} width={slideW} />
        </div>
      </div>

      {/* màn hình đen */}
      {blank && <div className="absolute inset-0 bg-black z-20" />}

      {/* badge tạm dừng — chỉ ở góc màn hình điều khiển */}
      {paused && !blank && (
        <div className="absolute top-4 right-4 z-30 px-3 py-1 rounded-full bg-amber-500 text-black text-sm font-bold">
          TẠM DỪNG
        </div>
      )}

      {/* thanh điều khiển tự ẩn */}
      <div
        className={`absolute inset-x-0 bottom-0 z-30 transition-opacity duration-300 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-gradient-to-t from-black/90 to-transparent px-4 pt-8 pb-3">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-semibold tabular-nums">
              {index + 1} / {slideCount}
            </span>
            <span className="tabular-nums text-slate-300">
              🕒 {now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              {'  •  '}⏱ {formatElapsed(elapsedSec)}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={goPrev} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 font-bold min-h-[44px]">
              ◀ Trước
            </button>
            <button onClick={goNext} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 font-bold min-h-[44px]">
              Tiếp ▶
            </button>
            <button
              onClick={toggleBlank}
              className={`px-4 py-2 rounded-lg font-bold min-h-[44px] ${blank ? 'bg-yellow-500 text-black' : 'bg-white/10 hover:bg-white/20'}`}
              title="Phím B"
            >
              Màn hình đen
            </button>
            <button
              onClick={togglePause}
              className={`px-4 py-2 rounded-lg font-bold min-h-[44px] ${paused ? 'bg-amber-500 text-black' : 'bg-white/10 hover:bg-white/20'}`}
              title="Phím P"
            >
              {paused ? 'Tiếp tục' : 'Tạm dừng'}
            </button>
            {!session ? (
              <button
                onClick={createSession}
                disabled={pairBusy}
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 font-bold min-h-[44px] disabled:opacity-50"
              >
                📱 Ghép nối điện thoại
              </button>
            ) : (
              <button
                onClick={() => setShowPairPanel(true)}
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 font-bold min-h-[44px]"
              >
                📱 Mã {session.code}
              </button>
            )}
            <button
              onClick={() => {
                if (document.fullscreenElement) void document.exitFullscreen();
                else setPresenting(false);
              }}
              className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 font-bold min-h-[44px] ml-auto"
              title="Phím Esc"
            >
              ⏹ Kết thúc
            </button>
          </div>

          {/* filmstrip chọn slide — chỉ ở màn hình điều khiển */}
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => goTo(i)}
                className={`shrink-0 rounded overflow-hidden border-2 ${
                  i === index ? 'border-blue-400' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
                title={`Slide ${i + 1}`}
              >
                <SlideRenderer slide={s} width={96} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {showPairPanel && session && (
        <PairPanel
          session={session}
          pairUrl={pairUrl}
          onClose={() => setShowPairPanel(false)}
          onEnd={() => setConfirmEnd(true)}
        />
      )}
      {confirmEnd && (
        <ConfirmEndDialog
          onCancel={() => setConfirmEnd(false)}
          onConfirm={() => void endSession()}
        />
      )}
    </div>
  );
}

function PairPanel({
  session,
  pairUrl,
  onClose,
  onEnd,
}: {
  session: PresentSession;
  pairUrl: string;
  onClose: () => void;
  onEnd: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white text-slate-900 rounded-2xl p-6 max-w-sm w-full text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-1">Điều khiển bằng điện thoại</h2>
        <p className="text-sm text-slate-500 mb-4">
          Điện thoại đăng nhập cùng tài khoản (hoặc tài khoản thành viên có quyền trình chiếu),
          mở <span className="font-mono">/dieu-khien</span>, nhập mã:
        </p>
        <div className="text-5xl font-mono font-bold tracking-[0.3em] mb-4">{session.code}</div>
        <div className="flex justify-center mb-4 bg-white p-2">
          <QRCode value={pairUrl} size={200} />
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Hoặc quét mã QR để mở thẳng trang nhập mã.
          <br />
          Cần Internet trên cả điện thoại và máy tính (kết nối qua máy chủ).
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onClose} className="py-2 rounded-lg bg-slate-200 hover:bg-slate-300 font-semibold">
            Đóng
          </button>
          <button onClick={onEnd} className="py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold">
            Kết thúc &amp; hủy ghép nối
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmEndDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white text-slate-900 rounded-2xl p-6 max-w-sm w-full">
        <h2 className="text-lg font-bold mb-2">Kết thúc ghép nối?</h2>
        <p className="text-sm text-slate-600 mb-4">
          Điện thoại sẽ bị ngắt kết nối và mã ghép nối không còn dùng được nữa.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onCancel} className="py-2 rounded-lg bg-slate-200 hover:bg-slate-300 font-semibold">
            Hủy
          </button>
          <button onClick={onConfirm} className="py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold">
            Kết thúc
          </button>
        </div>
      </div>
    </div>
  );
}
