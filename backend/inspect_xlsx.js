import XLSX from 'xlsx';
import fs from 'fs';

const filePath = 'C:\\Users\\tranv\\SafeOne\\public\\templates\\CNVH.xlsx';

try {
  const workbook = XLSX.readFile(filePath);
  let summary = 'Workbook Sheets Summary:\n\n';
  
  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    summary += `========================================\n`;
    summary += `Sheet: "${sheetName}"\n`;
    summary += `Total Rows: ${data.length}\n`;
    if (data.length > 0) {
      summary += `Row 0: ${JSON.stringify(data[0])}\n`;
      summary += `Row 1: ${JSON.stringify(data[1])}\n`;
      summary += `Row 2: ${JSON.stringify(data[2])}\n`;
      summary += `Row 3: ${JSON.stringify(data[3])}\n`;
      if (data[4]) summary += `Row 4: ${JSON.stringify(data[4])}\n`;
      if (data[5]) summary += `Row 5: ${JSON.stringify(data[5])}\n`;
      if (data[6]) summary += `Row 6 (sample data): ${JSON.stringify(data[6])}\n`;
    }
    summary += `========================================\n\n`;
  });
  
  fs.writeFileSync('C:\\Users\\tranv\\SafeOne\\backend\\sheets_summary.txt', summary);
  console.log('Summary written to backend/sheets_summary.txt successfully!');
} catch (error) {
  console.error('Error:', error);
}
