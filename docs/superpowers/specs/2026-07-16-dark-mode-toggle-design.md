# Thiết kế: Nút chuyển giao diện Sáng/Tối

Ngày: 2026-07-16
Trạng thái: đã duyệt (giai đoạn B — nền tảng + header)

## 1. Mục tiêu

Thêm nút chuyển giao diện sáng/tối vào menu bánh răng (`UserSettings`) ở header, và dựng
hạ tầng theme để phần lớn ứng dụng đổi màu theo, mà không phải sửa hàng trăm chỗ.

## 2. Hiện trạng (đã đo, không phải ước lượng)

- `src/theme.js` chỉ là một object màu tĩnh, **chỉ có tông sáng**, không có cơ chế đổi theme.
- Toàn bộ giao diện tô màu bằng **inline style**, không dùng CSS class.
- **460** chỗ đọc `colors.*` trải trên 15 file.
- **439** chỗ gõ cứng màu (`'white'`, `'#333'`…) trải trên 21 file.
- **15** chỗ nối chuỗi alpha kiểu `` `${colors.primary}33` `` (App.jsx, DocumentManager.jsx,
  EHSAudit.jsx, Gemba.jsx).
- `src/index.css` vẫn còn boilerplate Vite: `:root` đặt nền `#242424` + `color-scheme: light dark`,
  chỉ ghi đè sang sáng qua `@media (prefers-color-scheme: light)`. Bị app tô đè nên lâu nay không lộ.

## 3. Kiến trúc

Bốn lớp, phụ thuộc một chiều: `index.css` (biến) → `theme.js` (ánh xạ) → `ThemeProvider` (trạng thái) → `UserSettings` (nút).

### 3.1. Lớp biến — `src/index.css`

Khai báo bảng màu hiện có thành CSS custom properties trên `:root`, kèm bảng ghi đè cho
`:root[data-theme="dark"]`. Dọn boilerplate Vite (nền `#242424`, `button{background:#1a1a1a}`,
`a{color:#646cff}`, `h1{3.2em}`) và thay bằng nền/chữ lấy từ biến.

| Khóa | Sáng (giữ nguyên) | Tối |
|---|---|---|
| `--so-primary` | `#466E73` | `#5F949A` |
| `--so-primary-light` | `#A9D9D4` | `#A9D9D4` |
| `--so-primary-dark` | `#2C494C` | `#CDE7E4` |
| `--so-secondary` | `#207335` | `#4CA664` |
| `--so-accent` | `#6EBF49` | `#6EBF49` |
| `--so-accent-light` | `#EAF6E3` | `#1F3320` |
| `--so-text-primary` | `#2B3A3C` | `#E4EDEC` |
| `--so-text-secondary` | `#5A6F72` | `#9FB3B5` |
| `--so-text-disabled` | `#A0B0B2` | `#67797B` |
| `--so-background` | `#F4FAF9` | `#0F1819` |
| `--so-surface` | `#ffffff` | `#172426` |
| `--so-background-light` | `#EBF5F4` | `#1E2E30` |
| `--so-error` | `#D9534F` | `#E9736F` |
| `--so-success` | `#207335` | `#4CA664` |
| `--so-warning` | `#E29E2B` | `#E0A94A` |
| `--so-border` | `#D0E2E0` | `#2E4447` |
| `--so-white` | `#ffffff` | `#ffffff` (giữ literal — xem 5.2) |
| `--so-black` | `#1C292A` | `#1C292A` (giữ literal — xem 5.2) |

Thêm biến dạng RGB phục vụ mục 3.2 (chỉ cho 2 màu thực sự cần alpha):

| Biến | Sáng | Tối |
|---|---|---|
| `--so-primary-rgb` | `70,110,115` | `95,148,154` |
| `--so-error-rgb` | `217,83,79` | `233,115,111` |

Lưu ý `--so-primary-dark` ở tông tối **sáng hơn** nền: tên gọi mang nghĩa "biến thể nhấn
mạnh" (đang dùng làm màu tiêu đề), không phải nghĩa đen "màu tối".

### 3.2. Lớp ánh xạ — `src/theme.js`

Mỗi khóa trả về `var(--so-*)` thay vì mã hex:

```js
export const colors = { primary: 'var(--so-primary)', surface: 'var(--so-surface)', /* … */ };
```

Đây là điểm đòn bẩy: **không sửa component nào**, cả 460 chỗ `colors.*` lập tức chạy theo theme.

Kèm helper cho alpha, vì `` `${colors.primary}33` `` sẽ sinh ra `var(--so-primary)33` — CSS không
hợp lệ, đổ bóng sẽ mất:

```js
export const alpha = (name, a) => `rgba(var(--so-${name}-rgb), ${a})`;
```

Viết lại đúng 15 chỗ nối chuỗi alpha sang helper này — 13 chỗ dùng `primary` (App.jsx ×2,
EHSAudit.jsx ×4, DocumentManager.jsx ×3, Gemba.jsx ×4) và 2 chỗ dùng `error`
(DocumentManager.jsx). Ánh xạ hậu tố hex → số thập phân:
`11`→`0.07`, `22`→`0.13`, `33`→`0.2`, `44`→`0.27`.

### 3.3. Lớp trạng thái — `src/ThemeProvider.jsx` (file mới)

- Trạng thái: `'light' | 'dark' | 'system'`, mặc định `'system'`.
- Lưu ở `localStorage['safeone_theme']` — **theo thiết bị, không theo tài khoản**. Không đụng
  backend, không đụng DB.
- Khi là `'system'`, theo dõi `matchMedia('(prefers-color-scheme: dark)')` và đổi theo thời gian thực.
- Áp dụng bằng cách gán `document.documentElement.dataset.theme` và `style.colorScheme`
  (để thanh cuộn, checkbox, ô chọn ngày của trình duyệt cũng tối theo).
- Lần áp dụng đầu chạy ở **module scope**, import từ `main.jsx` trước khi render, để không
  chớp trắng khi tải lại trang.
- Xuất `useTheme()` trả về `{ theme, resolvedTheme, setTheme }`.

### 3.4. Lớp giao diện — `src/components/UserSettings.jsx`

Thêm một dòng ở đầu menu bánh răng: nhãn + icon mặt trăng/mặt trời + công tắc bên phải.
Bấm thì đổi ngay và **menu không đóng**, để thấy kết quả tức thì.

Công tắc chỉ có 2 vị trí trong khi trạng thái có 3 giá trị, nên quy ước:

- **Vị trí công tắc** phản ánh `resolvedTheme` (ở `system` mà máy đang tối → công tắc bật).
- **Bấm công tắc** luôn đặt giá trị tường minh (`light` hoặc `dark`), tức là thoát khỏi `system`.
  Người dùng chỉ ở `system` cho tới lần bấm đầu tiên. Không làm UI 3 lựa chọn ở đợt này —
  chưa ai yêu cầu, và công tắc 2 vị trí là thứ quen thuộc hơn.

Chuỗi qua i18n (`src/i18n/dictionaries.js`, thêm cả VI lẫn EN, theo quy ước khóa phẳng sẵn có):

| Khóa | VI | EN |
|---|---|---|
| `settings.theme` | Giao diện tối | Dark mode |

Đồng thời thay 17 chỗ gõ cứng trong chính file này (`background:'white'`, `color:'#333'`,
`'#f5f5f5'`, `'#eee'`…) bằng `colors.*`. Không làm bước này thì mở menu ở chế độ tối vẫn ra
hộp trắng chữ đen.

## 4. Phạm vi

**Trong phạm vi:** `index.css`, `theme.js`, `ThemeProvider.jsx`, `main.jsx`, `UserSettings.jsx`
(gồm 2 modal đổi mật khẩu / xin cấp quyền), `dictionaries.js`, và 15 chỗ alpha ở 4 file.

**Ngoài phạm vi:** 439 chỗ gõ cứng ở 20 file tab còn lại. Các tab đó sẽ tối **một phần** nhờ mục
3.2, nhưng còn mảng trắng. Mỗi tab là một đợt quét độc lập về sau.

## 5. Đánh đổi đã biết

### 5.1. `colors.primary` kiêm hai vai

Vừa làm *nền* thanh menu, vừa làm *màu chữ* ở nhiều nơi. Một giá trị không thể tối ưu cho cả
hai: nền teal đậm thì đẹp, nhưng cùng màu đó làm chữ trên nền tối sẽ khó đọc. `#5F949A` là
tông dung hòa, sẽ **chỉnh bằng mắt trên header thật**. Tách bạch triệt để (`--so-primary-surface`
vs `--so-primary-text`) để dành cho đợt sau.

### 5.2. `colors.white` / `colors.black` cũng kiêm hai vai

Đã kiểm chứng: `color: colors.white` (chữ trên nút teal — phải giữ trắng) và
`background: colors.white` (nền thẻ — đáng lẽ phải hóa tối) cùng tồn tại.

**Quyết định:** giữ `--so-white`/`--so-black` là literal ở cả hai tông. Ánh xạ chúng sang màu
tối sẽ làm chữ trắng trên nút teal biến mất — hỏng nặng hơn là để nền thẻ sáng.
Các chỗ `background: colors.white` sẽ đổi sang `colors.surface` trong đợt quét từng tab; chúng
đều nằm ngoài phạm vi đợt này.

## 6. Nghiệm thu

Dự án không có bộ test tự động, nên kiểm chứng bằng cách chạy app thật (`npm run dev:all`):

1. Bấm công tắc → header, thanh menu, menu bánh răng đổi tối tức thì; menu không đóng.
2. Mở 2 modal (đổi mật khẩu, xin cấp quyền) ở tông tối → nền tối, chữ đọc được, không còn hộp trắng.
3. Tải lại trang → giữ nguyên lựa chọn, **không chớp trắng**.
4. Kiểm tra đổ bóng ở 15 chỗ alpha còn hiện (bóng mất = helper `alpha()` sai).
5. Đổi theme hệ điều hành khi đang ở chế độ `system` → app đổi theo.
6. Chữ trắng trên các nút teal vẫn còn (bẫy ở 5.2).
7. Chạy `npm run build` → không lỗi.
