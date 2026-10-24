// ============================================================
// Thờ Phượng Slide — nhóm EDITOR
// lib/split.ts — tự động chia bài hát / Kinh Thánh thành slide.
//
// NGUYÊN TẮC SẮT: giữ nguyên 100% nội dung người dùng —
// không viết lại, không sửa chính tả, không thêm bớt chữ.
// Chỉ cắt dòng trống đã có sẵn để chia đoạn, và chia đoạn
// thành các slide. (Ngoại lệ duy nhất: dòng nhãn "ĐK:"/"Điệp khúc:"
// được tách ra làm nhãn hiển thị, không nằm trong lời bài hát.)
// ============================================================
import type { SlideBackground, SlideObject } from '../../../lib/types';

/** SlideObject mở rộng cục bộ: cờ chorus để renderer/UI tô màu khác. */
export interface SplitSlideObject extends SlideObject {
  chorus?: boolean;
}

/** Bản nháp 1 slide do split tạo ra (chưa có id/program_id — EditorPage sẽ gán). */
export interface SlideDraft {
  objects: SplitSlideObject[];
  background: SlideBackground;
  /** Nhãn hiển thị trong modal preview: "Điệp khúc", "Câu 16–17", ... */
  label?: string;
}

export interface SplitLyricsOptions {
  /** Số dòng lời mỗi slide. Mặc định 4. */
  linesPerSlide?: number;
  /** Tiêu đề bài hát (hiển thị nhỏ trên mỗi slide). */
  title?: string;
  /** Tự lấy dòng đơn đầu tiên làm tiêu đề (mặc định true). */
  autoTitle?: boolean;
  /** Hiển thị nhãn "Điệp khúc" trên slide điệp khúc (mặc định true). */
  showSectionLabels?: boolean;
  /** Đánh dấu object text slide điệp khúc bằng cờ chorus (mặc định true). */
  highlightChorus?: boolean;
  /** Chèn lại toàn bộ slide điệp khúc sau mỗi đoạn thường (mặc định false). */
  repeatChorusAfterEachVerse?: boolean;
  /** Nền mặc định của chương trình — split dùng cho mọi slide tạo ra. */
  background?: SlideBackground;
}

export interface SplitBibleOptions {
  /** Số câu Kinh Thánh mỗi slide. Mặc định 2. */
  versesPerSlide?: number;
  /** VD "Giăng 3:16" — hiển thị nhỏ trên mỗi slide. */
  reference?: string;
  /** Giữ số câu trước mỗi câu (mặc định true). */
  showVerseNumbers?: boolean;
  background?: SlideBackground;
}

let idCounter = 0;
function genId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Nền dự phòng khi chương trình chưa có nền mặc định. */
export function defaultSplitBackground(): SlideBackground {
  return { type: 'color', color: '#1e3a5f', overlayOpacity: 0 };
}

// ------------------------------------------------------------
// Dùng chung
// ------------------------------------------------------------
function makeTitleObject(text: string): SplitSlideObject {
  return {
    id: genId('obj'), type: 'text',
    x: 8, y: 4, w: 84, h: 10, z: 10,
    text, fontFamily: 'Arial, sans-serif', fontSize: 30,
    color: '#ffffff', bold: true, italic: false,
    align: 'center', lineHeight: 1.3,
  };
}

function makeLabelObject(text: string): SplitSlideObject {
  return {
    id: genId('obj'), type: 'text',
    x: 8, y: 13, w: 84, h: 7, z: 10,
    text, fontFamily: 'Arial, sans-serif', fontSize: 24,
    color: '#fde68a', bold: false, italic: true,
    align: 'center', lineHeight: 1.3,
  };
}

function makeBodyObject(text: string, opts: { fontSize?: number; top?: number; chorus?: boolean } = {}): SplitSlideObject {
  return {
    id: genId('obj'), type: 'text',
    x: 6, y: opts.top ?? 22, w: 88, h: 72, z: 5,
    text, fontFamily: 'Arial, sans-serif', fontSize: opts.fontSize ?? 40,
    color: '#ffffff', bold: false, italic: false,
    align: 'center', lineHeight: 1.6,
    chorus: opts.chorus ? true : undefined,
  };
}

function cloneDraft(d: SlideDraft): SlideDraft {
  return {
    ...d,
    label: d.label,
    background: { ...d.background },
    objects: d.objects.map((o) => ({ ...o, id: genId('obj') })),
  };
}

// ------------------------------------------------------------
// splitLyrics
// ------------------------------------------------------------
interface LyricSegment {
  lines: string[];
  chorus: boolean;
}

/** Dòng nhãn điệp khúc: "ĐK", "ĐK:", "Điệp khúc", "Điệp khúc 2:", ... (không phân biệt hoa thường) */
const CHORUS_LABEL_RE = /^(đk|điệp khúc)\b[\s:.\-–]*\d*[\s:.\-–]*$/iu;
/** Dấu kết thúc câu — dùng để tránh cắt ngang câu giữa 2 slide. */
const END_PUNCT_RE = /[.,;:!?…)\]}"'”’]$/;
/** Dòng tiếp theo thuộc cùng câu nếu bắt đầu bằng chữ thường. */
const LOWER_START_RE = /^\p{Ll}/u;

function parseSegments(text: string): LyricSegment[] {
  const norm = text.replace(/\r\n?/g, '\n');
  return norm
    .split(/\n{2,}/)
    .map((block) =>
      block
        .split('\n')
        .map((l) => l.replace(/[ \t]+$/, ''))
        .filter((l) => l.trim() !== ''),
    )
    .filter((lines) => lines.length > 0)
    .map((lines) => {
      const chorus = CHORUS_LABEL_RE.test(lines[0].trim());
      // Tách dòng nhãn "ĐK:" ra khỏi lời (làm nhãn hiển thị, không tính là 1 dòng lời).
      const body = chorus ? lines.slice(1) : lines;
      return { lines: body.length > 0 ? body : lines, chorus };
    });
}

/**
 * Chia mảng dòng thành các cụm <= per dòng.
 * Tránh cắt ngang câu khi tránh được: nếu dòng cuối cụm không kết thúc
 * bằng dấu câu và dòng tiếp theo bắt đầu bằng chữ thường (cùng câu),
 * thì đẩy dòng đó sang cụm tiếp theo — nhưng mỗi cụm giữ lại ít nhất
 * ceil(per/2) dòng (giới hạn hợp lý, tránh cụm rỗng/dồn).
 */
function chunkLines(lines: string[], per: number): string[][] {
  const chunks: string[][] = [];
  const minKeep = Math.max(1, Math.ceil(per / 2));
  let i = 0;
  while (i < lines.length) {
    let end = Math.min(i + per, lines.length);
    while (
      end > i + minKeep &&
      end < lines.length &&
      !END_PUNCT_RE.test(lines[end - 1].trimEnd()) &&
      LOWER_START_RE.test(lines[end].trimStart())
    ) {
      end -= 1;
    }
    chunks.push(lines.slice(i, end));
    i = end;
  }
  return chunks;
}

export function splitLyrics(
  text: string,
  opts: SplitLyricsOptions = {},
): { title?: string; slides: SlideDraft[] } {
  const linesPerSlide = Math.max(1, Math.floor(opts.linesPerSlide ?? 4));
  const background = opts.background ?? defaultSplitBackground();
  const showLabels = opts.showSectionLabels !== false;
  const highlight = opts.highlightChorus !== false;

  const segments = parseSegments(text);
  if (segments.length === 0) return { title: opts.title, slides: [] };

  // Tiêu đề: ưu tiên opts.title; nếu không có và khối đầu chỉ có đúng 1 dòng
  // (không phải điệp khúc) thì lấy làm tiêu đề.
  let title = opts.title;
  let rest = segments;
  if (!title && opts.autoTitle !== false && segments.length > 1 &&
      segments[0].lines.length === 1 && !segments[0].chorus) {
    title = segments[0].lines[0].trim();
    rest = segments.slice(1);
  }

  const chorusSegs = rest.filter((s) => s.chorus);

  let verseNo = 0;
  const buildSlides = (seg: LyricSegment): SlideDraft[] => {
    const segNo = seg.chorus ? 0 : ++verseNo;
    const chunks = chunkLines(seg.lines, linesPerSlide);
    return chunks.map((chunk, ci) => {
      const objects: SplitSlideObject[] = [];
      if (title) objects.push(makeTitleObject(title));
      if (showLabels && seg.chorus) objects.push(makeLabelObject('Điệp khúc'));
      objects.push(
        makeBodyObject(chunk.join('\n'), {
          top: title ? 22 : 12,
          chorus: highlight && seg.chorus,
        }),
      );
      const multi = chunks.length > 1 ? ` (${ci + 1}/${chunks.length})` : '';
      return {
        objects,
        background: { ...background },
        label: seg.chorus ? `Điệp khúc${multi}` : `Đoạn ${segNo}${multi}`,
      };
    });
  };

  const slides: SlideDraft[] = [];
  for (const seg of rest) {
    slides.push(...buildSlides(seg));
    if (opts.repeatChorusAfterEachVerse && !seg.chorus && chorusSegs.length > 0) {
      for (const cs of chorusSegs) slides.push(...buildSlides(cs).map(cloneDraft));
    }
  }
  return { title, slides };
}

// ------------------------------------------------------------
// splitBible
// ------------------------------------------------------------
/** Đầu câu Kinh Thánh: số câu ở đầu dòng (hoặc đầu văn bản), theo sau là "." / ")" / khoảng trắng. */
const VERSE_RE = /(^|\n)[ \t]*(\d{1,3})(?:[.)][ \t]*|[ \t]+)/g;

interface Verse {
  n: number | null;
  text: string;
}

function parseVerses(text: string): Verse[] {
  const norm = text.replace(/\r\n?/g, '\n');
  const matches = [...norm.matchAll(VERSE_RE)];
  if (matches.length === 0) {
    const t = norm.trim();
    return t ? [{ n: null, text: t }] : [];
  }
  const verses: Verse[] = [];
  const preamble = norm.slice(0, matches[0].index ?? 0).trim();
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? norm.length) : norm.length;
    let vt = norm.slice(start, end).trim();
    // Giữ nguyên phần mở đầu (tên sách/chương) kèm vào câu đầu — không bỏ chữ nào.
    if (i === 0 && preamble) vt = `${preamble}\n${vt}`;
    verses.push({ n: parseInt(m[2], 10), text: vt });
  }
  return verses;
}

export function splitBible(
  text: string,
  opts: SplitBibleOptions = {},
): { title?: string; slides: SlideDraft[] } {
  const versesPerSlide = Math.max(1, Math.floor(opts.versesPerSlide ?? 2));
  const showNums = opts.showVerseNumbers !== false;
  const background = opts.background ?? defaultSplitBackground();

  const verses = parseVerses(text);
  if (verses.length === 0) return { title: opts.reference, slides: [] };

  const slides: SlideDraft[] = [];
  for (let i = 0; i < verses.length; i += versesPerSlide) {
    const group = verses.slice(i, i + versesPerSlide);
    // Mỗi câu là một khối nguyên vẹn — không bao giờ cắt ngang câu.
    const body = group
      .map((v) => (showNums && v.n != null ? `${v.n}. ${v.text}` : v.text))
      .join('\n\n');
    const objects: SplitSlideObject[] = [];
    if (opts.reference) objects.push(makeTitleObject(opts.reference));
    objects.push(makeBodyObject(body, { fontSize: 36, top: opts.reference ? 22 : 12 }));
    const nums = group.map((g) => g.n).filter((n): n is number => n != null);
    const range = nums.length > 0
      ? `câu ${nums[0]}${nums.length > 1 ? `–${nums[nums.length - 1]}` : ''}`
      : 'Kinh Thánh';
    slides.push({
      objects,
      background: { ...background },
      label: opts.reference ? `${opts.reference} • ${range}` : range,
    });
  }
  return { title: opts.reference, slides };
}

/** Preset cỡ chữ khi tách bài hát / Kinh Thánh (cho người lớn tuổi đọc rõ). */
export interface FontSizePreset {
  id: 'vua' | 'to' | 'cuc-to';
  label: string;
  /** Số dòng mỗi slide tương ứng. */
  linesPerSlide: number;
  /** Hệ số phóng to fontSize của object chữ. */
  fontScale: number;
}

export const FONT_SIZE_PRESETS: FontSizePreset[] = [
  { id: 'vua', label: 'Vừa', linesPerSlide: 4, fontScale: 1 },
  { id: 'to', label: 'To', linesPerSlide: 3, fontScale: 1.25 },
  { id: 'cuc-to', label: 'Cực to', linesPerSlide: 2, fontScale: 1.5 },
];

/** Phóng to cỡ chữ mọi object text trong các draft (giữ nguyên nội dung). */
export function scaleDraftFonts(drafts: SlideDraft[], scale: number): SlideDraft[] {
  if (scale === 1) return drafts;
  return drafts.map((d) => ({
    ...d,
    objects: d.objects.map((o) =>
      o.type === 'text' && o.fontSize ? { ...o, fontSize: Math.round(o.fontSize * scale) } : o,
    ),
  }));
}

export interface SplitPlainTextOptions {
  /** Số dòng tối đa mỗi slide. Mặc định 6. */
  maxLinesPerSlide?: number;
  /** Tiêu đề hiển thị nhỏ trên mỗi slide. */
  title?: string;
  /** Nền cho các slide tạo ra. */
  background?: SlideBackground;
}

/**
 * Tách văn bản thường (lời chào, lời cầu nguyện, thông báo...) thành slide.
 * - Giữ nguyên 100% nội dung, chỉ ngắt theo dòng trống có sẵn.
 * - Mỗi slide tối đa maxLinesPerSlide dòng, chữ căn giữa, cỡ 40px.
 */
export function splitPlainText(
  text: string,
  opts: SplitPlainTextOptions = {},
): { title?: string; slides: SlideDraft[] } {
  const maxLines = Math.max(1, Math.floor(opts.maxLinesPerSlide ?? 6));
  const background = opts.background ?? defaultSplitBackground();
  const rawLines = text.split('\n').map((l) => l.trimEnd());
  // Gom thành đoạn theo dòng trống; đoạn dài quá thì cắt theo dòng
  const paragraphs: string[] = [];
  let current: string[] = [];
  for (const line of rawLines) {
    if (line.trim() === '') {
      if (current.length > 0) {
        paragraphs.push(current.join('\n'));
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) paragraphs.push(current.join('\n'));
  if (paragraphs.length === 0) return { title: opts.title, slides: [] };

  // Cắt mỗi đoạn thành các cụm ≤ maxLines dòng
  const chunks: string[] = [];
  for (const para of paragraphs) {
    const lines = para.split('\n');
    for (let i = 0; i < lines.length; i += maxLines) {
      chunks.push(lines.slice(i, i + maxLines).join('\n'));
    }
  }
  // Gộp các cụm nhỏ liên tiếp cho đỡ vụn (tổng ≤ maxLines)
  const groups: string[] = [];
  let buf = '';
  let bufLines = 0;
  for (const chunk of chunks) {
    const n = chunk.split('\n').length;
    if (buf && bufLines + n > maxLines) {
      groups.push(buf);
      buf = '';
      bufLines = 0;
    }
    buf = buf ? buf + '\n\n' + chunk : chunk;
    bufLines += n;
  }
  if (buf) groups.push(buf);

  const slides: SlideDraft[] = groups.map((body, i) => {
    const objects: SplitSlideObject[] = [];
    if (opts.title) objects.push(makeTitleObject(opts.title));
    objects.push(makeBodyObject(body, { fontSize: 40, top: opts.title ? 16 : 22 }));
    return {
      objects,
      background: { ...background },
      label: `Phần ${i + 1}`,
    };
  });
  return { title: opts.title, slides };
}
