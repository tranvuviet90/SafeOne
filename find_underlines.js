import fs from 'fs';

const buffer = fs.readFileSync('C:\\Users\\tranv\\SafeOne\\public\\templates\\022-3 - Huấn luyện vận hành & đánh giá kết quả.doc');

// Find all UTF-16LE text sequences that look like fields
let text = '';
for (let i = 0; i < buffer.length - 1; i += 2) {
  const code = buffer.readUInt16LE(i);
  if (code >= 32 && code <= 0x01BF) {
    text += String.fromCharCode(code);
  } else {
    if (text.length >= 10) {
      if (text.includes('__') || text.includes('Employee') || text.includes('Code') || text.includes('Date') || text.includes('DEPARTMENT')) {
        console.log(`Offset ${i - text.length * 2}:`, text);
      }
    }
    text = '';
  }
}
