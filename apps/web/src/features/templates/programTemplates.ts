// ============================================================================
// Thờ Phượng Slide — MẪU CHƯƠNG TRÌNH có sẵn
// ----------------------------------------------------------------------------
// "Chương trình thờ phượng Chúa nhật": 10 mục theo đúng thứ tự buổi lễ
// Tin Lành Việt Nam. Mỗi mục có sẵn 1 slide tiêu đề, nền đen chữ trắng
// mặc định — người dùng chỉ việc bấm vào mục để soạn nội dung.
// ============================================================================
import type { Section, Slide, SlideBackground, SlideObject } from '../../lib/types';
import { uuid } from '../editor/lib/editorUtils';

export interface ProgramTemplateDef {
  id: string;
  name: string;
  description: string;
  sections: ProgramTemplateSection[];
}

export interface ProgramTemplateSection {
  title: string;
  /** kind theo SECTION_KINDS trong editorUtils */
  kind: string;
  /** Slide tiêu đề mẫu của mục */
  slideTitle: string;
  slideSubtitle?: string;
  background: SlideBackground;
}

function titleObjects(title: string, subtitle?: string): SlideObject[] {
  const objs: SlideObject[] = [
    {
      id: uuid(),
      type: 'text',
      x: 8, y: 32, w: 84, h: 24, z: 5,
      text: title,
      fontFamily: 'Arial, sans-serif',
      fontSize: 64,
      color: '#ffffff',
      bold: true,
      align: 'center',
      lineHeight: 1.3,
    },
  ];
  if (subtitle) {
    objs.push({
      id: uuid(),
      type: 'text',
      x: 12, y: 60, w: 76, h: 20, z: 5,
      text: subtitle,
      fontFamily: 'Arial, sans-serif',
      fontSize: 30,
      color: '#f1f5f9',
      bold: false,
      align: 'center',
      lineHeight: 1.4,
    });
  }
  return objs;
}

export const SUNDAY_PROGRAM_TEMPLATE: ProgramTemplateDef = {
  id: 'chu-nhat',
  name: 'Thờ phượng Chúa nhật',
  description: 'Đầy đủ 10 mục theo thứ tự buổi lễ — chỉ việc điền nội dung',
  sections: [
    {
      title: 'Chào mừng',
      kind: 'chao-mung',
      slideTitle: 'CHÀO MỪNG',
      slideSubtitle: 'Chào mừng quý tôi con Chúa đến với buổi thờ phượng',
      background: { type: 'color', color: '#000000' },
    },
    {
      title: 'Tôn vinh Chúa',
      kind: 'ton-vinh-chua',
      slideTitle: 'TÔN VINH CHÚA',
      slideSubtitle: 'Nhấn vào mục này rồi bấm "🎵 Thêm bài hát" để thêm lời bài hát',
      background: { type: 'color', color: '#000000' },
    },
    {
      title: 'Cầu nguyện khai lễ',
      kind: 'cau-nguyen-khai-le',
      slideTitle: 'CẦU NGUYỆN KHAI LỄ',
      background: { type: 'color', color: '#000000' },
    },
    {
      title: 'Đọc Kinh Thánh',
      kind: 'doc-kinh-thanh',
      slideTitle: 'ĐỌC KINH THÁNH',
      slideSubtitle: 'Nhấn vào mục này để nhập đoạn Kinh Thánh',
      background: { type: 'color', color: '#000000' },
    },
    {
      title: 'Tôn vinh Chúa tiếp tục',
      kind: 'ton-vinh-chua-2',
      slideTitle: 'TÔN VINH CHÚA',
      slideSubtitle: 'Nhấn vào mục này rồi bấm "🎵 Thêm bài hát" để thêm lời bài hát',
      background: { type: 'color', color: '#000000' },
    },
    {
      title: 'Dâng hiến',
      kind: 'dang-hien',
      slideTitle: 'DÂNG HIẾN',
      slideSubtitle: 'Của lễ dâng lên cho Chúa với lòng biết ơn',
      background: { type: 'color', color: '#000000' },
    },
    {
      title: 'Giảng Lời Chúa',
      kind: 'giang-loi-chua',
      slideTitle: 'GIẢNG LỜI CHÚA',
      slideSubtitle: 'Nhấn vào mục này để nhập chủ đề và câu gốc',
      background: { type: 'color', color: '#000000' },
    },
    {
      title: 'Đáp ứng Lời Chúa',
      kind: 'dap-ung-loi-chua',
      slideTitle: 'ĐÁP ỨNG LỜI CHÚA',
      slideSubtitle: 'Nhấn vào mục này rồi bấm "🎵 Thêm bài hát" để thêm bài đáp ứng',
      background: { type: 'color', color: '#000000' },
    },
    {
      title: 'Cầu thay và thông báo',
      kind: 'cau-thay-thong-bao',
      slideTitle: 'CẦU THAY & THÔNG BÁO',
      background: { type: 'color', color: '#000000' },
    },
    {
      title: 'Cầu nguyện tất lễ và chúc phước',
      kind: 'cau-nguyen-tat-le',
      slideTitle: 'CẦU NGUYỆN TẤT LỄ',
      slideSubtitle: 'Hẹn gặp lại quý vị Chúa nhật tuần sau',
      background: { type: 'color', color: '#000000' },
    },
  ],
};

export const PROGRAM_TEMPLATES: ProgramTemplateDef[] = [SUNDAY_PROGRAM_TEMPLATE];

/** Dựng sections + slides từ mẫu (id tạo ở máy khách — không cần RETURNING). */
export function buildProgramFromTemplate(
  programId: string,
  template: ProgramTemplateDef,
): { sections: Section[]; slides: Slide[] } {
  const sections: Section[] = [];
  const slides: Slide[] = [];
  template.sections.forEach((ts, i) => {
    const sectionId = uuid();
    sections.push({
      id: sectionId,
      program_id: programId,
      title: ts.title,
      kind: ts.kind,
      order_index: i,
    });
    slides.push({
      id: uuid(),
      program_id: programId,
      section_id: sectionId,
      order_index: i,
      content: { objects: titleObjects(ts.slideTitle, ts.slideSubtitle) },
      background: { ...ts.background },
    });
  });
  return { sections, slides };
}
