// src/theme.js
//
// Các giá trị dưới đây KHÔNG phải mã màu mà là tham chiếu tới CSS variable khai báo
// trong src/index.css. Nhờ vậy mọi chỗ đang viết inline style `color: colors.primary`
// tự đổi theo tông sáng/tối mà không phải sửa component nào.
// Muốn đổi màu thật thì sửa src/index.css, không sửa file này.
export const colors = {
  // Màu chủ đạo - SafeOne Slate Teal & Mint
  primary: 'var(--so-primary)',
  primaryLight: 'var(--so-primary-light)',
  primaryDark: 'var(--so-primary-dark)',

  // Màu bổ trợ - Forest Green & Accent Lime
  secondary: 'var(--so-secondary)',
  accent: 'var(--so-accent)',
  accentLight: 'var(--so-accent-light)',

  // Màu văn bản
  textPrimary: 'var(--so-text-primary)',
  textSecondary: 'var(--so-text-secondary)',
  textDisabled: 'var(--so-text-disabled)',

  // Màu nền cao cấp
  background: 'var(--so-background)',
  surface: 'var(--so-surface)',
  backgroundLight: 'var(--so-background-light)',

  // Màu trạng thái
  error: 'var(--so-error)',
  success: 'var(--so-success)',
  warning: 'var(--so-warning)',
  info: 'var(--so-info)',

  // Các màu khác
  border: 'var(--so-border)',
  white: 'var(--so-white)',
  black: 'var(--so-black)',
};

// Pha trong suốt một màu chủ đạo.
//
// Không dùng được cách nối chuỗi hex quen thuộc (`${colors.primary}33`) nữa: nó sinh ra
// "var(--so-primary)33" — CSS không hợp lệ, hiệu ứng sẽ mất im lặng chứ không báo lỗi.
// Các màu có biến --so-*-rgb đi kèm: primary, error, success, warning, info.
export const alpha = (name, a) => `rgba(var(--so-${name}-rgb), ${a})`;

// Token hình khối cho chỗ buộc phải inline (style động theo state).
// Chỗ tĩnh thì dùng class .so-* trong src/styles/ui.css thay vì các token này.
export const radius = {
  sm: 'var(--so-radius-sm)',   // nút, input, chip
  md: 'var(--so-radius-md)',   // card con, dropdown
  lg: 'var(--so-radius-lg)',   // card lớn, modal
  pill: '999px',
};

export const shadows = {
  sm: 'var(--so-shadow-sm)',   // card nghỉ
  md: 'var(--so-shadow-md)',   // hover, dropdown
  lg: 'var(--so-shadow-lg)',   // modal
  focusRing: 'var(--so-focus-ring)',
};

export const space = (n) => `var(--so-space-${n})`; // n = 1..6 → 4/8/12/16/24/32px

export const transition = 'var(--so-transition)';   // 160ms ease
