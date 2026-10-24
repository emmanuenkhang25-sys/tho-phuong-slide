import type { Section, Slide } from './types';

/**
 * Thứ tự slide TOÀN chương trình: theo thứ tự MỤC trước, rồi thứ tự slide
 * trong từng mục.
 *
 * Lý do phải có hàm này: `order_index` của slide chỉ có nghĩa TRONG TỪNG
 * MỤC (mục nào cũng bắt đầu từ 0). Nếu gộp slide toàn chương trình rồi sắp
 * chỉ theo `order_index` của slide, các mục sẽ xen kẽ nhau: slide 1 của bài
 * hát, slide 1 của đọc Kinh Thánh, slide 2 của bài hát, slide 2 của đọc
 * Kinh Thánh... — sai thứ tự chương trình.
 *
 * Slide không thuộc mục nào (section_id null hoặc mục đã bị xóa) xếp cuối,
 * giữ nguyên thứ tự tương đối ban đầu.
 */
export function orderProgramSlides(sections: Section[], slides: Slide[]): Slide[] {
  const sectionRank = new Map<string, number>();
  [...sections]
    .sort((a, b) => a.order_index - b.order_index)
    .forEach((s, i) => sectionRank.set(s.id, i));
  const LAST = Number.MAX_SAFE_INTEGER;
  return [...slides]
    .map((slide, i) => ({ slide, i }))
    .sort((a, b) => {
      const ra = sectionRank.get(a.slide.section_id ?? '') ?? LAST;
      const rb = sectionRank.get(b.slide.section_id ?? '') ?? LAST;
      if (ra !== rb) return ra - rb;
      if (a.slide.order_index !== b.slide.order_index) {
        return a.slide.order_index - b.slide.order_index;
      }
      return a.i - b.i;
    })
    .map(({ slide }) => slide);
}
