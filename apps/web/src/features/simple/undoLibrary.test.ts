// Unit test: thư viện + hoàn tác (features/simple/library.ts, deletedPrograms.ts, undoStore.ts)
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { foldVi, matchLibraryItems, type LibraryItem } from './library';
import {
  clearDeletedProgram,
  readDeletedProgram,
  writeDeletedProgram,
} from './deletedPrograms';
import { pushUndo, useUndoStore } from './undoStore';

function item(displayTitle: string, kind: 'lyrics' | 'bible', matchText?: string): LibraryItem {
  return {
    section: {
      id: `sec-${displayTitle}`,
      program_id: 'lib',
      title: displayTitle,
      kind: kind === 'lyrics' ? 'ton-vinh-chua' : 'doc-kinh-thanh',
      order_index: 0,
    },
    slides: [],
    displayTitle,
    matchText: matchText ?? displayTitle,
    kind,
  };
}

describe('matchLibraryItems', () => {
  const items = [
    item('Ngợi Khen Chúa', 'lyrics'),
    item('Giăng 3:16', 'bible'),
    item('Ngợi Khen Cha', 'lyrics'),
    item('Thi Thiên 23', 'bible'),
  ];

  it('tìm không cần gõ dấu', () => {
    expect(matchLibraryItems(items, 'ngoi khen', 'lyrics').map((i) => i.displayTitle)).toEqual([
      'Ngợi Khen Chúa',
      'Ngợi Khen Cha',
    ]);
  });

  it('lọc đúng loại (bài hát không lẫn bài đọc)', () => {
    expect(matchLibraryItems(items, 'ngoi', 'bible')).toEqual([]);
    expect(matchLibraryItems(items, 'thien', 'bible').map((i) => i.displayTitle)).toEqual([
      'Thi Thiên 23',
    ]);
  });

  it('tìm theo chữ trong slide (matchText), không chỉ tiêu đề', () => {
    const withBody = [item('Bài A', 'lyrics', 'Bài A ngợi khen chúa vinh hiển')];
    expect(matchLibraryItems(withBody, 'vinh hien', 'lyrics')).toHaveLength(1);
  });

  it('từ khóa rỗng → không gợi ý', () => {
    expect(matchLibraryItems(items, '   ', 'lyrics')).toEqual([]);
  });

  it('tối đa 6 gợi ý', () => {
    const many = Array.from({ length: 9 }, (_, i) => item(`Bài hát ${i}`, 'lyrics'));
    expect(matchLibraryItems(many, 'bai hat', 'lyrics')).toHaveLength(6);
  });

  it('foldVi bỏ dấu đ/Đ', () => {
    expect(foldVi('Đức Chúa Trời')).toBe('duc chua troi');
  });
});

describe('deletedPrograms (localStorage)', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });
  });

  it('ghi → đọc lại đúng id/tiêu đề/status cũ', () => {
    writeDeletedProgram({ id: 'p1', title: 'Chương trình A', status: 'draft' });
    expect(readDeletedProgram()).toEqual({ id: 'p1', title: 'Chương trình A', status: 'draft' });
  });

  it('xóa ghi chú → đọc lại null', () => {
    writeDeletedProgram({ id: 'p1', title: 'Chương trình A', status: 'draft' });
    clearDeletedProgram();
    expect(readDeletedProgram()).toBeNull();
  });

  it('dữ liệu hỏng → đọc lại null, không ném lỗi', () => {
    (globalThis as { localStorage: Storage }).localStorage.setItem(
      'tps-last-deleted-program',
      'không phải json',
    );
    expect(readDeletedProgram()).toBeNull();
  });
});

describe('undoStore', () => {
  it('push thay thế mục cũ, clear xóa, bump tăng seq', () => {
    const run = async () => {};
    pushUndo({ label: 'Xóa chương trình “A”', run });
    expect(useUndoStore.getState().entry?.label).toBe('Xóa chương trình “A”');
    pushUndo({ label: 'Lưu nội dung mục', run });
    expect(useUndoStore.getState().entry?.label).toBe('Lưu nội dung mục');
    const seq0 = useUndoStore.getState().seq;
    useUndoStore.getState().bump();
    expect(useUndoStore.getState().seq).toBe(seq0 + 1);
    useUndoStore.getState().clear();
    expect(useUndoStore.getState().entry).toBeNull();
  });
});
