import fs from 'fs';

const buffer = fs.readFileSync('C:\\Users\\tranv\\SafeOne\\public\\templates\\022-3 - Huấn luyện vận hành & đánh giá kết quả.doc');

let utf16Str = '';
for (let i = 0; i < buffer.length - 1; i += 2) {
  utf16Str += String.fromCharCode(buffer.readUInt16LE(i));
}

// Print characters between 15000 and 17000 in the raw buffer
console.log("Dumping raw chars 15000 to 17000 of UTF-16 representation:");
const segment = utf16Str.slice(15000, 17000);
for (let i = 0; i < segment.length; i++) {
  const code = segment.charCodeAt(i);
  if (code < 32 || code > 126) {
    if (code === 7) {
      console.log(`[CELL_SEPARATOR at ${15000 + i}]`);
    } else if (code === 13) {
      console.log(`[CR at ${15000 + i}]`);
    } else {
      console.log(`[CHAR 0x${code.toString(16).toUpperCase()} at ${15000 + i}]: '${segment[i]}'`);
    }
  } else {
    console.log(`'${segment[i]}' at ${15000 + i}`);
  }
}
