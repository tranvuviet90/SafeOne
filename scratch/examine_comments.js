import fs from 'fs';

const buffer = fs.readFileSync('C:\\Users\\tranv\\SafeOne\\public\\templates\\022-3 - Huấn luyện vận hành & đánh giá kết quả.doc');

let utf16Str = '';
for (let i = 0; i < buffer.length - 1; i += 2) {
  utf16Str += String.fromCharCode(buffer.readUInt16LE(i));
}

const targetText = "Nhận xét của người đánh giá trực tiếp (Evaluator’s Comments):";
const idx = utf16Str.indexOf(targetText);
if (idx !== -1) {
  console.log("Found Nhận xét at:", idx);
  const start = idx;
  const end = idx + 250;
  console.log("Content:", JSON.stringify(utf16Str.slice(start, end)));
}
