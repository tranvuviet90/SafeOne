import fs from 'fs';

const buffer = fs.readFileSync('C:\\Users\\tranv\\SafeOne\\public\\templates\\022-3 - Huấn luyện vận hành & đánh giá kết quả.doc');

let utf16Str = '';
for (let i = 0; i < buffer.length - 1; i += 2) {
  utf16Str += String.fromCharCode(buffer.readUInt16LE(i));
}

// Search for the header area
const startText = "BỘ PHẬN (DEPARTMENT):";
const idxStart = utf16Str.indexOf(startText);
if (idxStart === -1) {
  console.log("Could not find start text!");
} else {
  // Let's print out the exact string and character codes of next 500 characters
  console.log("Found start text at char index:", idxStart);
  const len = 500;
  const sub = utf16Str.slice(idxStart, idxStart + len);
  
  // Find relative indices of labels
  const deptIdx = sub.indexOf("BỘ PHẬN (DEPARTMENT):");
  const dateIdx = sub.indexOf("Ngày (Date):");
  const empIdx = sub.indexOf("Nhân viên (Employee):");
  const msnvIdx = sub.indexOf("MSNV (Employee Code):");
  const posIdx = sub.indexOf("Chức vụ (Position):");
  const shiftIdx = sub.indexOf("Ca làm việc (Working shift):");
  const workPosIdx = sub.indexOf("Vị trí làm việc (working position):");
  const trainerIdx = sub.indexOf("Người hướng dẫn (Trainer):");
  const machineIdx = sub.indexOf("ĐÀO TẠO VẬN HÀNH MÁY");

  console.log("Relative indices of markers:");
  console.log("  BỘ PHẬN:", deptIdx);
  console.log("  Ngày (Date):", dateIdx);
  console.log("  Nhân viên:", empIdx);
  console.log("  MSNV:", msnvIdx);
  console.log("  Chức vụ:", posIdx);
  console.log("  Ca làm việc:", shiftIdx);
  console.log("  Vị trí làm việc:", workPosIdx);
  console.log("  Người hướng dẫn:", trainerIdx);
  console.log("  ĐÀO TẠO VẬN HÀNH MÁY:", machineIdx);

  // Let's see the spacing between markers
  if (deptIdx !== -1 && dateIdx !== -1) {
    const space = sub.slice(deptIdx + "BỘ PHẬN (DEPARTMENT):".length, dateIdx);
    console.log(`Dept spacing length: ${space.length}, content: "${space}"`);
  }
  if (dateIdx !== -1 && empIdx !== -1) {
    const space = sub.slice(dateIdx + "Ngày (Date):".length, empIdx);
    console.log(`Date spacing length: ${space.length}, content: "${space}"`);
  }
  if (empIdx !== -1 && msnvIdx !== -1) {
    const space = sub.slice(empIdx + "Nhân viên (Employee):".length, msnvIdx);
    console.log(`Employee spacing length: ${space.length}, content: "${space}"`);
  }
  if (msnvIdx !== -1 && posIdx !== -1) {
    const space = sub.slice(msnvIdx + "MSNV (Employee Code):".length, posIdx);
    console.log(`MSNV spacing length: ${space.length}, content: "${space}"`);
  }
  if (posIdx !== -1 && shiftIdx !== -1) {
    const space = sub.slice(posIdx + "Chức vụ (Position):".length, shiftIdx);
    console.log(`Position spacing length: ${space.length}, content: "${space}"`);
  }
  if (shiftIdx !== -1 && workPosIdx !== -1) {
    const space = sub.slice(shiftIdx + "Ca làm việc (Working shift):".length, workPosIdx);
    console.log(`Shift spacing length: ${space.length}, content: "${space}"`);
  }
  if (workPosIdx !== -1 && trainerIdx !== -1) {
    const space = sub.slice(workPosIdx + "Vị trí làm việc (working position):".length, trainerIdx);
    console.log(`Working position spacing length: ${space.length}, content: "${space}"`);
  }
  if (trainerIdx !== -1 && machineIdx !== -1) {
    const space = sub.slice(trainerIdx + "Người hướng dẫn (Trainer):".length, machineIdx);
    console.log(`Trainer spacing length: ${space.length}, content: "${space}"`);
  }
}
