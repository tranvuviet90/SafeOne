import fs from 'fs';

const buffer = fs.readFileSync('C:\\Users\\tranv\\SafeOne\\public\\templates\\022-3 - Huấn luyện vận hành & đánh giá kết quả.doc');

let utf16Str = '';
for (let i = 0; i < buffer.length - 1; i += 2) {
  utf16Str += String.fromCharCode(buffer.readUInt16LE(i));
}

const idx = utf16Str.indexOf("BỘ PHẬN (DEPARTMENT):");
console.log("Index of BỘ PHẬN:", idx);
for (let k = idx; k < idx + 90; k++) {
  const code = utf16Str.charCodeAt(k);
  console.log(`  char[${k}] = '${utf16Str[k]}' (code: 0x${code.toString(16).toUpperCase()})`);
}
