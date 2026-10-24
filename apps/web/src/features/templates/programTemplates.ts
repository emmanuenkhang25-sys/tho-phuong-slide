// ============================================================================
// Thờ Phượng Slide — MẪU CHƯƠNG TRÌNH có sẵn
// ----------------------------------------------------------------------------
// "Chương trình thờ phượng Chúa nhật": 10 mục theo đúng thứ tự buổi lễ
// Tin Lành Việt Nam. Mỗi mục có sẵn 1 slide tiêu đề với background gradient
// đẹp — người dùng chỉ việc bấm vào mục để soạn nội dung.
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

const grad = (from: string, to: string): SlideBackground => ({
  type: 'gradient',
  gradient: { from, to, angle: 135 },
  overlayOpacity: 0.15,
});

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
      kind: 'don-tiep',
      slideTitle: 'CHÀO MỪNG',
      slideSubtitle: 'Chào mừng quý tôi con Chúa đến với buổi thờ phượng',
      background: grad('#1e3a8a', '#7c3aed'),
    },
    {
      title: 'Cầu nguyện khai lễ',
      kind: 'cau-nguyen',
      slideTitle: 'CẦU NGUYỆN KHAI LỄ',
      background: grad('#78350f', '#d97706'),
    },
    {
      title: 'Đọc Kinh Thánh chung',
      kind: 'kinh-thanh',
      slideTitle: 'ĐỌC KINH THÁNH CHUNG',
      slideSubtitle: 'Nhấn "🎵 Bài hát / Kinh Thánh" để thêm đoạn Kinh Thánh',
      background: grad('#14532d', '#16a34a'),
    },
    {
      title: 'Hát thờ phượng ngợi khen',
      kind: 'hat-tho-phuong',
      slideTitle: 'HÁT NGỢI KHEN CHÚA',
      slideSubtitle: 'Nhấn nút "🎵 Thêm bài hát" để thêm lời bài hát',
      background: grad('#2b1055', '#7597de'),
    },
    {
      title: 'Dâng hiến',
      kind: 'dang-hien',
      slideTitle: 'DÂNG HIẾN',
      slideSubtitle: 'Của lễ dâng lên cho Chúa với lòng biết ơn',
      background: grad('#3a2b00', '#b8860b'),
    },
    {
      title: 'Giảng luận',
      kind: 'bai-giang',
      slideTitle: 'SỨ ĐIỆP',
      slideSubtitle: 'Điền chủ đề bài giảng vào đây',
      background: grad('#0c4a6e', '#0284c7'),
    },
    {
      title: 'Ơn phước và nhu cầu',
      kind: 'loi-chung',
      slideTitle: 'ƠN PHƯỚC & NHU CẦU',
      slideSubtitle: 'Làm chứng ơn phước — nêu nhu cầu cầu thay',
      background: grad('#831843', '#db2777'),
    },
    {
      title: 'Cầu nguyện chung',
      kind: 'cau-thay',
      slideTitle: 'CẦU NGUYỆN CHUNG',
      background: grad('#1e1b4b', '#4c1d95'),
    },
    {
      title: 'Cầu nguyện chúc phước',
      kind: 'cau-nguyen',
      slideTitle: 'CẦU NGUYỆN CHÚC PHƯỚC',
      background: grad('#713f12', '#ca8a04'),
    },
    {
      title: 'Tất lễ',
      kind: 'be-mac',
      slideTitle: 'TẤT LỄ',
      slideSubtitle: 'Hẹn gặp lại quý vị Chúa nhật tuần sau',
      background: grad('#111827', '#4b5563'),
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
