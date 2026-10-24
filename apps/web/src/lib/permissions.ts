import type { Role } from './types';

/**
 * Ma trận quyền chuẩn (CONTRACT mục 2).
 * owner=5 > admin=4 > editor=3 > presenter=2 > viewer=1 > none=0
 *
 * GHI CHÚ (từ nhóm DB): policy DELETE của bảng program_assets là editor+ (>=3),
 * nhất quán với policy xóa file trong bucket program-images (không phải admin+
 * như CONTRACT 3.14 ghi gộp). Không cần helper riêng cho asset — UI nút "Xóa ảnh"
 * chỉ hiển thị khi role >= editor (dùng canEditProgram).
 */

const RANK: Record<Role, number> = {
  owner: 5,
  admin: 4,
  editor: 3,
  presenter: 2,
  viewer: 1,
};

/** Nhãn tiếng Việt cho vai trò. */
export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Chủ sở hữu',
  admin: 'Quản trị viên',
  editor: 'Biên tập viên',
  presenter: 'Người trình chiếu',
  viewer: 'Người chỉ xem',
};

export function roleRank(r: string | null | undefined): number {
  if (!r) return 0;
  return RANK[r as Role] ?? 0;
}

/** myRole có đạt tối thiểu min hay không. */
export function hasRole(myRole: string | null | undefined, min: Role): boolean {
  return roleRank(myRole) >= roleRank(min);
}

/** Quản lý chương trình/slide/tài nguyên: editor trở lên (>=3). */
export function canEditProgram(myRole: string | null | undefined): boolean {
  return hasRole(myRole, 'editor');
}

/** Xóa chương trình: admin trở lên (>=4). */
export function canDeleteProgram(myRole: string | null | undefined): boolean {
  return hasRole(myRole, 'admin');
}

/** Quản lý thành viên / mời / thu hồi: admin trở lên (>=4). */
export function canManageMembers(myRole: string | null | undefined): boolean {
  return hasRole(myRole, 'admin');
}

/** Quản lý cài đặt hội thánh (tên, logo, liên hệ, settings): admin trở lên (>=4). */
export function canManageChurch(myRole: string | null | undefined): boolean {
  return hasRole(myRole, 'admin');
}

/** Mở & chạy trình chiếu, điều khiển từ xa: presenter trở lên (>=2). */
export function canPresent(myRole: string | null | undefined): boolean {
  return hasRole(myRole, 'presenter');
}

/** Xóa hội thánh / chuyển quyền sở hữu: chỉ owner (=5). */
export function isOwner(myRole: string | null | undefined): boolean {
  return myRole === 'owner';
}
