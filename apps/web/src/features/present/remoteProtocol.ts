// Giao thức điều khiển từ xa — triển khai THẬT qua Supabase Realtime (CONTRACT mục 9).
// PC (PresenterPage) tạo present_sessions + subscribe channel `present:<code>`.
// Điện thoại (RemotePage) nhập mã, join channel, gửi broadcast {event:'cmd'}.
// PC áp dụng lệnh + broadcast {event:'state'} để đồng bộ.
//
// File này là logic thuần (không import Supabase) để dễ kiểm thử độc lập.

export const SESSION_CODE_LENGTH = 6;
// Theo CONTRACT 3.11: mã ghép nối 6 ký tự [A-Z0-9]
export const SESSION_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const REMOTE_CHANNEL_PREFIX = 'present:';
export const REMOTE_EVENT_CMD = 'cmd';
export const REMOTE_EVENT_STATE = 'state';

export type RemoteAction =
  | 'next'
  | 'prev'
  | 'goto'
  | 'pause'
  | 'resume'
  | 'blank'
  | 'unblank'
  | 'end';

export interface RemoteCommandPayload {
  action: RemoteAction;
  /** chỉ dùng khi action === 'goto' */
  slideIndex?: number;
}

export type PresentSessionState = 'live' | 'paused' | 'blank' | 'ended';

export interface RemoteStatePayload {
  current_slide: number;
  state: PresentSessionState;
}

const REMOTE_ACTIONS: RemoteAction[] = [
  'next',
  'prev',
  'goto',
  'pause',
  'resume',
  'blank',
  'unblank',
  'end',
];

const SESSION_STATES: PresentSessionState[] = ['live', 'paused', 'blank', 'ended'];

/** Tạo mã ghép nối 6 ký tự ngẫu nhiên (crypto an toàn). */
export function generateSessionCode(): string {
  const buf = new Uint32Array(SESSION_CODE_LENGTH);
  crypto.getRandomValues(buf);
  let code = '';
  for (let i = 0; i < SESSION_CODE_LENGTH; i++) {
    code += SESSION_CODE_ALPHABET[buf[i] % SESSION_CODE_ALPHABET.length];
  }
  return code;
}

/** Chuẩn hoá mã người dùng nhập: viết hoa, bỏ ký tự lạ, tối đa 6 ký tự. */
export function normalizeSessionCode(raw: string): string {
  return (raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, SESSION_CODE_LENGTH);
}

export function isValidSessionCode(code: string): boolean {
  return new RegExp(`^[A-Z0-9]{${SESSION_CODE_LENGTH}}$`).test(code);
}

/** Kiểm tra payload broadcast 'cmd' từ điện thoại có hợp lệ không (chống dữ liệu rác). */
export function validateRemoteCommand(payload: unknown): payload is RemoteCommandPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  if (typeof p.action !== 'string' || !REMOTE_ACTIONS.includes(p.action as RemoteAction)) {
    return false;
  }
  if (p.action === 'goto') {
    return (
      typeof p.slideIndex === 'number' &&
      Number.isInteger(p.slideIndex) &&
      p.slideIndex >= 0
    );
  }
  return true;
}

/** Kiểm tra payload broadcast 'state' từ PC có hợp lệ không. */
export function validateRemoteState(payload: unknown): payload is RemoteStatePayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.current_slide === 'number' &&
    Number.isInteger(p.current_slide) &&
    p.current_slide >= 0 &&
    typeof p.state === 'string' &&
    SESSION_STATES.includes(p.state as PresentSessionState)
  );
}

/** Session hết hạn khi now > expires_at. */
export function isSessionExpired(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!expiresAt) return true;
  const t = new Date(expiresAt).getTime();
  return Number.isNaN(t) || t <= now.getTime();
}

export function remoteChannelName(code: string): string {
  return `${REMOTE_CHANNEL_PREFIX}${code}`;
}
