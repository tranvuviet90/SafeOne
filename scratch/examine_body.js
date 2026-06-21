import fs from 'fs';

const buffer = fs.readFileSync('C:\\Users\\tranv\\SafeOne\\public\\templates\\022-3 - Huấn luyện vận hành & đánh giá kết quả.doc');

let str = '';
for (let i = 14500; i < 18000; i += 2) {
  const code = buffer.readUInt16LE(i);
  str += String.fromCharCode(code);
}

console.log("TEXT EXTRACT (14500 - 18000):");
console.log(str);
