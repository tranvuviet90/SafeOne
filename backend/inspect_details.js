import XLSX from 'xlsx';
import fs from 'fs';

const filePath = 'C:\\Users\\tranv\\SafeOne\\public\\templates\\CNVH.xlsx';

try {
  const workbook = XLSX.readFile(filePath);
  let output = 'Inspecting Status Cases:\n\n';
  
  // Inspect G_Rolling
  const rollSheet = workbook.Sheets['G_Rolling'];
  const rollData = XLSX.utils.sheet_to_json(rollSheet, { header: 1 });
  const rollSubHeader = rollData[5];
  const rollStatusIdx = rollSubHeader.indexOf('HIỆN TRẠNG');
  const rollReasonIdx = rollSubHeader.indexOf('LÝ DO');
  const rollTargetDateIdx = rollSubHeader.indexOf('NGÀY DỰ KIẾN \r\nHOÀN THÀNH');
  
  output += '=== G_Rolling Rows that are NOT "Đủ điều kiện" ===\n';
  rollData.slice(6).forEach((row, idx) => {
    if (!row || row[1] === undefined || row[1] === null || row[1] === '') return;
    const status = row[rollStatusIdx];
    if (status !== 'Đủ điều kiện') {
      output += `Row ${idx + 6}: MSNV: ${row[1]}, Name: ${row[2]}, Status: ${row[rollStatusIdx]}, Reason: ${row[rollReasonIdx]}, TargetDate: ${row[rollTargetDateIdx]}\n`;
    }
  });
  
  // Inspect G_Graphics
  const graphSheet = workbook.Sheets['G_Graphics'];
  const graphData = XLSX.utils.sheet_to_json(graphSheet, { header: 1 });
  const graphSubHeader = graphData[5];
  const graphStatusIdx = graphSubHeader.indexOf('HIỆN TRẠNG');
  const graphReasonIdx = graphSubHeader.indexOf('LÝ DO');
  const graphTargetDateIdx = graphSubHeader.indexOf('NGÀY DỰ KIẾN \r\nHOÀN THÀNH');
  
  output += '\n=== G_Graphics Rows that are NOT "Đủ điều kiện" ===\n';
  graphData.slice(6).forEach((row, idx) => {
    if (!row || row[1] === undefined || row[1] === null || row[1] === '') return;
    const status = row[graphStatusIdx];
    if (status !== 'Đủ điều kiện') {
      output += `Row ${idx + 6}: MSNV: ${row[1]}, Name: ${row[2]}, Status: ${row[graphStatusIdx]}, Reason: ${row[graphReasonIdx]}, TargetDate: ${row[graphTargetDateIdx]}\n`;
    }
  });
  
  fs.writeFileSync('C:\\Users\\tranv\\SafeOne\\backend\\inspect_status_cases.txt', output);
  console.log('Status cases printed to inspect_status_cases.txt');
} catch (error) {
  console.error('Error:', error);
}
