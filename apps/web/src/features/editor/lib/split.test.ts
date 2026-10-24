// Unit test: src/features/editor/lib/split.ts
// Nguyên tắc kiểm tra: giữ nguyên 100% nội dung (từng ký tự, trừ dòng nhãn ĐK),
// không cắt ngang câu khi tránh được, nhận diện điệp khúc, đánh số câu Kinh Thánh.
import { describe, expect, it } from 'vitest';
import { splitBible, splitLyrics } from './split';

/** Gom toàn bộ text trong các object text của các slide thành 1 chuỗi. */
function allBodyText(slides: { objects: { type: string; text?: string }[] }[]): string {
  return slides
    .map((s) => s.objects.filter((o) => o.type === 'text' && o.text).map((o) => o.text as string).join('\n'))
    .join('\n');
}

describe('splitLyrics', () => {
  it('giữ nguyên từng ký tự: mọi dòng lời đều xuất hiện đúng chữ trong output', () => {
    const input =
      'Chúa ôi yêu con dường bao\n' +
      'Tình Ngài cao sâu biết bao\n\n' +
      'Con nguyện dâng trọn cuộc đời,\n' +
      'Ngợi khen danh Chúa muôn đời.';
    const { slides } = splitLyrics(input, { autoTitle: false });
    const out = allBodyText(slides);
    for (const line of input.split('\n').filter((l) => l.trim() !== '')) {
      expect(out).toContain(line);
    }
  });

  it('chia đúng số slide theo linesPerSlide', () => {
    // Mỗi dòng kết thúc bằng dấu câu → heuristic "không cắt ngang câu" không dịch chuyển.
    const input = ['Dòng một.', 'Dòng hai.', 'Dòng ba.', 'Dòng bốn.', 'Dòng năm.'].join('\n');
    const { slides } = splitLyrics(input, { autoTitle: false, linesPerSlide: 2 });
    expect(slides.length).toBe(3);
  });

  it('không cắt ngang câu: dòng tiếp theo viết thường thuộc cùng câu thì không tách', () => {
    // "Dòng hai vẫn tiếp / đang tiếp tục câu này," là một câu — không được tách đôi.
    const input =
      'Đoạn một dòng một.\n' +
      'Dòng hai vẫn tiếp\n' +
      'đang tiếp tục câu này,\n' +
      'Đoạn một dòng bốn.';
    const { slides } = splitLyrics(input, { autoTitle: false, linesPerSlide: 2 });
    const texts = slides.map((s) =>
      s.objects.filter((o) => o.type === 'text').map((o) => o.text).join('\n'),
    );
    // Hai dòng của cùng một câu phải nằm chung 1 slide.
    const together = texts.some(
      (t) => t.includes('Dòng hai vẫn tiếp') && t.includes('đang tiếp tục câu này,'),
    );
    expect(together).toBe(true);
  });

  it('nhận diện điệp khúc: dòng "ĐK:" làm nhãn, không nằm trong lời', () => {
    const input =
      'ĐK:\n' +
      'Hát vang danh Ngài\n' +
      'Hát vang danh Ngài\n\n' +
      'Đoạn thường một dòng';
    const { slides } = splitLyrics(input, { autoTitle: false, showSectionLabels: true });
    const chorus = slides.find((s) => s.label === 'Điệp khúc');
    expect(chorus).toBeDefined();
    const bodyText = allBodyText([chorus!]);
    expect(bodyText).toContain('Hát vang danh Ngài');
    expect(bodyText).not.toContain('ĐK:');
    // Cờ chorus trên object text để UI tô màu khác.
    expect(chorus!.objects.some((o) => (o as { chorus?: boolean }).chorus === true)).toBe(true);
  });

  it('tùy chọn repeatChorusAfterEachVerse chèn lại điệp khúc sau mỗi đoạn thường', () => {
    const input = 'ĐK:\nĐiệp khúc đây\n\nĐoạn một\n\nĐoạn hai';
    const { slides } = splitLyrics(input, { autoTitle: false, repeatChorusAfterEachVerse: true });
    const labels = slides.map((s) => s.label);
    // thứ tự: ĐK, Đoạn 1, ĐK (lặp), Đoạn 2, ĐK (lặp)
    expect(labels.filter((l) => l === 'Điệp khúc').length).toBe(3);
    expect(labels.filter((l) => l?.startsWith('Đoạn')).length).toBe(2);
    expect(labels[1]).toBe('Đoạn 1');
  });

  it('autoTitle: khối đầu 1 dòng được lấy làm tiêu đề slide', () => {
    const input = 'Tôn Vinh Chúa\n\nDòng lời một\nDòng lời hai';
    const { title, slides } = splitLyrics(input);
    expect(title).toBe('Tôn Vinh Chúa');
    const out = allBodyText(slides);
    // Tiêu đề nằm trong object tiêu đề (không phải body lời), nhưng vẫn hiện trên slide.
    expect(out).toContain('Tôn Vinh Chúa');
    expect(out).toContain('Dòng lời một');
  });

  it('input rỗng → không có slide', () => {
    expect(splitLyrics('   \n\n  ').slides).toHaveLength(0);
  });
});

describe('splitBible', () => {
  const BIBLE =
    '16 Vì Đức Chúa Trời yêu thương thế gian, đến nỗi đã ban Con Một của Ngài.\n' +
    '17 Hầu cho hễ ai tin Con ấy không bị hư mất.\n' +
    '18 Mà được sự sống đời đời.';

  it('đánh số câu và không bao giờ cắt ngang câu', () => {
    const { slides } = splitBible(BIBLE, { versesPerSlide: 2 });
    expect(slides).toHaveLength(2);
    const s1 = allBodyText([slides[0]]);
    const s2 = allBodyText([slides[1]]);
    expect(s1).toContain('16. Vì Đức Chúa Trời yêu thương thế gian');
    expect(s1).toContain('17. Hầu cho hễ ai tin Con ấy không bị hư mất.');
    // Câu 17 nằm nguyên trong slide 1 (không tách nửa câu).
    expect(s2).not.toContain('Hầu cho hễ ai tin');
    expect(s2).toContain('18. Mà được sự sống đời đời.');
  });

  it('nhãn slide ghi đúng khoảng câu', () => {
    const { slides } = splitBible(BIBLE, { versesPerSlide: 2 });
    expect(slides[0].label).toBe('câu 16–17');
    expect(slides[1].label).toBe('câu 18');
  });

  it('reference: hiển thị trên mọi slide và trong nhãn', () => {
    const { slides, title } = splitBible(BIBLE, { reference: 'Giăng 3:16' });
    expect(title).toBe('Giăng 3:16');
    expect(slides[0].label).toContain('Giăng 3:16');
    expect(allBodyText([slides[0]])).toContain('Giăng 3:16');
  });

  it('giữ nguyên từng ký tự của bản văn (trừ số câu được gắn nhãn)', () => {
    const { slides } = splitBible(BIBLE, { versesPerSlide: 3 });
    const out = allBodyText(slides);
    for (const verseText of [
      'Vì Đức Chúa Trời yêu thương thế gian, đến nỗi đã ban Con Một của Ngài.',
      'Hầu cho hễ ai tin Con ấy không bị hư mất.',
      'Mà được sự sống đời đời.',
    ]) {
      expect(out).toContain(verseText);
    }
  });

  it('showVerseNumbers=false → không gắn số câu', () => {
    const { slides } = splitBible(BIBLE, { versesPerSlide: 1, showVerseNumbers: false });
    const out = allBodyText([slides[0]]);
    expect(out).toContain('Vì Đức Chúa Trời yêu thương thế gian');
    expect(out.startsWith('16')).toBe(false);
  });

  it('văn bản không có số câu → 1 khối nguyên vẹn', () => {
    const { slides } = splitBible('Nguyện xin ân điển ở cùng anh em.');
    expect(slides).toHaveLength(1);
    expect(allBodyText(slides)).toContain('Nguyện xin ân điển ở cùng anh em.');
    expect(slides[0].label).toBe('Kinh Thánh');
  });

  it('input rỗng → không có slide', () => {
    expect(splitBible('  \n ').slides).toHaveLength(0);
  });
});
