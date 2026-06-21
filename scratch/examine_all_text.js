import fs from 'fs';

const buffer = fs.readFileSync('C:\\Users\\tranv\\SafeOne\\public\\templates\\022-3 - Huấn luyện vận hành & đánh giá kết quả.doc');

let utf16Str = '';
for (let i = 0; i < buffer.length - 1; i += 2) {
  utf16Str += String.fromCharCode(buffer.readUInt16LE(i));
}

let idx = utf16Str.indexOf("Passed");
let count = 0;
while (idx !== -1) {
  count++;
  console.log(`Passed #${count} at ${idx}:`, JSON.stringify(utf16Str.slice(idx - 20, idx + 20)));
  idx = utf16Str.indexOf("Passed", idx + 1);
}

idx = utf16Str.indexOf("Failed");
count = 0;
while (idx !== -1) {
  count++;
  console.log(`Failed #${count} at ${idx}:`, JSON.stringify(utf16Str.slice(idx - 20, idx + 20)));
  idx = utf16Str.indexOf("Failed", idx + 1);
}
