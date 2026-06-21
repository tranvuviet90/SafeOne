import fs from 'fs';

const buffer = fs.readFileSync('C:\\Users\\tranv\\SafeOne\\public\\templates\\022-3 - Huấn luyện vận hành & đánh giá kết quả.doc');

const slice = buffer.slice(2900, 3600);
let text = '';
for (let i = 0; i < slice.length - 1; i += 2) {
  text += String.fromCharCode(slice.readUInt16LE(i));
}
console.log('Hex representation:');
console.log(slice.toString('hex').toUpperCase());
console.log('Text representation:');
console.log(JSON.stringify(text));
