// ============================================================================
// Thờ Phượng Slide — Thư viện (library)
// Cách lưu KHÔNG cần migration mới: Thư viện là một chương trình bình thường
// nhưng đánh dấu design_template = { library: true }. Mỗi bài hát / bài đọc
// trong thư viện là một MỤC của chương trình đó, sửa bằng đúng trình sửa mục
// quen thuộc; chèn vào chương trình là copy nguyên slide đã làm sẵn.
// Chương trình Thư viện được giấu khỏi danh sách chương trình và khỏi /bat-dau.
// ============================================================================
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Section, Slide } from '../../lib/types';
import { uuid } from '../editor/lib/editorUtils';
import { sectionEditorType } from './sectionForms';

export const LIBRARY_PROGRAM_TITLE = '📚 Thư viện';

/** Chương trình có phải Thư viện không (đọc từ cột design_template có sẵn). */
export function isLibraryProgram(p: { design_template?: unknown }): boolean {
  const dt = p.design_template as { library?: unknown } | null | undefined;
  return dt?.library === true;
}

export interface LibraryItem {
  section: Section;
  slides: Slide[];
  /** Tên hiển thị: tên bài hát (chữ nhỏ slide đầu) hoặc tham chiếu Kinh Thánh. */
  displayTitle: string;
  /** Chuỗi để tìm: tên mục + toàn bộ chữ slide đầu (gồm tên bài/tham chiếu). */
  matchText: string;
  /** 'lyrics' = bài hát, 'bible' = bài đọc Kinh Thánh. */
  kind: 'lyrics' | 'bible';
}

/** Chữ của object text nhỏ nhất trong slide (tiêu đề bài hát / tham chiếu). */
function smallTextOf(slide: Slide): string {
  let best: string | null = null;
  let bestSize = 99;
  for (const o of slide.content?.objects ?? []) {
    if (o.type === 'text' && o.text && (o.fontSize ?? 99) <= 32 && (o.fontSize ?? 0) < bestSize) {
      bestSize = o.fontSize ?? 0;
      best = o.text.trim();
    }
  }
  return best ?? '';
}

/** Tìm chương trình Thư viện của hội thánh (null nếu chưa có). */
export async function findLibraryProgram(
  supabase: SupabaseClient,
  churchId: string,
): Promise<{ id: string; title: string } | null> {
  const { data, error } = await supabase
    .from('programs')
    .select('id,title,design_template')
    .eq('church_id', churchId)
    .neq('status', 'deleted')
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  const found = ((data ?? []) as { id: string; title: string; design_template?: unknown }[]).find(
    isLibraryProgram,
  );
  return found ? { id: found.id, title: found.title } : null;
}

/** Lấy hoặc tạo chương trình Thư viện (tạo mới nếu chưa có). */
export async function ensureLibraryProgram(
  supabase: SupabaseClient,
  churchId: string,
  userId: string,
): Promise<{ id: string; title: string }> {
  const found = await findLibraryProgram(supabase, churchId);
  if (found) return found;
  const id = uuid();
  const { error } = await supabase.from('programs').insert({
    id,
    church_id: churchId,
    title: LIBRARY_PROGRAM_TITLE,
    design_template: { library: true },
    created_by: userId,
    updated_by: userId,
  });
  if (error) throw new Error(error.message);
  return { id, title: LIBRARY_PROGRAM_TITLE };
}

/** Tải toàn bộ mục bài hát + Kinh Thánh trong Thư viện (kèm slide). */
export async function fetchLibraryItems(
  supabase: SupabaseClient,
  libraryProgramId: string,
): Promise<LibraryItem[]> {
  const [{ data: secs }, { data: sls }] = await Promise.all([
    supabase
      .from('sections')
      .select('*')
      .eq('program_id', libraryProgramId)
      .order('order_index'),
    supabase
      .from('slides')
      .select('*')
      .eq('program_id', libraryProgramId)
      .order('order_index'),
  ]);
  const bySection = new Map<string, Slide[]>();
  for (const s of (sls ?? []) as Slide[]) {
    const k = s.section_id ?? '';
    if (!bySection.has(k)) bySection.set(k, []);
    bySection.get(k)?.push(s);
  }
  const items: LibraryItem[] = [];
  for (const sec of (secs ?? []) as Section[]) {
    const type = sectionEditorType(sec.kind);
    if (type !== 'lyrics' && type !== 'bible') continue;
    const slides = (bySection.get(sec.id) ?? []).sort((a, b) => a.order_index - b.order_index);
    const firstTexts = (slides[0]?.content?.objects ?? [])
      .filter((o) => o.type === 'text' && o.text)
      .map((o) => o.text as string)
      .join(' ');
    items.push({
      section: sec,
      slides,
      displayTitle: smallTextOf(slides[0]) || sec.title,
      matchText: `${sec.title} ${firstTexts}`,
      kind: type,
    });
  }
  return items;
}

/** Bỏ dấu tiếng Việt để tìm không cần gõ dấu (VD "ngoi khen" vẫn ra "Ngợi khen"). */
export function foldVi(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .toLowerCase();
}
