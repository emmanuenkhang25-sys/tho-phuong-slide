import type { SlideBackground, SlideObject } from '../../lib/types';

// ============================================================================
// THƯ VIỆN MẪU SLIDE — "Thờ Phượng Slide"
// ----------------------------------------------------------------------------
// QUY TẮC BẮT BUỘC: mẫu dùng gradient/color tự vẽ bằng CSS, TUYỆT ĐỐI KHÔNG
// hotlink ảnh ngoài (không dùng background type 'image' ở đây).
// ============================================================================

export interface TemplateGroupInfo {
  id: string;
  name: string;
  description: string;
}

export interface SlideTemplate {
  id: string;
  name: string;
  group: string; // TemplateGroupInfo.id
  aspect: '16:9' | '4:3';
  background: SlideBackground;
  sampleObjects: SlideObject[];
  /** màu chữ chính của mẫu — dùng khi "Áp dụng" để đổi màu chữ các slide */
  textColor: string;
}

export const TEMPLATE_GROUPS: TemplateGroupInfo[] = [
  { id: 'tho-phuong', name: 'Thờ phượng & ca ngợi', description: 'Mở đầu, hát thờ phượng, ngợi khen' },
  { id: 'cau-nguyen', name: 'Cầu nguyện', description: 'Giờ cầu nguyện chung, cầu thay' },
  { id: 'kinh-thanh', name: 'Kinh Thánh', description: 'Đọc Lời Chúa, câu gốc' },
  { id: 'bai-giang', name: 'Bài giảng', description: 'Sứ điệp, bài giảng Chúa nhật' },
  { id: 'dang-hien', name: 'Dâng hiến', description: 'Giờ dâng hiến, của lễ' },
  { id: 'tiec-thanh', name: 'Tiệc Thánh', description: 'Lễ Tiệc Thánh, tưởng nhớ Chúa' },
  { id: 'giang-sinh', name: 'Lễ Giáng Sinh', description: 'Mừng Chúa Giáng Sinh' },
  { id: 'phuc-sinh', name: 'Lễ Phục Sinh', description: 'Mừng Chúa sống lại' },
  { id: 'cam-ta', name: 'Lễ Cảm tạ', description: 'Lễ Tạ Ơn, mùa gặt' },
  { id: 'cuoi', name: 'Lễ cưới', description: 'Lễ thành hôn' },
  { id: 'tang', name: 'Lễ tang', description: 'Lễ tang, tưởng nhớ người quá cố' },
  { id: 'thanh-thieu-nien', name: 'Thanh thiếu niên', description: 'Sinh hoạt giới trẻ' },
  { id: 'thieu-nhi', name: 'Thiếu nhi', description: 'Thiếu nhi, ấu nhi' },
  { id: 'thong-bao', name: 'Thông báo Hội thánh', description: 'Thông báo, lịch sinh hoạt' },
];

// --- helper tạo object chữ mẫu (tọa độ %, fontSize tính theo slide 960px) ---
let seq = 0;
function txt(
  text: string,
  y: number,
  fontSize: number,
  opts: Partial<SlideObject> = {},
): SlideObject {
  return {
    id: `sample-${++seq}`,
    type: 'text',
    x: 8,
    y,
    w: 84,
    h: 20,
    text,
    fontSize,
    align: 'center',
    lineHeight: 1.25,
    ...opts,
  };
}

function grad(from: string, to: string, angle = 135): SlideBackground {
  return { type: 'gradient', gradient: { from, to, angle } };
}

function color(c: string): SlideBackground {
  return { type: 'color', color: c };
}

export const TEMPLATES: SlideTemplate[] = [
  // ================= 1. THỜ PHƯỢNG & CA NGỢI =================
  {
    id: 'tho-phuong-1', name: 'Tím thờ phượng', group: 'tho-phuong', aspect: '16:9',
    background: grad('#2b1055', '#7597de'), textColor: '#ffffff',
    sampleObjects: [
      txt('HÃY NGỢI KHEN CHÚA', 34, 64, { bold: true, color: '#ffffff' }),
      txt('Thi Thiên 150 — Hết thảy hơi thở hãy ngợi khen Đức Giê-hô-va!', 56, 30, { color: '#e8e4ff' }),
    ],
  },
  {
    id: 'tho-phuong-2', name: 'Bình minh ngợi khen', group: 'tho-phuong', aspect: '16:9',
    background: grad('#ff9966', '#ff5e62'), textColor: '#ffffff',
    sampleObjects: [
      txt('BUỔI SÁNG NGỢI KHEN', 34, 64, { bold: true, color: '#ffffff' }),
      txt('Thi Thiên 5:3 — Buổi sáng Ngài sẽ nghe tiếng tôi', 56, 30, { color: '#fff1e6' }),
    ],
  },
  {
    id: 'tho-phuong-3', name: 'Vàng vinh hiển', group: 'tho-phuong', aspect: '16:9',
    background: grad('#3a2b00', '#b8860b'), textColor: '#fff7dd',
    sampleObjects: [
      txt('VINH HIỂN CHO CHÚA', 34, 64, { bold: true, color: '#fff7dd' }),
      txt('Khải Huyền 4:11 — Chúa đáng được vinh hiển, tôn quý', 56, 30, { color: '#f3e3ac' }),
    ],
  },

  // ================= 2. CẦU NGUYỆN =================
  {
    id: 'cau-nguyen-1', name: 'Đêm cầu nguyện', group: 'cau-nguyen', aspect: '16:9',
    background: grad('#0f2027', '#203a43', 160), textColor: '#ffffff',
    sampleObjects: [
      txt('GIỜ CẦU NGUYỆN', 34, 64, { bold: true, color: '#ffffff' }),
      txt('Ma-thi-ơ 7:7 — Hãy xin, sẽ được; hãy tìm, sẽ gặp', 56, 30, { color: '#cfe3ea' }),
    ],
  },
  {
    id: 'cau-nguyen-2', name: 'Bình an buổi sớm', group: 'cau-nguyen', aspect: '16:9',
    background: grad('#a1c4fd', '#c2e9fb'), textColor: '#1e3a5f',
    sampleObjects: [
      txt('CẦU NGUYỆN BUỔI SÁNG', 34, 60, { bold: true, color: '#1e3a5f' }),
      txt('Thi Thiên 143:8 — Xin cho tôi nghe sự nhân từ Ngài buổi sáng', 56, 30, { color: '#2f5b8a' }),
    ],
  },

  // ================= 3. KINH THÁNH =================
  {
    id: 'kinh-thanh-1', name: 'Lời hằng sống', group: 'kinh-thanh', aspect: '16:9',
    background: grad('#3e2723', '#8d6e63'), textColor: '#fdf3d8',
    sampleObjects: [
      txt('LỜI CHÚA', 34, 72, { bold: true, color: '#fdf3d8' }),
      txt('Giăng 1:1 — Ban đầu có Ngôi Lời', 58, 30, { color: '#f0dfb8', italic: true }),
    ],
  },
  {
    id: 'kinh-thanh-2', name: 'Giấy da cổ', group: 'kinh-thanh', aspect: '16:9',
    background: grad('#f5e6c8', '#e0c285'), textColor: '#4a2f1b',
    sampleObjects: [
      txt('KINH THÁNH', 34, 72, { bold: true, color: '#4a2f1b' }),
      txt('Hê-bơ-rơ 4:12 — Lời Đức Chúa Trời là lời sống và linh nghiệm', 58, 28, { color: '#6b4423', italic: true }),
    ],
  },

  // ================= 4. BÀI GIẢNG =================
  {
    id: 'bai-giang-1', name: 'Bục giảng xanh', group: 'bai-giang', aspect: '16:9',
    background: grad('#1e3a5f', '#2c5f8a'), textColor: '#ffffff',
    sampleObjects: [
      txt('BÀI GIẢNG CHÚA NHẬT', 32, 64, { bold: true, color: '#ffffff' }),
      txt('Sứ điệp hôm nay', 54, 34, { color: '#d7e7f5' }),
      txt('9:00 sáng — Nhà thờ chính', 66, 24, { color: '#a9c6dd' }),
    ],
  },
  {
    id: 'bai-giang-2', name: 'Chân lý xanh lá', group: 'bai-giang', aspect: '16:9',
    background: grad('#134e5e', '#71b280'), textColor: '#ffffff',
    sampleObjects: [
      txt('SỨ ĐIỆP HÔM NAY', 34, 64, { bold: true, color: '#ffffff' }),
      txt('Rô-ma 1:16 — Tin Lành là quyền phép của Đức Chúa Trời', 56, 30, { color: '#eef7ee' }),
    ],
  },

  // ================= 5. DÂNG HIẾN =================
  {
    id: 'dang-hien-1', name: 'Dâng hiến vàng', group: 'dang-hien', aspect: '16:9',
    background: grad('#7a5c00', '#d4a017'), textColor: '#ffffff',
    sampleObjects: [
      txt('DÂNG HIẾN', 34, 72, { bold: true, color: '#ffffff' }),
      txt('2 Cô-rinh-tô 9:7 — Ai vui lòng mà dâng thì Đức Chúa Trời yêu', 58, 30, { color: '#fff3d1' }),
    ],
  },
  {
    id: 'dang-hien-2', name: 'Tấm lòng xanh', group: 'dang-hien', aspect: '16:9',
    background: grad('#1b5e20', '#43a047'), textColor: '#ffffff',
    sampleObjects: [
      txt('CỦA LỄ TÌNH YÊU', 34, 64, { bold: true, color: '#ffffff' }),
      txt('Châm Ngôn 3:9 — Hãy lấy tài vật và huê lợi đầu mùa mà tôn vinh Đức Giê-hô-va', 56, 28, { color: '#e8f5e9' }),
    ],
  },

  // ================= 6. TIỆC THÁNH =================
  {
    id: 'tiec-thanh-1', name: 'Tiệc Thánh đỏ thẫm', group: 'tiec-thanh', aspect: '16:9',
    background: grad('#4a0e0e', '#8b1a1a'), textColor: '#f7e8c9',
    sampleObjects: [
      txt('TIỆC THÁNH', 34, 72, { bold: true, color: '#f7e8c9' }),
      txt('1 Cô-rinh-tô 11:24 — Hãy làm điều này để nhớ đến Ta', 58, 30, { color: '#eed9ae', italic: true }),
    ],
  },
  {
    id: 'tiec-thanh-2', name: 'Tím tưởng niệm', group: 'tiec-thanh', aspect: '16:9',
    background: grad('#2d1b4e', '#5b3a8c'), textColor: '#ffffff',
    sampleObjects: [
      txt('TƯỞNG NHỚ CHÚA', 34, 64, { bold: true, color: '#ffffff' }),
      txt('Lu-ca 22:19 — Này là thân thể Ta, vì các ngươi mà phó cho', 56, 30, { color: '#ded2f5', italic: true }),
    ],
  },

  // ================= 7. LỄ GIÁNG SINH =================
  {
    id: 'giang-sinh-1', name: 'Đêm Giáng Sinh', group: 'giang-sinh', aspect: '16:9',
    background: grad('#0f3d2e', '#14532d'), textColor: '#ffe9a8',
    sampleObjects: [
      txt('MỪNG CHÚA GIÁNG SINH', 32, 60, { bold: true, color: '#ffe9a8' }),
      txt('Lu-ca 2:11 — Đấng Cứu Thế đã sinh cho các ngươi hôm nay', 56, 30, { color: '#f7e6bd' }),
    ],
  },
  {
    id: 'giang-sinh-2', name: 'Sao Bết-lê-hem', group: 'giang-sinh', aspect: '16:9',
    background: grad('#1a1a40', '#3d3d8c', 160), textColor: '#ffffff',
    sampleObjects: [
      txt('NGÔI SAO DẪN ĐƯỜNG', 34, 60, { bold: true, color: '#ffffff' }),
      txt('Ma-thi-ơ 2:10 — Thấy ngôi sao, họ mừng rỡ vô cùng', 56, 30, { color: '#d9d9f7' }),
    ],
  },
  {
    id: 'giang-sinh-3', name: 'Đỏ ấm áp', group: 'giang-sinh', aspect: '16:9',
    background: grad('#7f1d1d', '#b91c1c'), textColor: '#ffe9a8',
    sampleObjects: [
      txt('BÌNH AN CHO NHÂN LOẠI', 34, 60, { bold: true, color: '#ffe9a8' }),
      txt('Lu-ca 2:14 — Vinh danh Thiên Chúa trên trời, bình an dưới đất', 56, 28, { color: '#ffe4c4' }),
    ],
  },

  // ================= 8. LỄ PHỤC SINH =================
  {
    id: 'phuc-sinh-1', name: 'Bình minh Phục Sinh', group: 'phuc-sinh', aspect: '16:9',
    background: grad('#ff9a3c', '#ffd76e'), textColor: '#5b2d0e',
    sampleObjects: [
      txt('CHÚA ĐÃ SỐNG LẠI!', 34, 64, { bold: true, color: '#5b2d0e' }),
      txt('Ma-thi-ơ 28:6 — Ngài đã sống lại như lời Ngài đã phán', 56, 30, { color: '#7a3f12' }),
    ],
  },
  {
    id: 'phuc-sinh-2', name: 'Trời mới', group: 'phuc-sinh', aspect: '16:9',
    background: grad('#2193b0', '#6dd5ed'), textColor: '#0c3a4a',
    sampleObjects: [
      txt('ĐẤNG SỐNG ĐỜI ĐỜI', 34, 64, { bold: true, color: '#0c3a4a' }),
      txt('Khải Huyền 1:18 — Ta là Đấng Sống, Ta đã chết, nay Ta sống đời đời', 56, 28, { color: '#155a70' }),
    ],
  },

  // ================= 9. LỄ CẢM TẠ =================
  {
    id: 'cam-ta-1', name: 'Mùa gặt', group: 'cam-ta', aspect: '16:9',
    background: grad('#a16207', '#d97706'), textColor: '#ffffff',
    sampleObjects: [
      txt('LỄ CẢM TẠ', 34, 72, { bold: true, color: '#ffffff' }),
      txt('Thi Thiên 100:4 — Hãy cảm tạ mà vào các cửa Ngài', 58, 30, { color: '#ffedd5' }),
    ],
  },
  {
    id: 'cam-ta-2', name: 'Thu vàng', group: 'cam-ta', aspect: '16:9',
    background: grad('#7c2d12', '#c2410c'), textColor: '#ffedd5',
    sampleObjects: [
      txt('TẠ ƠN CHÚA', 34, 72, { bold: true, color: '#ffedd5' }),
      txt('1 Tê-sa-lô-ni-ca 5:18 — Trong mọi sự hãy tạ ơn', 58, 30, { color: '#fed7aa' }),
    ],
  },

  // ================= 10. LỄ CƯỚI =================
  {
    id: 'cuoi-1', name: 'Hồng hạnh phúc', group: 'cuoi', aspect: '16:9',
    background: grad('#fbc2eb', '#fde8f0'), textColor: '#7c2d52',
    sampleObjects: [
      txt('LỄ THÀNH HÔN', 34, 64, { bold: true, color: '#7c2d52' }),
      txt('Sáng Thế Ký 2:24 — Người nam sẽ lìa cha mẹ mà gắn bó với vợ mình', 56, 28, { color: '#9d4a70' }),
    ],
  },
  {
    id: 'cuoi-2', name: 'Sâm panh', group: 'cuoi', aspect: '16:9',
    background: grad('#fff7d6', '#f3d27a'), textColor: '#6b4a00',
    sampleObjects: [
      txt('TRĂM NĂM HẠNH PHÚC', 34, 60, { bold: true, color: '#6b4a00' }),
      txt('Truyền Đạo 4:9 — Hai người hơn một, vì họ được công giá tốt về công việc', 56, 28, { color: '#8a6100' }),
    ],
  },

  // ================= 11. LỄ TANG =================
  {
    id: 'tang-1', name: 'Tưởng nhớ', group: 'tang', aspect: '16:9',
    background: grad('#334155', '#64748b', 160), textColor: '#f1f5f9',
    sampleObjects: [
      txt('LỄ TANG', 34, 72, { bold: true, color: '#f1f5f9' }),
      txt('Giăng 11:25 — Ta là sự sống lại và sự sống', 58, 30, { color: '#cbd5e1', italic: true }),
    ],
  },
  {
    id: 'tang-2', name: 'Bình an vĩnh cửu', group: 'tang', aspect: '16:9',
    background: grad('#1e293b', '#475569', 160), textColor: '#e2e8f0',
    sampleObjects: [
      txt('AN NGHỈ TRONG CHÚA', 34, 64, { bold: true, color: '#e2e8f0' }),
      txt('Khải Huyền 14:13 — Phước cho những người chết trong Chúa', 56, 30, { color: '#c3cfdd', italic: true }),
    ],
  },

  // ================= 12. THANH THIẾU NIÊN =================
  {
    id: 'thanh-thieu-nien-1', name: 'Năng động xanh', group: 'thanh-thieu-nien', aspect: '16:9',
    background: grad('#00c6ff', '#0072ff'), textColor: '#ffffff',
    sampleObjects: [
      txt('THANH NIÊN VUI KHỎE', 34, 60, { bold: true, color: '#ffffff' }),
      txt('1 Ti-mô-thê 4:12 — Hãy làm gương cho các tín đồ', 56, 30, { color: '#e3f4ff' }),
    ],
  },
  {
    id: 'thanh-thieu-nien-2', name: 'Bứt phá tím hồng', group: 'thanh-thieu-nien', aspect: '16:9',
    background: grad('#7b2ff7', '#f107a3'), textColor: '#ffffff',
    sampleObjects: [
      txt('TUỔI TRẺ CHO CHÚA', 34, 60, { bold: true, color: '#ffffff' }),
      txt('Truyền Đạo 12:1 — Hãy nhớ Đấng Tạo Hóa trong buổi còn thơ ấu', 56, 28, { color: '#fbe3f2' }),
    ],
  },

  // ================= 13. THIẾU NHI =================
  {
    id: 'thieu-nhi-1', name: 'Vui nhộn', group: 'thieu-nhi', aspect: '16:9',
    background: grad('#ffe259', '#ffa751'), textColor: '#5b3000',
    sampleObjects: [
      txt('THIẾU NHI VUI HỌC', 34, 60, { bold: true, color: '#5b3000' }),
      txt('Châm Ngôn 22:6 — Hãy dạy cho trẻ thơ con đường nó phải theo', 56, 28, { color: '#7a4300' }),
    ],
  },
  {
    id: 'thieu-nhi-2', name: 'Bầu trời bé', group: 'thieu-nhi', aspect: '16:9',
    background: grad('#89f7fe', '#66a6ff'), textColor: '#0b3b66',
    sampleObjects: [
      txt('EM BÉ NGOAN', 34, 64, { bold: true, color: '#0b3b66' }),
      txt('Ma-thi-ơ 19:14 — Hãy để con trẻ đến cùng Ta', 56, 30, { color: '#155a8a' }),
    ],
  },

  // ================= 14. THÔNG BÁO HỘI THÁNH =================
  {
    id: 'thong-bao-1', name: 'Thông báo xanh', group: 'thong-bao', aspect: '16:9',
    background: grad('#1d4ed8', '#3b82f6'), textColor: '#ffffff',
    sampleObjects: [
      txt('THÔNG BÁO', 34, 72, { bold: true, color: '#ffffff' }),
      txt('Hội thánh — Chúa nhật này', 58, 30, { color: '#dbeafe' }),
    ],
  },
  {
    id: 'thong-bao-2', name: 'Thông báo sáng', group: 'thong-bao', aspect: '4:3',
    background: grad('#f8fafc', '#dbe3ec'), textColor: '#1e293b',
    sampleObjects: [
      txt('LỊCH SINH HOẠT', 34, 64, { bold: true, color: '#1e293b' }),
      txt('Tuần này tại Hội thánh', 56, 30, { color: '#475569' }),
    ],
  },
  {
    id: 'thong-bao-3', name: 'Thông báo tối', group: 'thong-bao', aspect: '4:3',
    background: color('#111827'), textColor: '#f9fafb',
    sampleObjects: [
      txt('NHẮC NHỞ', 34, 72, { bold: true, color: '#f9fafb' }),
      txt('Xin đến đúng giờ — Cảm ơn Hội thánh', 58, 30, { color: '#d1d5db' }),
    ],
  },
];

// ============================================================================
// MẪU RIÊNG CỦA HỘI THÁNH — lưu trên máy (localStorage), chưa đồng bộ đám mây.
// Nhóm editor sẽ gọi saveChurchTemplate() từ trang biên tập ("Lưu thiết kế
// hiện tại làm mẫu"); TemplatesPage quản lý: xem / áp dụng / xóa.
// ============================================================================

export interface ChurchTemplateDesign {
  background: SlideBackground;
  textColor: string;
  sampleObjects: SlideObject[];
}

export interface ChurchTemplate extends ChurchTemplateDesign {
  id: string;
  name: string;
  churchId: string;
  createdAt: string;
}

function churchTemplateKey(churchId: string): string {
  return `tps:templates:${churchId}`;
}

function readChurchTemplates(churchId: string): ChurchTemplate[] {
  try {
    const raw = localStorage.getItem(churchTemplateKey(churchId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeChurchTemplates(churchId: string, list: ChurchTemplate[]): void {
  try {
    localStorage.setItem(churchTemplateKey(churchId), JSON.stringify(list));
  } catch {
    // localStorage đầy hoặc bị chặn — bỏ qua, UI sẽ báo
  }
}

/** Lưu thiết kế hiện tại làm mẫu riêng của hội thánh (trên máy này). */
export function saveChurchTemplate(
  churchId: string,
  name: string,
  design: ChurchTemplateDesign,
): ChurchTemplate {
  const tpl: ChurchTemplate = {
    id: `church-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    name: name.trim() || 'Mẫu của Hội thánh',
    churchId,
    background: design.background,
    textColor: design.textColor,
    sampleObjects: design.sampleObjects,
    createdAt: new Date().toISOString(),
  };
  const list = readChurchTemplates(churchId);
  list.unshift(tpl);
  writeChurchTemplates(churchId, list);
  return tpl;
}

/** Lấy danh sách mẫu riêng của hội thánh (trên máy này). */
export function getChurchTemplates(churchId: string): ChurchTemplate[] {
  return readChurchTemplates(churchId);
}

/** Xóa một mẫu riêng của hội thánh. */
export function deleteChurchTemplate(churchId: string, templateId: string): void {
  const list = readChurchTemplates(churchId).filter((t) => t.id !== templateId);
  writeChurchTemplates(churchId, list);
}

/** Đổi mẫu riêng của hội thánh thành SlideTemplate để tái dùng luồng "Áp dụng". */
export function churchTemplateToSlideTemplate(t: ChurchTemplate): SlideTemplate {
  return {
    id: t.id,
    name: t.name,
    group: 'church',
    aspect: '16:9',
    background: t.background,
    sampleObjects: t.sampleObjects,
    textColor: t.textColor,
  };
}
