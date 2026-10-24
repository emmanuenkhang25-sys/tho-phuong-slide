// ============================================================================
// Thờ Phượng Slide — giao diện đơn giản (mobile-first)
// sectionForms.ts — cấu hình màn hình sửa theo từng loại mục.
// Mỗi loại mục chỉ hiện đúng các ô nhập cần thiết, không rườm rà.
// ============================================================================

export type SectionEditorType = 'lyrics' | 'bible' | 'sermon' | 'text';

/** kind → loại trình sửa. kind lạ → 'text'. */
export function sectionEditorType(kind: string): SectionEditorType {
  if (
    kind === 'ton-vinh-chua' ||
    kind === 'ton-vinh-chua-2' ||
    kind === 'dap-ung-loi-chua' ||
    kind === 'hat-tho-phuong' ||
    kind === 'thanh-ca'
  )
    return 'lyrics';
  if (kind === 'doc-kinh-thanh' || kind === 'kinh-thanh') return 'bible';
  if (kind === 'giang-loi-chua' || kind === 'bai-giang') return 'sermon';
  return 'text';
}

export interface SectionFormHint {
  /** Tiêu đề gợi ý trên màn hình sửa. */
  heading: string;
  /** Gợi ý ngắn dưới tiêu đề. */
  hint: string;
  /** Placeholder cho ô nội dung chính. */
  contentPlaceholder: string;
}

/** Gợi ý theo loại mục — ví dụ trong spec của người dùng. */
export function sectionFormHint(kind: string): SectionFormHint {
  switch (kind) {
    case 'chao-mung':
      return {
        heading: 'Lời chào mừng',
        hint: 'Nhập lời dẫn chào mừng hội chúng.',
        contentPlaceholder: 'Ví dụ: Kính chào quý tôi con Chúa...',
      };
    case 'ton-vinh-chua':
    case 'ton-vinh-chua-2':
    case 'hat-tho-phuong':
    case 'thanh-ca':
      return {
        heading: 'Bài hát ngợi khen',
        hint: 'Nhập tên bài hát rồi dán toàn bộ lời — app tự chia thành từng slide.',
        contentPlaceholder: 'Dán lời bài hát vào đây…',
      };
    case 'dap-ung-loi-chua':
      return {
        heading: 'Bài hát đáp ứng',
        hint: 'Nhập tên bài hát đáp ứng rồi dán toàn bộ lời.',
        contentPlaceholder: 'Dán lời bài hát đáp ứng vào đây…',
      };
    case 'cau-nguyen-khai-le':
      return {
        heading: 'Lời cầu nguyện khai lễ',
        hint: 'Nhập lời cầu nguyện mở đầu buổi lễ.',
        contentPlaceholder: 'Nhập lời cầu nguyện khai lễ…',
      };
    case 'doc-kinh-thanh':
    case 'kinh-thanh':
      return {
        heading: 'Đoạn Kinh Thánh',
        hint: 'Nhập tham chiếu (VD Giăng 3:16) rồi dán nội dung — mỗi câu bắt đầu bằng số câu.',
        contentPlaceholder: 'Dán đoạn Kinh Thánh vào đây…',
      };
    case 'dang-hien':
      return {
        heading: 'Dâng hiến',
        hint: 'Nhập lời dẫn và lời cầu nguyện dâng hiến.',
        contentPlaceholder: 'Nhập lời dẫn dâng hiến…',
      };
    case 'giang-loi-chua':
    case 'bai-giang':
      return {
        heading: 'Bài giảng',
        hint: 'Nhập chủ đề, câu gốc và các nội dung cần trình chiếu.',
        contentPlaceholder: 'Nhập các ý chính cần trình chiếu…',
      };
    case 'cau-thay-thong-bao':
      return {
        heading: 'Cầu thay & thông báo',
        hint: 'Nhập các nhu cầu cầu thay và thông báo của Hội thánh.',
        contentPlaceholder: 'Nhập nhu cầu cầu thay, thông báo…',
      };
    case 'cau-nguyen-tat-le':
      return {
        heading: 'Cầu nguyện tất lễ',
        hint: 'Nhập lời cầu nguyện kết thúc và chúc phước.',
        contentPlaceholder: 'Nhập lời cầu nguyện tất lễ…',
      };
    default:
      return {
        heading: 'Nội dung mục',
        hint: 'Nhập nội dung — app tự chia thành từng slide.',
        contentPlaceholder: 'Nhập nội dung vào đây…',
      };
  }
}
