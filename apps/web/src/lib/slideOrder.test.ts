import { describe, expect, it } from 'vitest';
import { orderProgramSlides } from './slideOrder';
import type { Section, Slide } from './types';

const section = (id: string, order_index: number): Section => ({
  id,
  program_id: 'p1',
  title: id,
  kind: 'custom',
  order_index,
});

const slide = (id: string, section_id: string | null, order_index: number): Slide => ({
  id,
  program_id: 'p1',
  section_id,
  order_index,
  content: { objects: [] },
  background: { type: 'color', color: '#ffffff' },
});

describe('orderProgramSlides', () => {
  it('không xen kẽ các mục: hết slide mục trước rồi mới tới mục sau', () => {
    const sections = [section('bai-hat', 0), section('kinh-thanh', 1)];
    // Đầu vào cố tình xếp theo order_index của slide (kiểu cũ hay bị).
    const slides = [
      slide('hat-1', 'bai-hat', 0),
      slide('kt-1', 'kinh-thanh', 0),
      slide('hat-2', 'bai-hat', 1),
      slide('kt-2', 'kinh-thanh', 1),
    ];
    expect(orderProgramSlides(sections, slides).map((s) => s.id)).toEqual([
      'hat-1',
      'hat-2',
      'kt-1',
      'kt-2',
    ]);
  });

  it('mục truyền vào chưa đúng thứ tự vẫn sắp theo order_index của mục', () => {
    const sections = [section('kinh-thanh', 1), section('bai-hat', 0)];
    const slides = [slide('kt-1', 'kinh-thanh', 0), slide('hat-1', 'bai-hat', 0)];
    expect(orderProgramSlides(sections, slides).map((s) => s.id)).toEqual([
      'hat-1',
      'kt-1',
    ]);
  });

  it('slide trong mục sắp theo order_index của slide, kể cả khi đầu vào lộn xộn', () => {
    const sections = [section('bai-hat', 0)];
    const slides = [
      slide('hat-3', 'bai-hat', 2),
      slide('hat-1', 'bai-hat', 0),
      slide('hat-2', 'bai-hat', 1),
    ];
    expect(orderProgramSlides(sections, slides).map((s) => s.id)).toEqual([
      'hat-1',
      'hat-2',
      'hat-3',
    ]);
  });

  it('slide không thuộc mục nào (mục đã xóa) xếp cuối, giữ nguyên thứ tự', () => {
    const sections = [section('bai-hat', 0)];
    const slides = [
      slide('lac-1', 'muc-da-xoa', 0),
      slide('hat-1', 'bai-hat', 0),
      slide('lac-2', null, 0),
    ];
    expect(orderProgramSlides(sections, slides).map((s) => s.id)).toEqual([
      'hat-1',
      'lac-1',
      'lac-2',
    ]);
  });

  it('không làm thay đổi mảng đầu vào', () => {
    const sections = [section('bai-hat', 0)];
    const slides = [slide('hat-2', 'bai-hat', 1), slide('hat-1', 'bai-hat', 0)];
    const before = slides.map((s) => s.id);
    orderProgramSlides(sections, slides);
    expect(slides.map((s) => s.id)).toEqual(before);
  });
});
