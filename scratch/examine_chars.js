import fs from 'fs';

const buffer = fs.readFileSync('C:\\Users\\tranv\\SafeOne\\public\\templates\\022-3 - Huấn luyện vận hành & đánh giá kết quả.doc');

// Let's find where 'Passed' is in the text
let utf16Str = '';
for (let i = 0; i < buffer.length - 1; i += 2) {
  utf16Str += String.fromCharCode(buffer.readUInt16LE(i));
}

let idx = utf16Str.indexOf("Passed");
while (idx !== -1) {
  console.log(`Found 'Passed' at char index ${idx}`);
  // Let's print the character codes of the characters preceding 'Passed' (say 15 chars before)
  for (let k = idx - 15; k <= idx + 10; k++) {
    const charCode = utf16Str.charCodeAt(k);
    console.log(`  char[${k}] = '${utf16Str[k]}' (code: 0x${charCode.toString(16).toUpperCase()}, decimal: ${charCode})`);
  }
  idx = utf16Str.indexOf("Passed", idx + 1);
}
