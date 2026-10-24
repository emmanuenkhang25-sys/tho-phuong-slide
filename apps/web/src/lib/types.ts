/**
 * TypeScript types chuẩn toàn dự án (CONTRACT mục 4).
 * File này do nhóm web-core tạo; các nhóm khác chỉ import, KHÔNG sửa.
 */

export type Role = 'owner' | 'admin' | 'editor' | 'presenter' | 'viewer';

export type AspectRatio = '16:9' | '4:3';

export type ProgramStatus = 'draft' | 'archived' | 'deleted';

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  is_platform_admin: boolean;
}

export interface Church {
  id: string;
  name: string;
  logo_url: string | null;
  avatar_url: string | null;
  contact_info: string | null;
  settings: Record<string, any>;
  created_by: string | null;
}

export interface ChurchMember {
  id: string;
  church_id: string;
  user_id: string;
  role: Role;
  joined_at: string;
  profile?: Profile;
}

export interface Program {
  id: string;
  church_id: string;
  title: string;
  event_date: string | null;
  start_time: string | null;
  leader: string | null;
  theme: string | null;
  theme_verse: string | null;
  notes: string | null;
  design_template: Record<string, any>;
  aspect_ratio: AspectRatio;
  status: ProgramStatus;
  is_favorite: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null; // xóa mềm (schema 3.4; dùng lọc danh sách)
}

export interface Section {
  id: string;
  program_id: string;
  title: string;
  kind: string;
  order_index: number;
}

/** Đối tượng trên slide — tọa độ % (0–100) so với slide (CONTRACT 3.6.1). */
export interface SlideObject {
  id: string; // uuid phía client
  type: 'text' | 'image' | 'shape' | 'video';
  x: number;
  y: number;
  w: number;
  h: number;
  z?: number;
  // text:
  text?: string;
  fontFamily?: string;
  fontSize?: number; // px ở slide 960px
  color?: string;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  lineHeight?: number;
  // image:
  src?: string; // program_assets.file_path hoặc dataURL (offline)
  // shape:
  shape?: 'rect' | 'ellipse' | 'line';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

/** Nền slide (CONTRACT 3.6.2). */
export interface SlideBackground {
  type: 'color' | 'image' | 'gradient';
  color?: string; // VD '#1e3a5f'
  image?: string; // file_path hoặc dataURL
  gradient?: { from: string; to: string; angle: number };
  overlayOpacity?: number; // 0–1 lớp phủ tối cho chữ dễ đọc
}

export interface Slide {
  id: string;
  program_id: string;
  section_id: string | null;
  order_index: number;
  content: { objects: SlideObject[] };
  background: SlideBackground;
}

export interface PresentSession {
  id: string;
  program_id: string;
  church_id: string;
  code: string;
  expires_at: string;
  current_slide: number;
  state: 'live' | 'paused' | 'blank' | 'ended';
}

export interface Invitation {
  id: string;
  church_id: string;
  email: string;
  role: Role;
  token: string;
  invited_by: string | null;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
  church?: Church;
}
