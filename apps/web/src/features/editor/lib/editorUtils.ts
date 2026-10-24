// ============================================================
// Thờ Phượng Slide — nhóm EDITOR
// lib/editorUtils.ts — hàm tiện ích dùng trong editor (thuần, không UI).
// ============================================================
import type { Slide, SlideBackground, SlideObject } from '../../../lib/types';
import type { SlideDraft } from './split';

/** UUID phía client (dùng crypto.randomUUID khi có). */
export function uuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* bỏ qua, dùng fallback */
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Danh sách kind của section theo CONTRACT 3.5.1. */
export const SECTION_KINDS: { value: string; label: string }[] = [
  { value: 'don-tiep', label: 'Đón tiếp' },
  { value: 'khai-mac', label: 'Khai mạc' },
  { value: 'cau-nguyen', label: 'Cầu nguyện' },
  { value: 'hat-tho-phuong', label: 'Hát thờ phượng' },
  { value: 'thanh-ca', label: 'Thánh ca' },
  { value: 'kinh-thanh', label: 'Kinh Thánh' },
  { value: 'loi-chung', label: 'Lời chứng' },
  { value: 'dang-hien', label: 'Dâng hiến' },
  { value: 'thong-bao', label: 'Thông báo' },
  { value: 'bai-giang', label: 'Bài giảng' },
  { value: 'tiec-thanh', label: 'Tiệc Thánh' },
  { value: 'cau-thay', label: 'Cầu thay' },
  { value: 'be-mac', label: 'Bế mạc' },
  { value: 'custom', label: 'Tự thêm' },
];

export function sectionKindLabel(kind: string): string {
  return SECTION_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

export function defaultSlideBackground(): SlideBackground {
  return { type: 'color', color: '#1e3a5f' };
}

export function newTextObject(partial: Partial<SlideObject> = {}): SlideObject {
  return {
    id: uuid(),
    type: 'text',
    x: 10, y: 30, w: 80, h: 40, z: 5,
    text: 'Nhấp đúp để sửa chữ',
    fontFamily: 'Arial, sans-serif',
    fontSize: 44,
    color: '#ffffff',
    bold: false,
    italic: false,
    align: 'center',
    lineHeight: 1.5,
    ...partial,
  };
}

export function newShapeObject(
  shape: 'rect' | 'ellipse' | 'line',
  partial: Partial<SlideObject> = {},
): SlideObject {
  return {
    id: uuid(),
    type: 'shape',
    shape,
    x: 30, y: 35, w: 40, h: shape === 'line' ? 3 : 30, z: 4,
    fill: '#f59e0b',
    stroke: '#ffffff',
    strokeWidth: shape === 'line' ? 4 : 2,
    opacity: 1,
    ...partial,
  };
}

export function newImageObject(src: string, partial: Partial<SlideObject> = {}): SlideObject {
  return {
    id: uuid(),
    type: 'image',
    src,
    x: 25, y: 20, w: 50, h: 60, z: 3,
    ...partial,
  };
}

/** Slide trắng với 1 text box mẫu. */
export function blankSlide(
  programId: string,
  sectionId: string | null,
  orderIndex: number,
  background?: SlideBackground,
): Slide {
  return {
    id: uuid(),
    program_id: programId,
    section_id: sectionId,
    order_index: orderIndex,
    content: { objects: [newTextObject()] },
    background: background ? { ...background } : defaultSlideBackground(),
  };
}

/** Chuyển SlideDraft (từ split) thành Slide thật: cấp id mới cho slide + mọi object. */
export function draftToSlide(
  draft: SlideDraft,
  programId: string,
  sectionId: string | null,
  orderIndex: number,
): Slide {
  return {
    id: uuid(),
    program_id: programId,
    section_id: sectionId,
    order_index: orderIndex,
    content: {
      objects: draft.objects.map((o) => ({ ...o, id: uuid() })),
    },
    background: { ...draft.background },
  };
}

/** Nhân bản sâu 1 slide (id slide + id object đều mới). */
export function cloneSlide(slide: Slide): Slide {
  return {
    ...slide,
    id: uuid(),
    content: {
      objects: slide.content.objects.map((o) => ({ ...o, id: uuid() })),
    },
    background: { ...slide.background },
  };
}

/** Đánh lại order_index 0..n-1 theo đúng thứ tự mảng. */
export function renumberSlides(slides: Slide[]): Slide[] {
  return slides.map((s, i) => ({ ...s, order_index: i }));
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
