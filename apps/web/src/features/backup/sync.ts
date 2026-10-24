// Sync engine — đẩy bản nháp/hàng đợi Dexie lên Supabase, kéo bản mới về,
// phát hiện xung đột theo `updated_at` (CONTRACT mục 8).
// NGUYÊN TẮC: không bao giờ tự ghi đè bản mới bằng bản cũ —
// khi cả hai phía đều thay đổi, trả conflict để người dùng chọn.
import { supabase } from '../../lib/supabase';
import { db, getDraft, saveDraft, dequeueSync } from '../../lib/dexie';
import { useSyncStatus } from '../../stores/sync';
import type { Program, Section, Slide } from '../../lib/types';

export interface SyncConflict {
  programId: string;
  title: string;
  localUpdatedAt: string;
  serverUpdatedAt: string;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: SyncConflict[];
}

interface DraftData {
  program: Program;
  sections: Section[];
  slides: Slide[];
}

interface DraftRecord {
  programId: string;
  churchId: string;
  data: DraftData;
  updatedAt: string;
  dirty: boolean;
}

interface QueuedOp {
  id?: number;
  op: string;
  table: string;
  rowId: string;
  payload?: Record<string, unknown>;
  createdAt: number;
}

const SYNC_TABLES = ['programs', 'sections', 'slides'];
/** Dung sai khi so sánh thời gian (tránh conflict giả do chênh lệch đồng hồ). */
const CONFLICT_TOLERANCE_MS = 1000;

function isOfflineError(err: unknown): boolean {
  if (!navigator.onLine) return true;
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /failed to fetch|network|networkerror/i.test(msg);
}

/** Đẩy một bản nháp lên máy chủ rồi đánh dấu đã sạch (KHÔNG xóa draft trước khi server xác nhận). */
async function pushDraft(d: DraftRecord): Promise<void> {
  const { program, sections, slides } = d.data;
  const up1 = await supabase.from('programs').upsert(program);
  if (up1.error) throw new Error(up1.error.message);
  if (sections.length > 0) {
    const up2 = await supabase.from('sections').upsert(sections);
    if (up2.error) throw new Error(up2.error.message);
  }
  if (slides.length > 0) {
    const up3 = await supabase.from('slides').upsert(slides);
    if (up3.error) throw new Error(up3.error.message);
  }
  await saveDraft({
    programId: d.programId,
    churchId: d.churchId,
    data: d.data,
    updatedAt: new Date().toISOString(),
    dirty: false,
  });
}

/** Tải toàn bộ chương trình từ máy chủ. */
async function fetchServerProgram(programId: string): Promise<DraftData> {
  const { data: program, error: e1 } = await supabase.from('programs').select('*').eq('id', programId).single();
  if (e1 || !program) throw new Error('Không tải được chương trình từ máy chủ.');
  const { data: sections } = await supabase.from('sections').select('*').eq('program_id', programId).order('order_index');
  const { data: slides } = await supabase.from('slides').select('*').eq('program_id', programId).order('order_index');
  return {
    program: program as Program,
    sections: (sections ?? []) as Section[],
    slides: (slides ?? []) as Slide[],
  };
}

/**
 * Đồng bộ ngay: đẩy hàng đợi + bản nháp dirty, kéo bản mới từ máy chủ.
 * Trả về conflicts khi máy chủ mới hơn mà bản local cũng đang dirty.
 */
export async function syncNow(churchId: string, onStatus?: (msg: string) => void): Promise<SyncResult> {
  const setSync = useSyncStatus.getState().setStatus;
  const say = (m: string) => onStatus?.(m);
  const result: SyncResult = { pushed: 0, pulled: 0, conflicts: [] };
  setSync('dang-luu', 'Đang đồng bộ…');

  try {
    // 1) Đẩy hàng đợi thao tác (enqueueSync/dequeueSync của web-core)
    say('Đang đẩy các thay đổi lên máy chủ…');
    for (;;) {
      const op = (await dequeueSync()) as QueuedOp | null | undefined;
      if (!op) break;
      if (!SYNC_TABLES.includes(op.table)) continue;
      if (op.op === 'delete') {
        const { error } = await supabase.from(op.table).delete().eq('id', op.rowId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from(op.table).upsert(op.payload ?? {});
        if (error) throw new Error(error.message);
      }
      result.pushed += 1;
    }

    // 2) Đẩy các bản nháp còn dirty của hội thánh này
    say('Đang đẩy bản nháp trên máy…');
    const drafts = (await db.table('drafts').where('churchId').equals(churchId).toArray()) as DraftRecord[];
    for (const d of drafts) {
      if (!d.dirty) continue;
      await pushDraft(d);
      result.pushed += 1;
    }

    // 3) Kéo: so updated_at từng chương trình
    say('Đang kiểm tra bản mới từ máy chủ…');
    const { data: serverPrograms, error } = await supabase
      .from('programs')
      .select('*')
      .eq('church_id', churchId)
      .neq('status', 'deleted');
    if (error) throw new Error(error.message);

    for (const sp of (serverPrograms ?? []) as Program[]) {
      const local = (await getDraft(sp.id)) as DraftRecord | undefined;
      if (!local) {
        const data = await fetchServerProgram(sp.id);
        await saveDraft({ programId: sp.id, churchId, data, updatedAt: sp.updated_at, dirty: false });
        result.pulled += 1;
        continue;
      }
      const serverNewer =
        new Date(sp.updated_at).getTime() > new Date(local.updatedAt).getTime() + CONFLICT_TOLERANCE_MS;
      if (serverNewer && local.dirty) {
        // Cả hai phía đều đổi → xung đột, để người dùng quyết định (CONTRACT mục 8).
        result.conflicts.push({
          programId: sp.id,
          title: sp.title,
          localUpdatedAt: local.updatedAt,
          serverUpdatedAt: sp.updated_at,
        });
      } else if (serverNewer) {
        const data = await fetchServerProgram(sp.id);
        await saveDraft({ programId: sp.id, churchId, data, updatedAt: sp.updated_at, dirty: false });
        result.pulled += 1;
      }
    }

    setSync(
      'da-dong-bo',
      result.conflicts.length > 0
        ? `Đã đồng bộ — có ${result.conflicts.length} xung đột cần bạn xử lý`
        : 'Đã đồng bộ xong',
    );
    say('Hoàn tất đồng bộ.');
    return result;
  } catch (err) {
    const offline = isOfflineError(err);
    setSync(
      offline ? 'ngoai-tuyen' : 'loi',
      offline ? 'Ngoại tuyến — các thay đổi sẽ được đồng bộ khi có mạng' : 'Lỗi đồng bộ, vui lòng thử lại.',
    );
    throw err;
  }
}

/**
 * Giải quyết xung đột:
 * - 'mine': lưu snapshot bản MÁY CHỦ vào program_versions, rồi đẩy bản của tôi lên.
 * - 'theirs': lưu snapshot bản TRÊN MÁY vào program_versions, rồi lấy bản máy chủ đè lên.
 */
export async function resolveConflict(programId: string, choice: 'mine' | 'theirs'): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Bạn cần đăng nhập để xử lý xung đột.');

  if (choice === 'mine') {
    const server = await fetchServerProgram(programId);
    const ins = await supabase.from('program_versions').insert({
      program_id: programId,
      snapshot: server,
      created_by: user.id,
      note: 'Tự động lưu trước khi giải quyết xung đột — giữ bản của tôi',
    });
    if (ins.error) throw new Error('Không lưu được phiên bản dự phòng: ' + ins.error.message);
    const draft = (await getDraft(programId)) as DraftRecord | undefined;
    if (!draft) throw new Error('Không tìm thấy bản nháp trên máy.');
    await pushDraft(draft);
  } else {
    const draft = (await getDraft(programId)) as DraftRecord | undefined;
    if (draft) {
      const ins = await supabase.from('program_versions').insert({
        program_id: programId,
        snapshot: draft.data,
        created_by: user.id,
        note: 'Tự động lưu trước khi giải quyết xung đột — giữ bản máy chủ',
      });
      if (ins.error) throw new Error('Không lưu được phiên bản dự phòng: ' + ins.error.message);
    }
    const server = await fetchServerProgram(programId);
    await saveDraft({
      programId,
      churchId: server.program.church_id,
      data: server,
      updatedAt: server.program.updated_at,
      dirty: false,
    });
  }
  useSyncStatus.getState().setStatus('da-dong-bo', 'Đã xử lý xung đột');
}
