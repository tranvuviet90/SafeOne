import fs from 'fs';

const buffer = fs.readFileSync('C:\\Users\\tranv\\SafeOne\\public\\templates\\022-3 - Huấn luyện vận hành & đánh giá kết quả.doc');

let utf16Str = '';
for (let i = 0; i < buffer.length - 1; i += 2) {
  utf16Str += String.fromCharCode(buffer.readUInt16LE(i));
}

// Print characters between 7700 and 8500
console.log("Characters 7700 - 8500:");
for (let k = 7700; k < 8500; k++) {
  const code = utf16Str.charCodeAt(k);
  if (code) {
    console.log(`char[${k}] = '${utf16Str[k]}' (code: 0x${code.toString(16).toUpperCase()})`);
  }
}
