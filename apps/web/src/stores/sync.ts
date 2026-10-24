import { create } from 'zustand';

/**
 * Trạng thái đồng bộ/lưu (CONTRACT mục 11).
 * Editor/export cập nhật qua setStatus; Layout hiển thị chip.
 */
export type SyncStatusValue = 'dang-luu' | 'da-luu-may' | 'da-dong-bo' | 'ngoai-tuyen' | 'loi';

const DEFAULT_MESSAGES: Record<SyncStatusValue, string> = {
  'dang-luu': 'Đang lưu…',
  'da-luu-may': 'Đã lưu trên máy',
  'da-dong-bo': 'Đã lưu trên đám mây',
  'ngoai-tuyen': 'Ngoại tuyến — sẽ đồng bộ',
  loi: 'Lỗi đồng bộ',
};

interface SyncState {
  status: SyncStatusValue;
  message: string;
  setStatus: (s: SyncStatusValue, m?: string) => void;
}

export type { SyncState };

/**
 * Zustand store — vừa là hook () => SyncState (đúng CONTRACT mục 11),
 * vừa có .getState()/.setState() cho các nhóm khác dùng ngoài component.
 */
export const useSyncStatus = create<SyncState>((set) => ({
  status: 'da-dong-bo',
  message: DEFAULT_MESSAGES['da-dong-bo'],
  setStatus: (s, m) => set({ status: s, message: m ?? DEFAULT_MESSAGES[s] }),
}));
