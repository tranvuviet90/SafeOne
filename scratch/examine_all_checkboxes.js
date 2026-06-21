import fs from 'fs';

const buffer = fs.readFileSync('C:\\Users\\tranv\\SafeOne\\public\\templates\\022-3 - Huấn luyện vận hành & đánh giá kết quả.doc');

let utf16Str = '';
for (let i = 0; i < buffer.length - 1; i += 2) {
  utf16Str += String.fromCharCode(buffer.readUInt16LE(i));
}

let idx = utf16Str.indexOf('\uF0A8');
let matchCount = 0;
while (idx !== -1) {
  matchCount++;
  console.log(`Match ${matchCount} at character index ${idx}:`);
  const start = Math.max(0, idx - 10);
  const end = Math.min(utf16Str.length, idx + 40);
  console.log("  context:", JSON.stringify(utf16Str.slice(start, end)));
  idx = utf16Str.indexOf('\uF0A8', idx + 1);
}
