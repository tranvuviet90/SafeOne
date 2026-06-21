import fs from 'fs';

const buffer = fs.readFileSync('C:\\Users\\tranv\\SafeOne\\public\\templates\\022-3 - Huấn luyện vận hành & đánh giá kết quả.doc');

let utf16Str = '';
for (let i = 0; i < buffer.length - 1; i += 2) {
  utf16Str += String.fromCharCode(buffer.readUInt16LE(i));
}

// Test inputs
const deptName = "Golf Cutting";
const dateStr = "18/06/2026";
const empName = "Nguyễn Văn A";
const msnv = "123456";
const position = "Nhân viên vận hành";
const shift = "Ca A";
const workingPosition = "Máy Sheet 45°";
const trainer = "Trần Văn B";
const passed = true;

const q1 = "1. Sử dụng đầy đủ các trang bị bảo hộ lao động cá nhân (PPE) phù hợp.";
const q2 = "2. Kiểm tra cẩn thận các thiết bị an toàn xung quanh máy trước khi khởi động.";
const q3 = "3. Thao tác đúng kỹ thuật theo tài liệu SOP đã được hướng dẫn.";
const q4 = "4. Biết cách ứng phó nhanh và bấm nút dừng khẩn cấp khi có sự cố xảy ra.";
const q5 = "5. Thực hiện vệ sinh máy và bàn giao khu vực làm việc sạch sẽ sau ca trực.";

// 1. Dept & Date
const deptTarget = "BỘ PHẬN (DEPARTMENT): _____________________\r\u0007\u0007\t\t\t\t\t\t\t\t\rNgày (Date):    ";
const deptPart = ("BỘ PHẬN (DEPARTMENT): " + deptName);
const datePart = ("Ngày (Date): " + dateStr);
const deptRepl = (deptPart.padEnd(43, " ") + "\r\u0007\u0007\t\t\t\t\t\t\t\t\r" + datePart).slice(0, deptTarget.length).padEnd(deptTarget.length, " ");

// 2. Employee & MSNV
const empTarget = "Nhân viên (Employee):" + " ".repeat(68) + "MSNV (Employee Code):" + " ".repeat(3);
const empPart = ("Nhân viên (Employee): " + empName);
const msnvPart = ("MSNV (Employee Code): " + msnv);
const empRepl = (empPart.padEnd(80, " ") + msnvPart).slice(0, empTarget.length).padEnd(empTarget.length, " ");

// 3. Chức vụ & Ca làm việc
const posTarget = "Chức vụ (Position):" + " ".repeat(73) + "Ca làm việc (Working shift): \r";
const posPart = ("Chức vụ (Position): " + position);
const shiftPart = ("Ca làm việc (Working shift): " + shift);
const posRepl = (posPart.padEnd(92, " ") + shiftPart).slice(0, posTarget.length - 1).padEnd(posTarget.length - 1, " ") + "\r";

// 4. Vị trí làm việc & Người hướng dẫn
const wposTarget = "Vị trí làm việc (working position):" + " ".repeat(50) + "Người hướng dẫn (Trainer): \u0007\u0007  \r";
const wposPart = ("Vị trí làm việc (working position): " + workingPosition);
const trainerPart = ("Người hướng dẫn (Trainer): " + trainer);
const wposRepl = (wposPart.padEnd(85, " ") + trainerPart).slice(0, wposTarget.length - 5).padEnd(wposTarget.length - 5, " ") + "\u0007\u0007  \r";

// 5. Checkboxes (Result)
const resultTarget = "\rKết quả\r\r\uF0A8Đạt (Passed)\r\uF0A8Không đạt (Failed)";
const resultRepl = passed 
  ? "\rKết quả\r\r\uF0FEĐạt (Passed)\r\uF0A8Không đạt (Failed)"
  : "\rKết quả\r\r\uF0A8Đạt (Passed)\r\uF0FEKhông đạt (Failed)";

// 6. Questions
const q1Target = "Sử dụng đúng các bảo hộ lao động yêu cầu.";
const q1Repl = q1.slice(0, q1Target.length).padEnd(q1Target.length, " ");

const q2Target = "Thực hiện kiểm tra ngoại quan, các bất thường của máy, nguồn điện, nguồn nhiệt, khí nén, dừng khẩn cấp, dây nối đất, sensor, cover, khóa Interlock (nếu có).";
const q2Repl = q2.slice(0, q2Target.length).padEnd(q2Target.length, " ");

const q3Target = "Kỹ năng thao tác máy theo đúng hướng dẫn trên SOP.";
const q3Repl = q3.slice(0, q3Target.length).padEnd(q3Target.length, " ");

const q4Target = "Kỹ năng xử lý tình huống khi bất ngờ xảy ra sự cố máy móc trong lúc vận hành.";
const q4Repl = q4.slice(0, q4Target.length).padEnd(q4Target.length, " ");

const q5Target = "Biết cách xử lý sự cố, liên lạc khẩn cấp khi không thông báo trực tiếp được với quản lý bộ phận.";
const q5Repl = q5.slice(0, q5Target.length).padEnd(q5Target.length, " ");

// Let's do the replacement in string
let modifiedStr = utf16Str;
modifiedStr = modifiedStr.replace(deptTarget, deptRepl);
modifiedStr = modifiedStr.replace(empTarget, empRepl);
modifiedStr = modifiedStr.replace(posTarget, posRepl);
modifiedStr = modifiedStr.replace(wposTarget, wposRepl);
modifiedStr = modifiedStr.replace(resultTarget, resultRepl);
modifiedStr = modifiedStr.replace(q1Target, q1Repl);
modifiedStr = modifiedStr.replace(q2Target, q2Repl);
modifiedStr = modifiedStr.replace(q3Target, q3Repl);
modifiedStr = modifiedStr.replace(q4Target, q4Repl);
modifiedStr = modifiedStr.replace(q5Target, q5Repl);

// Write back to binary
const outBuffer = Buffer.alloc(buffer.length);
// Copy original headers/structure (non-text streams, etc.)
buffer.copy(outBuffer);

// Write the modified UTF-16LE text back to the exact starting position of the text body inside the buffer.
// Since the length of the string in characters is exactly the same, the byte length of the text stream is exactly the same.
// Let's see: we can write the entire character string back into the buffer where the Word document text stream resides.
// Wait! Is the text stream stored contiguously in the buffer?
// Yes, the text body starts at some offset and goes to another offset.
// Let's write characters of modifiedStr as UTF-16LE back to the buffer.
// Wait! What is the exact byte offset where the UTF-16 text starts in the file?
// In the Word binary format (97-2003 `.doc`), the text is stored in the `WordDocument` stream.
// Since the document stream contains text contiguously, and we did not change any string lengths, we can just search and replace directly on the binary buffer!
// Let's check: replacing direct UTF-16LE byte sequences in the buffer!
// That is even safer because we don't have to rebuild the entire file, we just search for the binary bytes of target string and replace them with the binary bytes of replacement string!
// Yes! Let's write a function `replaceBytes` that searches for a byte sequence and replaces it in-place in the buffer.
console.log("In-place byte replacement test...");

function stringToBytes16(str) {
  const buf = Buffer.alloc(str.length * 2);
  for (let i = 0; i < str.length; i++) {
    buf.writeUInt16LE(str.charCodeAt(i), i * 2);
  }
  return buf;
}

const originalBytes = buffer;

function replaceInBuf(buf, targetStr, replStr) {
  const targetBytes = stringToBytes16(targetStr);
  const replBytes = stringToBytes16(replStr);
  
  if (targetBytes.length !== replBytes.length) {
    throw new Error("Target and replacement byte lengths do not match!");
  }
  
  // Simple search and replace
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

const testBuf = Buffer.alloc(originalBytes.length);
originalBytes.copy(testBuf);

console.log("deptTarget len:", deptTarget.length, "deptRepl len:", deptRepl.length);
console.log("empTarget len:", empTarget.length, "empRepl len:", empRepl.length);
console.log("posTarget len:", posTarget.length, "posRepl len:", posRepl.length);
console.log("wposTarget len:", wposTarget.length, "wposRepl len:", wposRepl.length);
console.log("resultTarget len:", resultTarget.length, "resultRepl len:", resultRepl.length);
console.log("q1Target len:", q1Target.length, "q1Repl len:", q1Repl.length);
console.log("q2Target len:", q2Target.length, "q2Repl len:", q2Repl.length);
console.log("q3Target len:", q3Target.length, "q3Repl len:", q3Repl.length);
console.log("q4Target len:", q4Target.length, "q4Repl len:", q4Repl.length);
console.log("q5Target len:", q5Target.length, "q5Repl len:", q5Repl.length);

console.log("Replacing Dept & Date:", replaceInBuf(testBuf, deptTarget, deptRepl));
console.log("Replacing Employee & MSNV:", replaceInBuf(testBuf, empTarget, empRepl));
console.log("Replacing Position & Shift:", replaceInBuf(testBuf, posTarget, posRepl));
console.log("Replacing WorkPos & Trainer:", replaceInBuf(testBuf, wposTarget, wposRepl));
console.log("Replacing Result:", replaceInBuf(testBuf, resultTarget, resultRepl));
console.log("Replacing Q1:", replaceInBuf(testBuf, q1Target, q1Repl));
console.log("Replacing Q2:", replaceInBuf(testBuf, q2Target, q2Repl));
console.log("Replacing Q3:", replaceInBuf(testBuf, q3Target, q3Repl));
console.log("Replacing Q4:", replaceInBuf(testBuf, q4Target, q4Repl));
console.log("Replacing Q5:", replaceInBuf(testBuf, q5Target, q5Repl));

fs.writeFileSync('C:\\Users\\tranv\\SafeOne\\scratch\\test_output.doc', testBuf);
console.log("Saved test_output.doc");
