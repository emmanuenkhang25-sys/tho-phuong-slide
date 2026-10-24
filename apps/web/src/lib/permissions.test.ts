// Unit test: src/lib/permissions.ts (CONTRACT mục 2)
// owner=5 > admin=4 > editor=3 > presenter=2 > viewer=1 > none=0
import { describe, expect, it } from 'vitest';
import {
  canDeleteProgram,
  canEditProgram,
  canManageChurch,
  canManageMembers,
  canPresent,
  hasRole,
  isOwner,
  roleRank,
} from './permissions';

describe('roleRank', () => {
  it('xếp hạng đúng thứ bậc CONTRACT', () => {
    expect(roleRank('owner')).toBe(5);
    expect(roleRank('admin')).toBe(4);
    expect(roleRank('editor')).toBe(3);
    expect(roleRank('presenter')).toBe(2);
    expect(roleRank('viewer')).toBe(1);
  });
  it('role lạ / null / undefined → 0 (none)', () => {
    expect(roleRank('superadmin')).toBe(0);
    expect(roleRank('')).toBe(0);
    expect(roleRank(null)).toBe(0);
    expect(roleRank(undefined)).toBe(0);
  });
});

describe('hasRole', () => {
  it('đạt tối thiểu đúng biên (>= min)', () => {
    expect(hasRole('editor', 'editor')).toBe(true);
    expect(hasRole('owner', 'editor')).toBe(true);
    expect(hasRole('presenter', 'editor')).toBe(false);
    expect(hasRole(null, 'viewer')).toBe(false);
    expect(hasRole('viewer', 'viewer')).toBe(true);
    expect(hasRole('admin', 'owner')).toBe(false);
  });
});

describe('canEditProgram (editor trở lên)', () => {
  it.each(['owner', 'admin', 'editor'] as const)('%s → true', (r) => {
    expect(canEditProgram(r)).toBe(true);
  });
  it.each(['presenter', 'viewer'] as const)('%s → false', (r) => {
    expect(canEditProgram(r)).toBe(false);
  });
  it('null → false', () => expect(canEditProgram(null)).toBe(false));
});

describe('canDeleteProgram / canManageMembers / canManageChurch (admin trở lên)', () => {
  it.each(['owner', 'admin'] as const)('%s → true', (r) => {
    expect(canDeleteProgram(r)).toBe(true);
    expect(canManageMembers(r)).toBe(true);
    expect(canManageChurch(r)).toBe(true);
  });
  it.each(['editor', 'presenter', 'viewer'] as const)('%s → false', (r) => {
    expect(canDeleteProgram(r)).toBe(false);
    expect(canManageMembers(r)).toBe(false);
    expect(canManageChurch(r)).toBe(false);
  });
});

describe('canPresent (presenter trở lên)', () => {
  it.each(['owner', 'admin', 'editor', 'presenter'] as const)('%s → true', (r) => {
    expect(canPresent(r)).toBe(true);
  });
  it('viewer → false', () => expect(canPresent('viewer')).toBe(false));
  it('undefined → false', () => expect(canPresent(undefined)).toBe(false));
});

describe('isOwner (chỉ owner)', () => {
  it('owner → true, admin → false, còn lại false', () => {
    expect(isOwner('owner')).toBe(true);
    expect(isOwner('admin')).toBe(false);
    expect(isOwner('editor')).toBe(false);
    expect(isOwner(null)).toBe(false);
  });
});
