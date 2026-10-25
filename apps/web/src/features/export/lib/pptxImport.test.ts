import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { extractPptxSlides } from './pptxImport';

const PRES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
  '<p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/><p:sldId id="258" r:id="rId4"/></p:sldIdLst></p:presentation>';
const PRELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>' +
  '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>' +
  '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide3.xml"/>' +
  '</Relationships>';
const SLIDE_TEXT =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
  '<p:cSld><p:spTree><p:sp><p:txBody>' +
  '<a:p><a:r><a:t>Hay tin cay Chua</a:t></a:r></a:p>' +
  '<a:p><a:r><a:t>Cau goc: Thi Thien 37:5</a:t></a:r></a:p>' +
  '</p:txBody></p:sp></p:spTree></p:cSld></p:sld>';
const SLIDE_IMAGE =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
  '<p:cSld><p:spTree><p:sp><p:spPr><a:blipFill><a:blip r:embed="rId2"/></a:blipFill></p:spPr></p:sp></p:spTree></p:cSld></p:sld>';
const SLIDE_IMAGE_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>' +
  '</Relationships>';
const SLIDE_EMPTY =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
  '<p:cSld><p:spTree/></p:cSld></p:sld>';
// PNG 1x1 trong suốt.
const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('extractPptxSlides', () => {
  it('slide chữ → text, slide hình → image, slide trống → bỏ qua', async () => {
    const zip = new JSZip();
    zip.file('ppt/presentation.xml', PRES);
    zip.file('ppt/_rels/presentation.xml.rels', PRELS);
    zip.file('ppt/slides/slide1.xml', SLIDE_TEXT);
    zip.file('ppt/slides/slide2.xml', SLIDE_IMAGE);
    zip.file('ppt/slides/_rels/slide2.xml.rels', SLIDE_IMAGE_RELS);
    zip.file('ppt/media/image1.png', PNG_1X1, { base64: true });
    zip.file('ppt/slides/slide3.xml', SLIDE_EMPTY);
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    const { slides, skipped } = await extractPptxSlides(buf as unknown as File);
    expect(slides).toHaveLength(2);
    expect(slides[0].text).toContain('Hay tin cay Chua');
    expect(slides[0].text).toContain('Cau goc: Thi Thien 37:5');
    expect(slides[0].image).toBeNull();
    expect(slides[1].text).toBeNull();
    expect(slides[1].image).toMatch(/^data:image\/png;base64,/);
    expect(skipped).toBe(1);
  });
});
