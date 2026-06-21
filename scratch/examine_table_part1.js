import fs from 'fs';

const buffer = fs.readFileSync('C:\\Users\\tranv\\SafeOne\\public\\templates\\022-3 - Huấn luyện vận hành & đánh giá kết quả.doc');

let utf16Str = '';
for (let i = 0; i < buffer.length - 1; i += 2) {
  utf16Str += String.fromCharCode(buffer.readUInt16LE(i));
}

// Print characters between 7780 and 8000
console.log("Characters 7780 - 8000:");
for (let k = 7780; k < 8000; k++) {
  const code = utf16Str.charCodeAt(k);
  console.log(`char[${k}] = '${utf16Str[k]}' (code: 0x${code.toString(16).toUpperCase()})`);
}
