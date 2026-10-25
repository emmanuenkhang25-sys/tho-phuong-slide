// ============================================================================
// Thờ Phượng Slide — Ghi chú chương trình vừa xóa (để hoàn tác cả khi tải lại)
// Xóa chương trình chỉ đổi status thành 'deleted' (không xóa cứng) nên vẫn cứu
// được: ghi chú này giữ id + tiêu đề + status cũ trong localStorage, trang danh
// sách đọc lại khi mở để dựng mục hoàn tác. Bấm ✕ trên thanh Hoàn tác thì xóa.
// ============================================================================

export interface DeletedProgramRecord {
  id: string;
  title: string;
  status: string;
}

const KEY = 'tps-last-deleted-program';

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function readDeletedProgram(): DeletedProgramRecord | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as DeletedProgramRecord;
    if (!rec || typeof rec.id !== 'string' || typeof rec.title !== 'string') return null;
    return { id: rec.id, title: rec.title, status: rec.status || 'draft' };
  } catch {
    return null;
  }
}

export function writeDeletedProgram(rec: DeletedProgramRecord): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(KEY, JSON.stringify(rec));
  } catch {
    /* bộ nhớ đầy hoặc bị chặn — banner hoàn tác trong phiên vẫn hoạt động */
  }
}

export function clearDeletedProgram(): void {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(KEY);
  } catch {
    /* bỏ qua */
  }
}
