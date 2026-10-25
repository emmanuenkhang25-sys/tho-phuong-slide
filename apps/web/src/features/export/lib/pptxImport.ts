// ============================================================================
// Thờ Phượng Slide — nhập PowerPoint
// Đọc file .pptx (thực chất là file zip XML), giữ đúng thứ tự slide gốc.
// Mỗi slide cho ra:
//   - text: các đoạn <a:t> nối bằng \n (null nếu slide không có chữ),
//   - image: ảnh đầu tiên trên slide, dạng dataURL gốc (null nếu không có ảnh).
// Slide chỉ có hình (chữ nằm chết trong hình — dạng bài giảng làm bằng Canva
// hay PowerPoint xuất hình) vẫn nhập được nguyên hình làm nền slide.
// Ảnh nền, hiệu ứng, font gốc của PowerPoint KHÔNG mang theo được.
// ============================================================================
import JSZip from 'jszip';

/** Giải mã thực thể XML (&amp; &lt; &#x..; …) — &amp; giải cuối cùng. */
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&');
}

/** Giải đường dẫn tương đối trong zip (VD: ppt/slides/ + ../media/a.png → ppt/media/a.png). */
function resolveZipPath(baseDir: string, target: string): string {
  if (target.startsWith('/')) return target.replace(/^\//, '');
  const parts = (baseDir + target).split('/');
  const out: string[] = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p !== '.' && p !== '') out.push(p);
  }
  return out.join('/');
}

/** Đọc bảng quan hệ Id → Target từ một file .rels (không phụ thuộc thứ tự thuộc tính). */
function parseRels(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const tag of xml.matchAll(/<Relationship[^>]*>/g)) {
    const id = tag[0].match(/\bId="([^"]+)"/)?.[1];
    const target = tag[0].match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) map.set(id, target);
  }
  return map;
}

function mimeForMedia(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'bmp':
      return 'image/bmp';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'image/png';
  }
}

/** Chữ trên một slide (các đoạn nối bằng \n), null nếu slide không có chữ. */
function slideText(xml: string): string | null {
  const paras: string[] = [];
  for (const pm of xml.matchAll(/<a:p(?:\s[^>]*)?>([\s\S]*?)<\/a:p>/g)) {
    const runs: string[] = [];
    for (const tm of pm[1].matchAll(/<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g)) {
      runs.push(decodeXmlEntities(tm[1]));
    }
    const line = runs.join('').trim();
    if (line) paras.push(line);
  }
  const text = paras.join('\n');
  return text || null;
}

export interface PptxSlideImport {
  /** Chữ trên slide (null nếu slide không có chữ). */
  text: string | null;
  /** Ảnh đầu tiên trên slide, dạng dataURL gốc (null nếu không có ảnh). */
  image: string | null;
}

export interface PptxImportResult {
  slides: PptxSlideImport[];
  /** Số slide không chữ không ảnh đã bỏ qua. */
  skipped: number;
}

/** Trích chữ + ảnh từ file .pptx, giữ đúng thứ tự slide gốc. */
export async function extractPptxSlides(file: File): Promise<PptxImportResult> {
  const zip = await JSZip.loadAsync(file);
  const presXml = await zip.file('ppt/presentation.xml')?.async('text');
  if (!presXml) {
    throw new Error('Không đọc được file PowerPoint này (thiếu presentation.xml).');
  }
  const relsXml = await zip.file('ppt/_rels/presentation.xml.rels')?.async('text');
  if (!relsXml) {
    throw new Error('Không đọc được file PowerPoint này (thiếu rels).');
  }
  const relMap = parseRels(relsXml);
  // Thứ tự slide theo <p:sldIdLst>.
  const order: string[] = [];
  const sldList = presXml.match(/<p:sldIdLst>([\s\S]*?)<\/p:sldIdLst>/);
  if (sldList) {
    for (const m of sldList[1].matchAll(/r:id="([^"]+)"/g)) order.push(m[1]);
  }
  if (order.length === 0) {
    throw new Error('File PowerPoint này không có slide nào.');
  }
  const slides: PptxSlideImport[] = [];
  let skipped = 0;
  for (const rId of order) {
    const target = relMap.get(rId);
    if (!target) {
      skipped++;
      continue;
    }
    const slidePath = resolveZipPath('ppt/', target);
    const slideFile = zip.file(slidePath);
    if (!slideFile) {
      skipped++;
      continue;
    }
    const xml = await slideFile.async('text');
    const text = slideText(xml);
    // Ảnh đầu tiên trên slide (thường là hình nền tràn slide).
    let image: string | null = null;
    const blip = xml.match(/<a:blip[^>]*\br:embed="([^"]+)"/);
    if (blip) {
      const slideDir = slidePath.slice(0, slidePath.lastIndexOf('/') + 1);
      const slideRelsPath = `${slideDir}_rels/${slidePath.slice(slideDir.length)}.rels`;
      const slideRelsXml = await zip.file(slideRelsPath)?.async('text');
      if (slideRelsXml) {
        const mediaTarget = parseRels(slideRelsXml).get(blip[1]);
        if (mediaTarget) {
          const media = zip.file(resolveZipPath(slideDir, mediaTarget));
          if (media) {
            const b64 = await media.async('base64');
            image = `data:${mimeForMedia(mediaTarget)};base64,${b64}`;
          }
        }
      }
    }
    if (!text && !image) {
      skipped++;
      continue;
    }
    slides.push({ text, image });
  }
  return { slides, skipped };
}
