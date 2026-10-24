// ============================================================
// Thờ Phượng Slide — nhóm EDITOR
// lib/sync.ts — đẩy dữ liệu editor lên Supabase + xử lý ảnh.
// Dùng `any` cho client Supabase để không phụ thuộc kiểu sinh tự động.
// ============================================================
import type { Program, Section, Slide } from '../../../lib/types';

export interface PendingDeletes {
  slides: string[];
  sections: string[];
}

/** Đọc updated_at hiện tại của program trên server (để phát hiện xung đột). */
export async function fetchServerUpdatedAt(sb: any, programId: string): Promise<string | null> {
  const { data, error } = await sb
    .from('programs')
    .select('updated_at')
    .eq('id', programId)
    .single();
  if (error) throw error;
  return (data?.updated_at as string | null) ?? null;
}

/** Lưu snapshot toàn bộ chương trình vào program_versions. */
export async function saveVersionSnapshot(
  sb: any,
  program: Program,
  sections: Section[],
  slides: Slide[],
  userId: string | null | undefined,
  note: string,
): Promise<void> {
  const { error } = await sb.from('program_versions').insert({
    program_id: program.id,
    snapshot: { program, sections, slides },
    created_by: userId ?? null,
    note,
  });
  if (error) throw error;
}

function toSectionRow(s: Section) {
  return {
    id: s.id,
    program_id: s.program_id,
    title: s.title,
    kind: s.kind,
    order_index: s.order_index,
  };
}

function toSlideRow(s: Slide) {
  return {
    id: s.id,
    program_id: s.program_id,
    section_id: s.section_id,
    order_index: s.order_index,
    content: s.content,
    background: s.background,
  };
}

function toProgramRow(p: Program, userId: string | null | undefined) {
  return {
    id: p.id,
    church_id: p.church_id,
    title: p.title,
    event_date: p.event_date,
    start_time: p.start_time,
    leader: p.leader,
    theme: p.theme,
    theme_verse: p.theme_verse,
    notes: p.notes,
    design_template: p.design_template,
    aspect_ratio: p.aspect_ratio,
    status: p.status,
    is_favorite: p.is_favorite,
    created_by: p.created_by,
    updated_by: userId ?? p.updated_by ?? null,
    updated_at: new Date().toISOString(),
    deleted_at: (p as Program & { deleted_at?: string | null }).deleted_at ?? null,
  };
}

/**
 * Đẩy toàn bộ: xóa các id đã xóa → upsert program/sections/slides.
 * Ném lỗi nếu bất kỳ bước nào thất bại (caller hiển thị trạng thái 'loi').
 */
export async function pushAll(
  sb: any,
  program: Program,
  sections: Section[],
  slides: Slide[],
  deleted: PendingDeletes,
  userId: string | null | undefined,
): Promise<void> {
  if (deleted.slides.length > 0) {
    const { error } = await sb.from('slides').delete().in('id', deleted.slides);
    if (error) throw error;
  }
  if (deleted.sections.length > 0) {
    const { error } = await sb.from('sections').delete().in('id', deleted.sections);
    if (error) throw error;
  }
  const { error: pErr } = await sb.from('programs').upsert(toProgramRow(program, userId));
  if (pErr) throw pErr;
  if (sections.length > 0) {
    const { error } = await sb.from('sections').upsert(sections.map(toSectionRow));
    if (error) throw error;
  }
  if (slides.length > 0) {
    const { error } = await sb.from('slides').upsert(slides.map(toSlideRow));
    if (error) throw error;
  }
}

const REMOTE_SRC_RE = /^(https?:|data:|blob:)/i;

/**
 * Chuyển src của object ảnh thành URL hiển thị được.
 * - URL/dataURL giữ nguyên.
 * - file_path trong bucket private `program-images` → signed URL (cache lại).
 * Giữ SlideRenderer thuần túy (không side-effect).
 */
export async function resolveImageSrc(
  sb: any,
  src: string | undefined,
  cache: Map<string, string>,
): Promise<string | undefined> {
  if (!src) return src;
  if (REMOTE_SRC_RE.test(src)) return src;
  const hit = cache.get(src);
  if (hit) return hit;
  try {
    const { data, error } = await sb.storage
      .from('program-images')
      .createSignedUrl(src, 60 * 60 * 24 * 7);
    if (error || !data?.signedUrl) return src;
    cache.set(src, data.signedUrl as string);
    return data.signedUrl as string;
  } catch {
    return src;
  }
}

/** Resolve toàn bộ ảnh (object image + background image) trong danh sách slide. */
export async function resolveSlideImages(
  sb: any,
  slides: Slide[],
  cache: Map<string, string>,
): Promise<Slide[]> {
  return Promise.all(
    slides.map(async (s) => {
      const objects = await Promise.all(
        s.content.objects.map(async (o) => {
          if (o.type !== 'image' || !o.src) return o;
          const src = await resolveImageSrc(sb, o.src, cache);
          return src === o.src ? o : { ...o, src };
        }),
      );
      let background = s.background;
      if (background?.type === 'image' && background.image) {
        const image = await resolveImageSrc(sb, background.image, cache);
        if (image !== background.image) background = { ...background, image };
      }
      return { ...s, content: { ...s.content, objects }, background };
    }),
  );
}

/**
 * Đảo ngược resolveSlideImages: trả src của object/background về file_path
 * gốc trong bucket (tra cứu ngược qua cache). Dùng trước khi LƯU
 * (Dexie draft, program_versions, push Supabase) để DB không bao giờ
 * chứa signed URL tạm thời (hết hạn sau 7 ngày).
 */
export function restoreFilePaths(slides: Slide[], cache: Map<string, string>): Slide[] {
  if (cache.size === 0) return slides;
  const reverse = new Map<string, string>();
  cache.forEach((url, path) => {
    if (!reverse.has(url)) reverse.set(url, path);
  });
  return slides.map((s) => {
    const objects = s.content.objects.map((o) => {
      if (o.type === 'image' && o.src && reverse.has(o.src)) {
        return { ...o, src: reverse.get(o.src)! };
      }
      return o;
    });
    let background = s.background;
    if (background?.type === 'image' && background.image && reverse.has(background.image)) {
      background = { ...background, image: reverse.get(background.image)! };
    }
    return { ...s, content: { ...s.content, objects }, background };
  });
}
