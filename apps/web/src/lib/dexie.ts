import Dexie, { type Table } from 'dexie';
import type { Program, Section, Slide } from './types';

/**
 * Lớp lưu trữ cục bộ (CONTRACT mục 5 + mục 8).
 * - drafts: bản nháp chương trình (autosave), keyPath programId
 * - sync_queue: hàng đợi thao tác chờ đồng bộ khi ngoại tuyến
 * - assets_cache: ảnh đã tải về, dùng khi ngoại tuyến
 */

export interface ProgramDraft {
  programId: string;
  churchId: string;
  data: { program: Program; sections: Section[]; slides: Slide[] };
  updatedAt: string; // ISO
  dirty: boolean; // true = chưa đồng bộ lên máy chủ
}

export type SyncOpKind = 'upsert' | 'delete';

export interface SyncOp {
  id?: number;
  op: SyncOpKind;
  table: 'programs' | 'sections' | 'slides' | 'program_assets';
  rowId: string;
  payload: Record<string, any>;
  createdAt: string; // ISO
}

export interface AssetCacheEntry {
  path: string; // file_path trong bucket
  dataUrl: string; // dataURL (base64)
}

/** Bài hát đã lưu trong "Thư viện bài hát" của một hội thánh (cục bộ trên máy). */
export interface SongLibraryEntry {
  id: string; // uuid
  churchId: string;
  title: string;
  lyrics: string;
  updatedAt: string; // ISO
}

class TpsDatabase extends Dexie {
  drafts!: Table<ProgramDraft, string>;
  sync_queue!: Table<SyncOp, number>;
  assets_cache!: Table<AssetCacheEntry, string>;
  song_library!: Table<SongLibraryEntry, string>;

  constructor() {
    super('thophuongslide');
    this.version(1).stores({
      drafts: 'programId',
      sync_queue: '++id',
      assets_cache: 'path',
    });
    // v2: thêm thư viện bài hát theo hội thánh
    this.version(2).stores({
      drafts: 'programId',
      sync_queue: '++id',
      assets_cache: 'path',
      song_library: 'id, churchId',
    });
  }
}

export const db = new TpsDatabase();

/** Lưu/ghi đè bản nháp chương trình vào máy. */
export async function saveDraft(d: ProgramDraft): Promise<void> {
  await db.drafts.put(d);
}

/** Đọc bản nháp theo programId; trả về undefined nếu chưa có. */
export async function getDraft(programId: string): Promise<ProgramDraft | undefined> {
  return db.drafts.get(programId);
}

/** Xóa bản nháp sau khi máy chủ đã xác nhận đồng bộ. */
export async function clearDraft(programId: string): Promise<void> {
  await db.drafts.delete(programId);
}

/** Thêm một thao tác vào hàng đợi đồng bộ. Trả về id của bản ghi. */
export async function enqueueSync(op: Omit<SyncOp, 'id' | 'createdAt'>): Promise<number> {
  return db.sync_queue.add({ ...op, createdAt: new Date().toISOString() });
}

/** Lấy và gỡ thao tác cũ nhất khỏi hàng đợi (FIFO). */
export async function dequeueSync(): Promise<SyncOp | undefined> {
  return db.transaction('rw', db.sync_queue, async () => {
    const first = await db.sync_queue.orderBy('id').first();
    if (first?.id != null) {
      await db.sync_queue.delete(first.id);
    }
    return first;
  });
}

/** Xem toàn bộ hàng đợi (không gỡ) — dùng cho chip trạng thái/hiển thị chẩn đoán. */
export async function peekSyncQueue(): Promise<SyncOp[]> {
  return db.sync_queue.orderBy('id').toArray();
}

/** Đếm số thao tác đang chờ đồng bộ. */
export async function countPendingSync(): Promise<number> {
  return db.sync_queue.count();
}

/* ------------------------- Thư viện bài hát ------------------------- */

/** Lưu (thêm mới hoặc ghi đè theo id) một bài hát vào thư viện của hội thánh. */
export async function saveSongToLibrary(entry: SongLibraryEntry): Promise<void> {
  await db.song_library.put(entry);
}

/** Lấy toàn bộ bài hát đã lưu của một hội thánh (mới nhất trước). */
export async function getSongsByChurch(churchId: string): Promise<SongLibraryEntry[]> {
  return db.song_library.where('churchId').equals(churchId).reverse().sortBy('updatedAt');
}

/** Xóa một bài hát khỏi thư viện. */
export async function deleteSongFromLibrary(id: string): Promise<void> {
  await db.song_library.delete(id);
}
