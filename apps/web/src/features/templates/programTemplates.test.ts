// Unit test: src/features/templates/programTemplates.ts
// Mẫu "Chương trình Chúa nhật" phải đủ 10 mục đúng thứ tự, mỗi mục 1 slide,
// id duy nhất, order_index liên tục.
import { describe, expect, it } from 'vitest';
import { buildProgramFromTemplate, SUNDAY_PROGRAM_TEMPLATE } from './programTemplates';

describe('SUNDAY_PROGRAM_TEMPLATE', () => {
  it('có đúng 10 mục theo thứ tự buổi lễ', () => {
    const titles = SUNDAY_PROGRAM_TEMPLATE.sections.map((s) => s.title);
    expect(titles).toEqual([
      'Chào mừng',
      'Tôn vinh Chúa',
      'Cầu nguyện khai lễ',
      'Đọc Kinh Thánh',
      'Tôn vinh Chúa tiếp tục',
      'Dâng hiến',
      'Giảng Lời Chúa',
      'Đáp ứng Lời Chúa',
      'Cầu thay và thông báo',
      'Cầu nguyện tất lễ và chúc phước',
    ]);
  });

  it('mỗi mục có kind hợp lệ và nền đen mặc định', () => {
    for (const s of SUNDAY_PROGRAM_TEMPLATE.sections) {
      expect(s.kind).toBeTruthy();
      expect(s.background.type).toBe('color');
      expect(s.background.color).toBe('#000000');
    }
  });
});

describe('buildProgramFromTemplate', () => {
  it('dựng sections + slides khớp nhau, id duy nhất, order liên tục', () => {
    const { sections, slides } = buildProgramFromTemplate('prog-1', SUNDAY_PROGRAM_TEMPLATE);
    expect(sections).toHaveLength(10);
    expect(slides).toHaveLength(10);
    const ids = new Set<string>();
    sections.forEach((s, i) => {
      expect(s.program_id).toBe('prog-1');
      expect(s.order_index).toBe(i);
      expect(s.id).toBeTruthy();
      ids.add(s.id);
    });
    slides.forEach((sl, i) => {
      expect(sl.program_id).toBe('prog-1');
      expect(sl.order_index).toBe(i);
      expect(sl.section_id).toBe(sections[i].id);
      expect(sl.content.objects.length).toBeGreaterThan(0);
      ids.add(sl.id);
      sl.content.objects.forEach((o) => ids.add(o.id));
    });
    // mọi id (section, slide, object) đều duy nhất
    expect(ids.size).toBe(10 + 10 + slides.reduce((n, sl) => n + sl.content.objects.length, 0));
  });

  it('slide tiêu đề có chữ to, in đậm, căn giữa', () => {
    const { slides } = buildProgramFromTemplate('prog-1', SUNDAY_PROGRAM_TEMPLATE);
    const titleObj = slides[0].content.objects[0];
    expect(titleObj.type).toBe('text');
    expect(titleObj.bold).toBe(true);
    expect(titleObj.align).toBe('center');
    expect(titleObj.fontSize).toBeGreaterThanOrEqual(48);
  });
});
