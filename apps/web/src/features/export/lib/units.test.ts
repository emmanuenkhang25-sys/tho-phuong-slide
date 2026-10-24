import { describe, expect, it } from 'vitest';
import { asPptxBlob, PPTX_MIME } from './units';

describe('asPptxBlob', () => {
  it('blob dạng application/zip (kiểu PptxGenJS trả) được gói lại thành MIME PowerPoint', () => {
    const raw = new Blob(['PK\x03\x04fake-pptx'], { type: 'application/zip' });
    const out = asPptxBlob(raw);
    expect(out.type).toBe(PPTX_MIME);
    expect(out.size).toBe(raw.size);
  });

  it('nội dung byte không đổi sau khi gói lại', async () => {
    const raw = new Blob(['hello-pptx-bytes'], { type: 'application/zip' });
    const out = asPptxBlob(raw);
    expect(await out.text()).toBe('hello-pptx-bytes');
  });

  it('blob đã đúng MIME thì giữ nguyên', () => {
    const raw = new Blob(['x'], { type: PPTX_MIME });
    expect(asPptxBlob(raw).type).toBe(PPTX_MIME);
  });
});
