// ============================================================================
// Thờ Phượng Slide — nhập PowerPoint (chỉ lấy CHỮ)
// Đọc file .pptx (thực chất là file zip XML): theo thứ tự slide trong
// presentation.xml, trích các đoạn <a:t> trong từng slide thành text.
// Ảnh, nền, hiệu ứng, font gốc của PowerPoint KHÔNG mang theo được — slide
// nhập vào dùng nền + chữ chuẩn của app để chiếu đồng bộ.
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

export interface PptxImportResult {
  /** Text từng slide PowerPoint (mỗi phần tử = 1 slide, các đoạn nối bằng \n). */
  texts: string[];
  /** Số slide trống / không đọc được đã bỏ qua. */
  skipped: number;
}

/** Trích chữ từ file .pptx, giữ đúng thứ tự slide gốc. */
export async function extractPptxSlideTexts(file: File): Promise<PptxImportResult> {
  const zip = await JSZip.loadAsync(file);
  const presXml = await zip.file('ppt/presentation.xml')?.async('text');
  if (!presXml) {
    throw new Error('Không đọc được file PowerPoint này (thiếu presentation.xml).');
  }
  const relsXml = await zip.file('ppt/_rels/presentation.xml.rels')?.async('text');
  if (!relsXml) {
    throw new Error('Không đọc được file PowerPoint này (thiếu rels).');
  }
  // rId → file slide (Target thường là "slides/slide1.xml", tương đối so với ppt/).
  const relMap = new Map<string, string>();
  for (const m of relsXml.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    relMap.set(m[1], m[2]);
  }
  // Thứ tự slide theo <p:sldIdLst>.
  const order: string[] = [];
  const sldList = presXml.match(/<p:sldIdLst>([\s\S]*?)<\/p:sldIdLst>/);
  if (sldList) {
    for (const m of sldList[1].matchAll(/r:id="([^"]+)"/g)) order.push(m[1]);
  }
  if (order.length === 0) {
    throw new Error('File PowerPoint này không có slide nào.');
  }
  const texts: string[] = [];
  let skipped = 0;
  for (const rId of order) {
    const target = relMap.get(rId);
    if (!target) {
      skipped++;
      continue;
    }
    const normalized = target.replace(/^\//, '').replace(/^ppt\//, '');
    const slideFile = zip.file(`ppt/${normalized}`);
    if (!slideFile) {
      skipped++;
      continue;
    }
    const xml = await slideFile.async('text');
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
    if (text) texts.push(text);
    else skipped++;
  }
  return { texts, skipped };
}
