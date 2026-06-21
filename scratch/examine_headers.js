import fs from 'fs';

const buffer = fs.readFileSync('C:\\Users\\tranv\\SafeOne\\public\\templates\\022-3 - Huấn luyện vận hành & đánh giá kết quả.doc');

// Let's print out the exact character sequence around offsets 3000 to 4500
// Word stores text in UTF-16LE.
let str = '';
for (let i = 2700; i < 4500; i += 2) {
  const code = buffer.readUInt16LE(i);
  str += String.fromCharCode(code);
}

console.log("TEXT EXTRACT (2700 - 4500):");
console.log(str);
