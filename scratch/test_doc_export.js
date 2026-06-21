import fs from 'fs';

const buffer = fs.readFileSync('C:\\Users\\tranv\\SafeOne\\public\\templates\\022-3 - Huấn luyện vận hành & đánh giá kết quả.doc');

let utf16Str = '';
for (let i = 0; i < buffer.length - 1; i += 2) {
  utf16Str += String.fromCharCode(buffer.readUInt16LE(i));
}

// Check if we can find our target texts and replace them
const targets = [
  "BỘ PHẬN (DEPARTMENT): _____________________",
  "Nhân viên (Employee):                                                                    MSNV (Employee Code):   ",
  "Sử dụng đúng các bảo hộ lao động yêu cầu.",
  "Thực hiện kiểm tra ngoại quan, các bất thường của máy, nguồn điện, nguồn nhiệt, khí nén, dừng khẩn cấp, dây nối đất, sensor, cover, khóa Interlock (nếu có).",
  "Kỹ năng thao tác máy theo đúng hướng dẫn trên SOP.",
  "Kỹ năng xử lý tình huống khi bất ngờ xảy ra sự cố máy móc trong lúc vận hành.",
  "Biết cách xử lý sự cố, liên lạc khẩn cấp khi không thông báo trực tiếp được với quản lý bộ phận.",
  "\rKết quả\r\r\uF0A8Đạt (Passed)\r\uF0A8Không đạt (Failed)"
];

console.log("Searching targets in document...");
targets.forEach(t => {
  const pos = utf16Str.indexOf(t);
  console.log(`Target: ${JSON.stringify(t.slice(0, 40))} -> Found at position: ${pos}`);
});
