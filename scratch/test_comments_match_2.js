import fs from 'fs';

const buffer = fs.readFileSync('C:\\Users\\tranv\\SafeOne\\public\\templates\\022-3 - Huấn luyện vận hành & đánh giá kết quả.doc');

let utf16Str = '';
for (let i = 0; i < buffer.length - 1; i += 2) {
  utf16Str += String.fromCharCode(buffer.readUInt16LE(i));
}

const targetText = "Nhận xét của người đánh giá trực tiếp (Evaluator’s Comments):";
const idx = utf16Str.indexOf(targetText);
const commentsTarget = utf16Str.slice(idx + targetText.length, idx + targetText.length + 164);

console.log("Comments target length:", commentsTarget.length);
console.log("Comments target raw:", JSON.stringify(commentsTarget));

const testComment = "Nhân viên Nguyễn Văn A đã hoàn thành tốt bài đánh giá huấn luyện vận hành thiết bị, đạt kết quả cao.";
const commentsRepl = ("\r" + testComment).slice(0, commentsTarget.length).padEnd(commentsTarget.length, " ");

console.log("Repl length:", commentsRepl.length);
const testBuf = Buffer.alloc(buffer.length);
buffer.copy(testBuf);

// Function to convert string to UTF-16LE buffer
function stringToBytes16(str) {
  const buf = Buffer.alloc(str.length * 2);
  for (let i = 0; i < str.length; i++) {
    buf.writeUInt16LE(str.charCodeAt(i), i * 2);
  }
  return buf;
}

// In-place byte replacement
function replaceInBuf(buf, targetStr, replStr) {
  const targetBytes = stringToBytes16(targetStr);
  const replBytes = stringToBytes16(replStr);
  
  let foundCount = 0;
  for (let i = 0; i <= buf.length - targetBytes.length; i++) {
    let match = true;
    for (let j = 0; j < targetBytes.length; j++) {
      if (buf[i + j] !== targetBytes[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      replBytes.copy(buf, i);
      foundCount++;
      i += targetBytes.length - 1;
    }
  }
  return foundCount;
}

console.log("Replacing comments:", replaceInBuf(testBuf, commentsTarget, commentsRepl));
