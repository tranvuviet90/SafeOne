import fs from 'fs';

const buffer = fs.readFileSync('C:\\Users\\tranv\\SafeOne\\public\\templates\\022-3 - Huấn luyện vận hành & đánh giá kết quả.doc');

let utf16Str = '';
for (let i = 0; i < buffer.length - 1; i += 2) {
  utf16Str += String.fromCharCode(buffer.readUInt16LE(i));
}

const fileSub = utf16Str.slice(1717, 1838);
const posTarget = "Chức vụ (Position):" + " ".repeat(72) + "Ca làm việc (Working shift): \r";

console.log("fileSub length:", fileSub.length);
console.log("posTarget length:", posTarget.length);

for (let i = 0; i < Math.max(fileSub.length, posTarget.length); i++) {
  const c1 = fileSub[i];
  const c2 = posTarget[i];
  const code1 = c1 ? c1.charCodeAt(0) : null;
  const code2 = c2 ? c2.charCodeAt(0) : null;
  if (code1 !== code2) {
    console.log(`Diff at index ${i}: file='${c1}' (0x${code1?.toString(16)}), target='${c2}' (0x${code2?.toString(16)})`);
  }
}
