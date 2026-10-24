// Sao lưu / khôi phục JSON — logic thuần, test được bằng node.
import type { Program, Section, Slide } from '../../../lib/types';
import { downloadBlob, exportFilename, formatBytes } from './units';

export interface BackupAssetManifest {
  path: string;
  programId: string | null;
}

export interface BackupData {
  version: 1;
  exportedAt: string;
  app: 'tho-phuong-slide';
  program: Program;
  sections: Section[];
  slides: Slide[];
  assets_manifest: BackupAssetManifest[];
}

export interface ParsedBackup extends BackupData {
  warnings: string[];
}

const SUPPORTED_VERSION = 1;
const SIZE_WARNING_BYTES = 20 * 1024 * 1024; // 20MB

/** Tạo chuỗi JSON sao lưu (CONTRACT mục 7). */
export function exportBackupJSON(
  program: Program,
  sections: Section[],
  slides: Slide[],
  assetsManifest: BackupAssetManifest[] = [],
): string {
  const data: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: 'tho-phuong-slide',
    program: { ...program },
    sections: [...sections].sort((a, b) => a.order_index - b.order_index),
    slides: [...slides].sort((a, b) => a.order_index - b.order_index),
    assets_manifest: assetsManifest,
  };
  return JSON.stringify(data);
}

/** Tạo JSON và tải file `.tpsbackup.json` về máy (chạy trên browser). */
export function downloadBackupJSON(
  program: Program,
  sections: Section[],
  slides: Slide[],
  assetsManifest: BackupAssetManifest[] = [],
): void {
  const json = exportBackupJSON(program, sections, slides, assetsManifest);
  downloadBlob(new Blob([json], { type: 'application/json' }), exportFilename(program.title, 'tpsbackup.json'));
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Kiểm tra cấu trúc bản sao lưu. Ném Error với thông điệp tiếng Việt nếu sai định dạng. */
export function validateBackupData(raw: unknown): BackupData {
  if (!isObject(raw)) throw new Error('File không phải định dạng JSON hợp lệ.');
  if (raw.app !== 'tho-phuong-slide') {
    throw new Error('File không phải bản sao lưu của Thờ Phượng Slide.');
  }
  if (raw.version !== SUPPORTED_VERSION) {
    throw new Error(
      `Phiên bản sao lưu v${String(raw.version)} chưa được ứng dụng hỗ trợ (chỉ hỗ trợ v${SUPPORTED_VERSION}). ` +
        'Hãy xuất lại bản sao lưu từ phiên bản mới nhất của ứng dụng.',
    );
  }
  const program = raw.program;
  if (!isObject(program) || typeof program.id !== 'string' || typeof program.title !== 'string') {
    throw new Error('Bản sao lưu thiếu thông tin chương trình (program).');
  }
  if (!Array.isArray(raw.sections)) {
    throw new Error('Bản sao lưu thiếu danh sách các mục (sections).');
  }
  if (!Array.isArray(raw.slides)) {
    throw new Error('Bản sao lưu thiếu danh sách slide (slides).');
  }
  return {
    version: 1,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
    app: 'tho-phuong-slide',
    program: program as unknown as Program,
    sections: raw.sections as Section[],
    slides: raw.slides as Slide[],
    assets_manifest: Array.isArray(raw.assets_manifest)
      ? (raw.assets_manifest as BackupAssetManifest[])
      : [],
  };
}

/** Đọc và kiểm tra file `.tpsbackup.json` do người dùng chọn. */
export async function parseBackupFile(file: File): Promise<ParsedBackup> {
  const warnings: string[] = [];
  if (file.size > SIZE_WARNING_BYTES) {
    warnings.push(
      `File khá lớn (${formatBytes(file.size)}). Quá trình nhập có thể mất một lúc — hãy giữ nguyên trang này.`,
    );
  }
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new Error('File không phải định dạng JSON hợp lệ.');
  }
  return { ...validateBackupData(raw), warnings };
}
