// Unit test: src/features/present/remoteProtocol.ts
// Kiểm tra: generateSessionCode (định dạng 6 ký tự [A-Z0-9], duy nhất),
// normalizeSessionCode, isValidSessionCode, validateRemoteCommand,
// validateRemoteState, remoteChannelName, isSessionExpired.
import { describe, expect, it } from 'vitest';
import {
  REMOTE_CHANNEL_PREFIX,
  generateSessionCode,
  isSessionExpired,
  isValidSessionCode,
  normalizeSessionCode,
  remoteChannelName,
  validateRemoteCommand,
  validateRemoteState,
} from './remoteProtocol';

describe('generateSessionCode', () => {
  it('đúng định dạng: 6 ký tự [A-Z0-9]', () => {
    for (let i = 0; i < 20; i++) {
      const code = generateSessionCode();
      expect(code).toMatch(/^[A-Z0-9]{6}$/);
    }
  });

  it('duy nhất: 500 mã không trùng nhau', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 500; i++) codes.add(generateSessionCode());
    expect(codes.size).toBe(500);
  });
});

describe('normalizeSessionCode', () => {
  it('viết hoa + bỏ ký tự lạ + cắt còn 6 ký tự', () => {
    expect(normalizeSessionCode('ab12-cd34')).toBe('AB12CD');
    expect(normalizeSessionCode('  x1 ')).toBe('X1');
    expect(normalizeSessionCode('')).toBe('');
  });
});

describe('isValidSessionCode', () => {
  it('mã 6 ký tự hợp lệ → true', () => {
    expect(isValidSessionCode('A1B2C3')).toBe(true);
    expect(isValidSessionCode('ZZZZZZ')).toBe(true);
  });
  it('sai độ dài / ký tự lạ → false', () => {
    expect(isValidSessionCode('ABC12')).toBe(false);
    expect(isValidSessionCode('ABC1234')).toBe(false);
    expect(isValidSessionCode('abc123')).toBe(false);
    expect(isValidSessionCode('AB@123')).toBe(false);
    expect(isValidSessionCode('')).toBe(false);
  });
});

describe('validateRemoteCommand', () => {
  it('chấp nhận mọi action hợp lệ của CONTRACT (next/prev/goto/pause/resume/blank/unblank/end)', () => {
    for (const action of ['next', 'prev', 'pause', 'resume', 'blank', 'unblank', 'end'] as const) {
      expect(validateRemoteCommand({ action })).toBe(true);
    }
  });

  it('goto hợp lệ khi có slideIndex là số nguyên >= 0', () => {
    expect(validateRemoteCommand({ action: 'goto', slideIndex: 3 })).toBe(true);
    expect(validateRemoteCommand({ action: 'goto', slideIndex: 0 })).toBe(true);
  });

  it('từ chối: goto thiếu slideIndex / slideIndex âm / không nguyên', () => {
    expect(validateRemoteCommand({ action: 'goto' })).toBe(false);
    expect(validateRemoteCommand({ action: 'goto', slideIndex: -1 })).toBe(false);
    expect(validateRemoteCommand({ action: 'goto', slideIndex: 1.5 })).toBe(false);
    expect(validateRemoteCommand({ action: 'goto', slideIndex: '2' })).toBe(false);
  });

  it('từ chối: action lạ / không phải object / null', () => {
    expect(validateRemoteCommand({ action: 'delete-all' })).toBe(false);
    expect(validateRemoteCommand({})).toBe(false);
    expect(validateRemoteCommand(null)).toBe(false);
    expect(validateRemoteCommand('next')).toBe(false);
    expect(validateRemoteCommand(undefined)).toBe(false);
  });
});

describe('validateRemoteState', () => {
  it('state hợp lệ → true', () => {
    expect(validateRemoteState({ current_slide: 0, state: 'live' })).toBe(true);
    expect(validateRemoteState({ current_slide: 12, state: 'ended' })).toBe(true);
  });

  it('từ chối: current_slide âm / không nguyên / state lạ / thiếu trường', () => {
    expect(validateRemoteState({ current_slide: -1, state: 'live' })).toBe(false);
    expect(validateRemoteState({ current_slide: 2.5, state: 'live' })).toBe(false);
    expect(validateRemoteState({ current_slide: 1, state: 'exploded' })).toBe(false);
    expect(validateRemoteState({ current_slide: 1 })).toBe(false);
    expect(validateRemoteState(null)).toBe(false);
  });
});

describe('remoteChannelName', () => {
  it('tên kênh = tiền tố + mã', () => {
    expect(remoteChannelName('A1B2C3')).toBe(`${REMOTE_CHANNEL_PREFIX}A1B2C3`);
  });
});

describe('isSessionExpired', () => {
  it('quá khứ → hết hạn; tương lai → còn hạn; null → hết hạn', () => {
    expect(isSessionExpired(new Date(Date.now() - 1000).toISOString())).toBe(true);
    expect(isSessionExpired(new Date(Date.now() + 3600_000).toISOString())).toBe(false);
    expect(isSessionExpired(null)).toBe(true);
    expect(isSessionExpired(undefined)).toBe(true);
    expect(isSessionExpired('không phải ngày')).toBe(true);
  });

  it('dùng tham số now để test biên', () => {
    const now = new Date('2026-10-24T12:00:00Z');
    expect(isSessionExpired('2026-10-24T11:59:59Z', now)).toBe(true);
    expect(isSessionExpired('2026-10-24T12:00:01Z', now)).toBe(false);
  });
});
