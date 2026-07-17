# Thiết kế: Nâng cấp thẩm mỹ toàn diện (UI facelift)

Ngày: 2026-07-17
Trạng thái: đã duyệt

## 1. Mục tiêu

Làm lại toàn bộ lớp hình ảnh của SafeOne — typography, spacing, bo góc, đổ bóng, nút,
bảng, modal, hiệu ứng — trên khung điều hướng và luồng nghiệp vụ **giữ nguyên**. Giữ
nhận diện teal/mint. Đồng thời hoàn thành nốt lộ trình dark mode từng tab của spec
`2026-07-16-dark-mode-toggle-design.md` (439 chỗ màu gõ cứng ở ~20 file) ngay trong
đợt quét này, không cần đợt riêng.

## 2. Hiện trạng (đã đo trên mã nguồn, 2026-07-17)

- **28** giá trị `borderRadius` khác nhau (8, 6, 12, "8px", 4, 50, 16, "10px"…).
- **38** giá trị `fontSize` khác nhau (14, 13, 12, "13px", "12px"…, lẫn lộn số và chuỗi).
- **88** chỗ `boxShadow` tự chế, mỗi chỗ một công thức.
- Toàn bộ style là inline qua `colors.*`; đã có hạ tầng CSS variables sáng/tối
  (`--so-*`) và `ThemeProvider` hoạt động (commit `71c4ca3`).
- Kết luận audit: palette không phải vấn đề; vấn đề là **thiếu kỷ luật thị giác** —
  mỗi tab một "phương ngữ" riêng.

## 3. Hướng thị giác

- **Typography**: giữ Inter. Thang 7 bậc: 12 / 13 / 14 (base) / 16 / 18 / 22 / 28 px.
  Weight 400 (thân), 500 (nhãn), 600 (tiêu đề phụ, nút), 700 (tiêu đề). Số trong bảng
  dùng `font-variant-numeric: tabular-nums`.
- **Bo góc 3 mức**: `--so-radius-sm: 8px` (nút, input, chip) · `--so-radius-md: 12px`
  (card con, dropdown) · `--so-radius-lg: 16px` (card lớn, modal) · `999px` cho
  badge/pill. Khung nội dung chính giữ 22px làm nét đặc trưng.
- **Đổ bóng 3 tầng**: `--so-shadow-sm` (card nghỉ) · `--so-shadow-md` (hover,
  dropdown) · `--so-shadow-lg` (modal). Ở `data-theme="dark"` bóng giảm mạnh, chiều
  sâu chuyển sang viền `--so-border`.
- **Spacing**: thang bội số 4 — 4 / 8 / 12 / 16 / 24 / 32 (`--so-space-1..6`).
- **Chuyển động**: transition 150–180ms ease cho hover/focus/active. Không animation
  trang trí.
- **Focus**: ring `:focus-visible` màu primary thống nhất, thay outline mặc định WebKit.

## 4. Kiến trúc CSS

Ba điểm chạm, xây trên nền dark-mode đã có:

1. **`src/index.css`** — thêm token cạnh bảng màu: `--so-radius-*`, `--so-shadow-*`
   (giá trị đổi theo `data-theme`), `--so-space-*`.
2. **`src/styles/ui.css`** (file mới) — bộ primitive class dùng chung:
   `.so-card`, `.so-btn` (variant `--primary` / `--ghost` / `--danger`), `.so-input`,
   `.so-select`, `.so-table`, `.so-modal`, `.so-badge`, `.so-chip`, `.so-empty`.
   Áp chuẩn taste skill (design-taste-frontend / redesign-existing-projects) tại đây.
3. **`src/theme.js`** — xuất thêm `radius`, `shadows`, `space` cho chỗ buộc phải
   inline (style động theo state). Inline style còn lại dùng token, không dùng số trần.

## 5. Trình tự quét — mỗi mục một commit

Mỗi lượt làm **hai việc**: áp primitive/token **và** xóa hết màu gõ cứng của file đó
(dark mode phủ kín tab đó luôn).

1. App shell + Login (header, thanh menu teal, khung nội dung, footer, màn đăng nhập).
2. EHSAudit → 3. Gemba → 4. DocumentManager (3 tab nghiệp vụ nặng nhất).
5. BaoCom → 6. Calamviec → 7. Locker → 8. Knife → 9. Bodam → 10. UserManager.
11. GiamSatHutThuoc + GiamSatGiaiLao + GiamSatNhaRac (3 tab cùng khuôn, gộp 1 commit).
12. EhsCommittee → 13. Chatbot + mảnh nhỏ (NotificationBell, LanguageSwitcher,
    PublicLockerView, ResetPassword, License).

## 6. Ngoài phạm vi

- Không đổi khung điều hướng, không thêm/bớt tab, không chạm logic nghiệp vụ hay API.
- Không đổi palette (chỉ được tinh chỉnh tương phản nếu đo thấy thiếu).
- Không migrate sang CSS framework/library.

## 7. Nghiệm thu

Không có test tự động — nghiệm thu bằng app thật (`npm run dev:all`):

1. Mỗi tab sau khi quét: kiểm cả **2 theme × 2 khổ màn hình** (desktop / mobile).
2. Chữ trắng trên nút teal không mất (bẫy `--so-white` — xem spec dark-mode §5.2).
3. Sau khi quét xong một tab, `rg "#[0-9a-fA-F]{3,6}"` trên file đó chỉ còn lại
   trường hợp có chú thích lý do (nếu có).
4. `npm run build` sạch sau mỗi nhóm commit.

## 8. Rủi ro & kiểm soát

Khối lượng lớn (~20 file, 439 chỗ màu, 88 chỗ bóng). Kiểm soát: commit nhỏ theo tab —
hỏng tab nào revert tab đó; không sửa logic trong cùng commit với style; primitive
class viết xong ở bước 1 rồi mới quét, tránh đổi chuẩn giữa chừng.
