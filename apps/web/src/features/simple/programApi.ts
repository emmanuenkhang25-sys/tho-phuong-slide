// ============================================================================
// Thờ Phượng Slide — giao diện đơn giản (mobile-first)
// programApi.ts — các thao tác dữ liệu dùng chung (id tạo ở máy khách,
// INSERT không dùng RETURNING để tránh lỗi RLS khi đọc-lại).
// ============================================================================
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SlideBackground } from '../../lib/types';
import { uuid } from '../editor/lib/editorUtils';
import { PROGRAM_TEMPLATES, buildProgramFromTemplate } from '../templates/programTemplates';

export interface CreateProgramInput {
  churchId: string;
  userId: string;
  /** null = chương trình trống; 'chu-nhat' = từ mẫu Chúa nhật */
  templateId: string | null;
  title?: string;
}

/** Tạo chương trình mới (có thể kèm mẫu). Trả về id chương trình. */
export async function createSimpleProgram(
  supabase: SupabaseClient,
  input: CreateProgramInput,
): Promise<string> {
  const programId = uuid();
  const template = input.templateId
    ? PROGRAM_TEMPLATES.find((t) => t.id === input.templateId)
    : undefined;
  const { error: pErr } = await supabase.from('programs').insert({
    id: programId,
    church_id: input.churchId,
    title: input.title ?? (template ? 'Chương trình thờ phượng Chúa nhật' : 'Chương trình mới'),
    created_by: input.userId,
    updated_by: input.userId,
  });
  if (pErr) throw new Error(pErr.message);
  if (template) {
    const { sections, slides } = buildProgramFromTemplate(programId, template);
    const { error: sErr } = await supabase.from('sections').insert(
      sections.map((s) => ({
        id: s.id,
        program_id: s.program_id,
        title: s.title,
        kind: s.kind,
        order_index: s.order_index,
      })),
    );
    if (sErr) throw new Error(`Tạo mục mẫu lỗi: ${sErr.message}`);
    if (slides.length > 0) {
      const { error: slErr } = await supabase.from('slides').insert(
        slides.map((s) => ({
          id: s.id,
          program_id: s.program_id,
          section_id: s.section_id,
          order_index: s.order_index,
          content: s.content,
          background: s.background,
        })),
      );
      if (slErr) throw new Error(`Tạo slide mẫu lỗi: ${slErr.message}`);
    }
  }
  return programId;
}

export interface SimpleSectionRow {
  id: string;
  program_id: string;
  title: string;
  kind: string;
  order_index: number;
}

export interface SimpleSlideRow {
  id: string;
  program_id: string;
  section_id: string | null;
  order_index: number;
  content: { objects: { type: string; text?: string; fontSize?: number }[] };
  background: SlideBackground;
}

/** Sao chép một mục kèm toàn bộ slide của nó (đặt ngay sau mục gốc). */
export async function duplicateSimpleSection(
  supabase: SupabaseClient,
  programId: string,
  section: SimpleSectionRow,
  slides: SimpleSlideRow[],
): Promise<string> {
  const newSectionId = uuid();
  const sectionSlides = slides
    .filter((s) => s.section_id === section.id)
    .sort((a, b) => a.order_index - b.order_index);
  // Dồn order_index: mục mới chèn ngay sau mục gốc
  const { error: sErr } = await supabase.from('sections').insert({
    id: newSectionId,
    program_id: programId,
    title: `${section.title} (bản sao)`,
    kind: section.kind,
    order_index: section.order_index + 1,
  });
  if (sErr) throw new Error(sErr.message);
  if (sectionSlides.length > 0) {
    const { error: slErr } = await supabase.from('slides').insert(
      sectionSlides.map((s, i) => ({
        id: uuid(),
        program_id: programId,
        section_id: newSectionId,
        order_index: i,
        content: s.content,
        background: s.background,
      })),
    );
    if (slErr) throw new Error(slErr.message);
  }
  return newSectionId;
}

/** Sao chép toàn bộ chương trình (mục + slide). Trả về id chương trình mới. */
export async function cloneSimpleProgram(
  supabase: SupabaseClient,
  program: { id: string; church_id: string; title: string; event_date?: string | null },
  userId: string,
): Promise<string> {
  const newProgramId = uuid();
  const { data: sections } = await supabase
    .from('sections')
    .select('id,title,kind,order_index')
    .eq('program_id', program.id)
    .order('order_index');
  const { data: slides } = await supabase
    .from('slides')
    .select('id,section_id,order_index,content,background')
    .eq('program_id', program.id)
    .order('order_index');
  const { error: pErr } = await supabase.from('programs').insert({
    id: newProgramId,
    church_id: program.church_id,
    title: `${program.title} (bản sao)`,
    event_date: program.event_date ?? null,
    created_by: userId,
    updated_by: userId,
  });
  if (pErr) throw new Error(pErr.message);
  const secIdMap = new Map<string, string>();
  const newSections = ((sections ?? []) as SimpleSectionRow[]).map((s) => {
    const nid = uuid();
    secIdMap.set(s.id, nid);
    return { id: nid, program_id: newProgramId, title: s.title, kind: s.kind, order_index: s.order_index };
  });
  if (newSections.length > 0) {
    const { error } = await supabase.from('sections').insert(newSections);
    if (error) throw error;
  }
  const newSlides = ((slides ?? []) as SimpleSlideRow[]).map((s) => ({
    id: uuid(),
    program_id: newProgramId,
    section_id: s.section_id ? secIdMap.get(s.section_id) ?? null : null,
    order_index: s.order_index,
    content: s.content,
    background: s.background,
  }));
  if (newSlides.length > 0) {
    const { error } = await supabase.from('slides').insert(newSlides);
    if (error) throw error;
  }
  return newProgramId;
}
