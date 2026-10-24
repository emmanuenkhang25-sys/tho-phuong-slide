import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { PresentSession, Section, Slide } from '../../lib/types';
import { orderProgramSlides } from '../../lib/slideOrder';
import { SlideRenderer } from '../editor/components/SlideRenderer';
import {
  isSessionExpired,
  isValidSessionCode,
  normalizeSessionCode,
  remoteChannelName,
  REMOTE_EVENT_CMD,
  REMOTE_EVENT_STATE,
  validateRemoteState,
  type RemoteAction,
} from '../present/remoteProtocol';

// Trang remote tối ưu cho ĐIỆN THOẠI (mobile-first, nút lớn).
// GHI RÕ: cần Internet trên cả điện thoại và máy tính (kết nối qua máy chủ Supabase),
// không phải kết nối LAN trực tiếp.

type Phase = 'nhap' | 'dang-ket-noi' | 'da-ket-noi';

export function RemotePage() {
  const [searchParams] = useSearchParams();
  const [codeInput, setCodeInput] = useState(() => searchParams.get('code') ?? '');
  const [phase, setPhase] = useState<Phase>('nhap');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [session, setSession] = useState<PresentSession | null>(null);
  const [programTitle, setProgramTitle] = useState('');
  const [slides, setSlides] = useState<Slide[]>([]);
  const [index, setIndex] = useState(0);
  const [liveState, setLiveState] = useState<'live' | 'paused' | 'blank'>('live');

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const sessionRef = useRef<PresentSession | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const disconnect = useCallback((msg?: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    sessionRef.current = null;
    setSession(null);
    setSlides([]);
    setPhase('nhap');
    setLiveState('live');
    setIndex(0);
    if (msg) setNotice(msg);
  }, []);

  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  const sendCmd = useCallback((action: RemoteAction, slideIndex?: number) => {
    const ch = channelRef.current;
    if (!ch) return;
    const payload: { action: RemoteAction; slideIndex?: number } =
      slideIndex === undefined ? { action } : { action, slideIndex };
    ch.send({ type: 'broadcast', event: REMOTE_EVENT_CMD, payload }).catch(() => {});
  }, []);

  const connect = useCallback(async () => {
    const code = normalizeSessionCode(codeInput);
    setError(null);
    setNotice(null);
    if (!isValidSessionCode(code)) {
      setError('Mã phải gồm đúng 6 ký tự (chữ hoa và số).');
      return;
    }
    setPhase('dang-ket-noi');
    try {
      // RLS tự chặn nếu không đủ quyền → data = null
      const { data: sess, error: sessErr } = await supabase
        .from('present_sessions')
        .select('*')
        .eq('code', code)
        .maybeSingle();
      if (sessErr) throw sessErr;
      if (!sess) {
        throw new Error('Mã không đúng, đã hết hạn, hoặc bạn không có quyền trình chiếu hội thánh này.');
      }
      const s = sess as PresentSession;
      if (s.state === 'ended') throw new Error('Phiên này đã kết thúc. Hãy tạo mã ghép nối mới trên máy tính.');
      if (isSessionExpired(s.expires_at)) throw new Error('Mã đã hết hạn (quá 24 giờ). Hãy tạo mã mới trên máy tính.');

      const { data: prog } = await supabase
        .from('programs')
        .select('title')
        .eq('id', s.program_id)
        .single();
      const { data: sectionRows } = await supabase
        .from('sections')
        .select('*')
        .eq('program_id', s.program_id)
        .order('order_index', { ascending: true });
      const { data: slideRows } = await supabase
        .from('slides')
        .select('*')
        .eq('program_id', s.program_id)
        .order('order_index', { ascending: true });

      // Danh sách slide của remote PHẢI cùng thứ tự với máy chiếu (lib/slideOrder),
      // nếu không chỉ số slide điều khiển sẽ lệch.
      const ordered = orderProgramSlides(
        (sectionRows ?? []) as Section[],
        ((slideRows ?? []) as Slide[]).filter(Boolean),
      );
      setSession(s);
      setProgramTitle((prog as { title?: string } | null)?.title ?? 'Chương trình');
      setSlides(ordered);
      setIndex(Math.max(0, Math.min(s.current_slide, Math.max(0, ordered.length - 1))));
      setLiveState(s.state as 'live' | 'paused' | 'blank');

      const ch = supabase.channel(remoteChannelName(s.code));
      ch.on('broadcast', { event: REMOTE_EVENT_STATE }, ({ payload }: { payload: unknown }) => {
        if (!validateRemoteState(payload)) return;
        if (payload.state === 'ended') {
          disconnect('Phiên trình chiếu đã kết thúc từ máy tính.');
          return;
        }
        setIndex(payload.current_slide);
        setLiveState(payload.state);
      });
      ch.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          setPhase('da-ket-noi');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setError('Không kết nối được kênh điều khiển. Kiểm tra Internet rồi thử lại.');
          setPhase('nhap');
        }
      });
      channelRef.current = ch;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không kết nối được.');
      setPhase('nhap');
    }
  }, [codeInput, disconnect]);

  const goNext = () => {
    setIndex((i) => {
      const n = Math.min(i + 1, slides.length - 1);
      sendCmd('next');
      return n;
    });
  };
  const goPrev = () => {
    setIndex((i) => {
      const n = Math.max(i - 1, 0);
      sendCmd('prev');
      return n;
    });
  };
  const goTo = (i: number) => {
    setIndex(i);
    sendCmd('goto', i);
  };
  const togglePause = () => {
    const willPause = liveState !== 'paused';
    sendCmd(willPause ? 'pause' : 'resume');
    setLiveState(willPause ? 'paused' : 'live');
  };
  const toggleBlank = () => {
    const willBlank = liveState !== 'blank';
    sendCmd(willBlank ? 'blank' : 'unblank');
    setLiveState(willBlank ? 'blank' : liveState === 'blank' ? 'live' : liveState);
  };

  const slideCount = slides.length;

  // ---------- màn hình nhập mã ----------
  if (phase !== 'da-ket-noi') {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col">
        <Link to="/bat-dau" className="text-slate-400 text-sm">
          ← Về trang tổng quan
        </Link>
        <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto">
          <h1 className="text-2xl font-bold text-center">📱 Điều khiển trình chiếu</h1>
          <p className="text-slate-400 text-sm text-center mt-2">
            Nhập mã 6 ký tự hiển thị trên màn hình máy tính đang chiếu.
          </p>
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(normalizeSessionCode(e.target.value))}
            placeholder="VD: A3K9QZ"
            maxLength={6}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            className="mt-6 w-full text-center text-3xl font-mono font-bold tracking-[0.3em] uppercase bg-slate-900 border border-slate-700 rounded-xl py-4 px-3 placeholder:text-slate-600"
          />
          <button
            onClick={connect}
            disabled={phase === 'dang-ket-noi'}
            className="mt-4 w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-lg font-bold min-h-[56px] disabled:opacity-50"
          >
            {phase === 'dang-ket-noi' ? 'Đang kết nối…' : 'Kết nối'}
          </button>
          {error && (
            <p className="mt-3 text-sm text-red-400 text-center">{error}</p>
          )}
          {notice && (
            <p className="mt-3 text-sm text-amber-300 text-center">{notice}</p>
          )}
          <p className="mt-6 text-xs text-slate-500 text-center leading-relaxed">
            Cần Internet trên cả điện thoại và máy tính (kết nối qua máy chủ).
            <br />
            Bạn phải đăng nhập bằng tài khoản có quyền trình chiếu hội thánh đó.
          </p>
        </div>
      </div>
    );
  }

  // ---------- màn hình điều khiển ----------
  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 flex flex-col">
      <div className="text-center">
        <p className="text-sm text-slate-400 truncate">{programTitle}</p>
        <p className="text-lg font-bold tabular-nums">
          Slide {slideCount === 0 ? 0 : index + 1} / {slideCount}
        </p>
        <div className="mt-1 h-6">
          {liveState === 'paused' && (
            <span className="inline-block px-3 py-0.5 rounded-full bg-amber-500 text-black text-xs font-bold">
              TẠM DỪNG
            </span>
          )}
          {liveState === 'blank' && (
            <span className="inline-block px-3 py-0.5 rounded-full bg-slate-200 text-black text-xs font-bold">
              MÀN HÌNH ĐEN
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-2">
        <button
          onClick={goPrev}
          disabled={index <= 0}
          className="py-6 rounded-2xl bg-slate-800 active:bg-slate-700 text-2xl font-bold min-h-[72px] disabled:opacity-40"
        >
          ◀ Trước
        </button>
        <button
          onClick={goNext}
          disabled={index >= slideCount - 1}
          className="py-6 rounded-2xl bg-blue-600 active:bg-blue-500 text-2xl font-bold min-h-[72px] disabled:opacity-40"
        >
          Tiếp ▶
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <button
          onClick={togglePause}
          className={`py-4 rounded-2xl font-bold min-h-[60px] ${
            liveState === 'paused' ? 'bg-amber-500 text-black' : 'bg-slate-800 active:bg-slate-700'
          }`}
        >
          {liveState === 'paused' ? '▶ Tiếp tục' : '⏸ Tạm dừng'}
        </button>
        <button
          onClick={toggleBlank}
          className={`py-4 rounded-2xl font-bold min-h-[60px] ${
            liveState === 'blank' ? 'bg-slate-200 text-black' : 'bg-slate-800 active:bg-slate-700'
          }`}
        >
          {liveState === 'blank' ? '💡 Bỏ màn hình đen' : '⬛ Màn hình đen'}
        </button>
      </div>

      <p className="mt-4 mb-2 text-sm text-slate-400 font-semibold">Chọn slide:</p>
      <div className="grid grid-cols-2 gap-2 overflow-y-auto pb-2">
        {slides.map((s, i) => (
          <button
            key={s.id}
            onClick={() => goTo(i)}
            className={`rounded-lg overflow-hidden border-2 relative ${
              i === index ? 'border-blue-400' : 'border-transparent opacity-80'
            }`}
          >
            <SlideRenderer slide={s} width={160} />
            <span className="absolute bottom-1 right-1 text-[11px] font-bold bg-black/70 rounded px-1.5 py-0.5 tabular-nums">
              {i + 1}
            </span>
          </button>
        ))}
      </div>

      <button
        onClick={() => {
          sendCmd('end');
          disconnect('Đã ngắt kết nối.');
        }}
        className="mt-3 w-full py-3 rounded-xl bg-red-800 active:bg-red-700 font-bold min-h-[52px]"
      >
        ⏏ Ngắt kết nối
      </button>
      <p className="mt-2 text-[11px] text-slate-500 text-center">
        Cần Internet trên cả điện thoại và máy tính (kết nối qua máy chủ).
      </p>
    </div>
  );
}
