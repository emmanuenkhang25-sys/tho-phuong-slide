// Unit test: src/features/export/lib/backup.ts
// Kiểm tra exportBackupJSON + validateBackupData + parseBackupFile với
// JSON đúng/sai/thiếu trường/sai app/version không hỗ trợ/file >20MB.
import { describe, expect, it } from 'vitest';
import type { Program, Section, Slide } from '../../../lib/types';
import {
  exportBackupJSON,
  parseBackupFile,
  validateBackupData,
} from './backup';

function makeProgram(over: Partial<Program> = {}): Program {
  return {
    id: 'prog-1',
    church_id: 'church-1',
    title: 'Chương trình test',
    event_date: '2026-10-25',
    start_time: '08:00',
    leader: 'Người phụ trách',
    theme: 'Chủ đề',
    theme_verse: 'Giăng 3:16',
    notes: 'ghi chú',
    design_template: {},
    aspect_ratio: '16:9',
    status: 'draft',
    is_favorite: false,
    created_by: null,
    updated_by: null,
    created_at: '2026-10-24T00:00:00Z',
    updated_at: '2026-10-24T00:00:00Z',
    deleted_at: null,
    ...over,
  };
}

function makeSection(id: string, order: number): Section {
  return { id, program_id: 'prog-1', title: 'Mục ' + id, kind: 'custom', order_index: order };
}

function makeSlide(id: string, order: number): Slide {
  return {
    id,
    program_id: 'prog-1',
    section_id: null,
    order_index: order,
    content: { objects: [{ id: 'o1', type: 'text', x: 10, y: 10, w: 80, h: 20, text: 'Xin chào' }] },
    background: { type: 'color', color: '#1e3a5f' },
  };
}

function backupJSON(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 1,
    exportedAt: '2026-10-24T00:00:00Z',
    app: 'tho-phuong-slide',
    program: makeProgram(),
    sections: [makeSection('s1', 0)],
    slides: [makeSlide('sl1', 0)],
    assets_manifest: [],
    ...over,
  });
}

function fileOf(text: string): File {
  return new File([text], 'test.tpsbackup.json', { type: 'application/json' });
}

describe('exportBackupJSON + validateBackupData (round-trip)', () => {
  it('xuất rồi đọc lại: giữ nguyên dữ liệu, sắp xếp theo order_index', () => {
    const json = exportBackupJSON(
      makeProgram(),
      [makeSection('s2', 1), makeSection('s1', 0)],
      [makeSlide('sl2', 1), makeSlide('sl1', 0)],
    );
    const parsed = validateBackupData(JSON.parse(json));
    expect(parsed.version).toBe(1);
    expect(parsed.app).toBe('tho-phuong-slide');
    expect(parsed.program.title).toBe('Chương trình test');
    expect(parsed.sections.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(parsed.slides.map((s) => s.id)).toEqual(['sl1', 'sl2']);
    expect(parsed.slides[0].content.objects[0].text).toBe('Xin chào');
  });
});

describe('parseBackupFile — file hợp lệ', () => {
  it('JSON đúng định dạng → parse thành công, không warning', async () => {
    const parsed = await parseBackupFile(fileOf(backupJSON()));
    expect(parsed.program.id).toBe('prog-1');
    expect(parsed.warnings).toHaveLength(0);
  });
});

describe('parseBackupFile — file lỗi', () => {
  it('chuỗi không phải JSON → báo "không phải định dạng JSON"', async () => {
    await expect(parseBackupFile(fileOf('không phải json {{{'))).rejects.toThrow(
      /không phải định dạng JSON/i,
    );
  });

  it('JSON nhưng không phải object (mảng) → báo lỗi', async () => {
    await expect(parseBackupFile(fileOf('[1,2,3]'))).rejects.toThrow();
  });

  it('sai app → báo "không phải bản sao lưu của Thờ Phượng Slide"', async () => {
    await expect(parseBackupFile(fileOf(backupJSON({ app: 'ung-dung-khac' })))).rejects.toThrow(
      /không phải bản sao lưu của Thờ Phượng Slide/i,
    );
  });

  it('version không hỗ trợ (v2) → báo lỗi version', async () => {
    await expect(parseBackupFile(fileOf(backupJSON({ version: 2 })))).rejects.toThrow(
      /chưa được ứng dụng hỗ trợ/i,
    );
  });

  it('thiếu program → báo lỗi', async () => {
    await expect(parseBackupFile(fileOf(backupJSON({ program: undefined })))).rejects.toThrow(
      /thiếu thông tin chương trình/i,
    );
  });

  it('thiếu sections → báo lỗi', async () => {
    const raw = JSON.parse(backupJSON());
    delete raw.sections;
    await expect(parseBackupFile(fileOf(JSON.stringify(raw)))).rejects.toThrow(
      /thiếu danh sách các mục/i,
    );
  });

  it('thiếu slides → báo lỗi', async () => {
    const raw = JSON.parse(backupJSON());
    delete raw.slides;
    await expect(parseBackupFile(fileOf(JSON.stringify(raw)))).rejects.toThrow(
      /thiếu danh sách slide/i,
    );
  });
});

describe('parseBackupFile — file >20MB', () => {
  it('vẫn parse được nhưng có cảnh báo "File khá lớn"', async () => {
    // Giả lập file >20MB: ghi đè thuộc tính size (nội dung đọc vẫn nhỏ nên test nhanh).
    // Hành vi kiểm tra: nhánh cảnh báo được kích hoạt khi file.size > 20*1024*1024.
    const f = fileOf(backupJSON());
    Object.defineProperty(f, 'size', { value: 21 * 1024 * 1024 });
    const parsed = await parseBackupFile(f);
    expect(parsed.program.id).toBe('prog-1');
    expect(parsed.warnings.length).toBeGreaterThan(0);
    expect(parsed.warnings.join(' ')).toMatch(/khá lớn/i);
  });
});
