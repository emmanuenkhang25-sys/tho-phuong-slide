// ============================================================================
// Thờ Phượng Slide — Hoàn tác chung (undo)
// Mọi thao tác thay đổi dữ liệu trong luồng đơn giản (danh sách, chương trình,
// sửa mục, thư viện) đều đẩy 1 mục hoàn tác vào đây sau khi thành công. Thanh
// Hoàn tác nổi luôn hiện mục gần nhất — bấm là đảo ngược đúng thao tác đó.
// Chỉ giữ 1 mức (thao tác gần nhất); thao tác mới thay thế thao tác cũ.
// seq tăng sau mỗi lần hoàn tác thành công để các trang danh sách tự tải lại.
// ============================================================================
import { create } from 'zustand';

/** Điều hướng mà mục hoàn tác được phép dùng (do UndoBar truyền vào). */
export interface UndoNav {
  go: (path: string) => void;
}

/** Một mục hoàn tác: nhãn mô tả thao tác vừa làm + hàm đảo ngược nó. */
export interface UndoEntry {
  /** Mô tả ngắn thao tác vừa làm, VD "Xóa chương trình “X”". */
  label: string;
  /** Đảo ngược thao tác; ném lỗi nếu không đảo được (mục được giữ để thử lại). */
  run: (nav: UndoNav) => Promise<void>;
  /** Gọi thêm khi người dùng bấm ✕ (VD: xóa ghi chú khôi phục khỏi localStorage). */
  onDismiss?: () => void;
}

interface UndoState {
  entry: UndoEntry | null;
  /** Tăng sau mỗi lần hoàn tác thành công — trang danh sách nghe số này để tải lại. */
  seq: number;
  undoing: boolean;
  push: (entry: UndoEntry) => void;
  clear: () => void;
  setUndoing: (undoing: boolean) => void;
  bump: () => void;
}

export const useUndoStore = create<UndoState>((set) => ({
  entry: null,
  seq: 0,
  undoing: false,
  push: (entry) => set({ entry }),
  clear: () => set({ entry: null }),
  setUndoing: (undoing) => set({ undoing }),
  bump: () => set((s) => ({ seq: s.seq + 1 })),
}));

/** Đẩy mục hoàn tác từ bất cứ đâu (kể cả ngoài component React). */
export function pushUndo(entry: UndoEntry): void {
  useUndoStore.getState().push(entry);
}
