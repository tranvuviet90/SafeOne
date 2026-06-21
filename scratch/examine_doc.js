import fs from 'fs';

const buffer = fs.readFileSync('C:\\Users\\tranv\\SafeOne\\public\\templates\\022-3 - Huấn luyện vận hành & đánh giá kết quả.doc');

// Dump all text chunks of UTF-16LE characters (length >= 2) with their offsets
let chunks = [];
let current = '';
let startOffset = 0;

for (let i = 0; i < buffer.length - 1; i += 2) {
  const code = buffer.readUInt16LE(i);
  if ((code >= 32 && code <= 126) || (code >= 0x00A0 && code <= 0x03FF)) {
    if (current.length === 0) {
      startOffset = i;
    }
    current += String.fromCharCode(code);
  } else {
    if (current.length >= 2) {
      chunks.push({ offset: startOffset, length: current.length, text: current });
    }
    current = '';
  }
}
if (current.length >= 2) {
  chunks.push({ offset: startOffset, length: current.length, text: current });
}

// Print all chunks containing certain keywords or just print first 500 chunks
chunks.forEach((c) => {
  const text = c.text.trim();
  if (text.length > 5) {
    console.log(`Offset ${c.offset} (len ${c.text.length}): ${c.text}`);
  }
});
