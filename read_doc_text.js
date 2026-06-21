import fs from 'fs';

try {
  const buffer = fs.readFileSync('C:\\Users\\tranv\\SafeOne\\public\\templates\\022-3 - Huấn luyện vận hành & đánh giá kết quả.doc');
  
  // Extract ASCII strings of length >= 4
  let asciiStrings = [];
  let current = '';
  for (let i = 0; i < buffer.length; i++) {
    const char = buffer[i];
    if (char >= 32 && char <= 126) {
      current += String.fromCharCode(char);
    } else {
      if (current.length >= 4) {
        asciiStrings.push(current);
      }
      current = '';
    }
  }
  
  // Extract UTF-16LE strings of length >= 4
  let utf16Strings = [];
  let currentU = '';
  for (let i = 0; i < buffer.length - 1; i += 2) {
    const code = buffer.readUInt16LE(i);
    if (code >= 32 && code <= 126) {
      currentU += String.fromCharCode(code);
    } else if (code >= 0x00A0 && code <= 0x01BF) {
      // Vietnamese characters or basic Latin-1/Latin Extended
      currentU += String.fromCharCode(code);
    } else {
      if (currentU.length >= 4) {
        utf16Strings.push(currentU);
      }
      currentU = '';
    }
  }

  console.log('ASCII strings count:', asciiStrings.length);
  console.log('Sample ASCII strings:', asciiStrings.slice(0, 100));
  
  console.log('\nUTF-16LE strings count:', utf16Strings.length);
  console.log('Sample UTF-16LE strings (Vietnamese text should show here):');
  // Filter strings with Vietnamese characters or meaningful words
  const meaningful = utf16Strings.filter(s => s.trim().length > 5);
  console.log(meaningful.slice(0, 200));
  
} catch (e) {
  console.error(e);
}
