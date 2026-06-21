import XLSX from 'xlsx';
import pool from './db.js';

const filePath = 'C:\\Users\\tranv\\SafeOne\\public\\templates\\CNVH.xlsx';

function formatExcelDate(serial) {
  if (!serial) return null;
  if (typeof serial === 'string') {
    return serial.trim();
  }
  if (typeof serial === 'number') {
    const date = new Date((serial - 25569) * 86400 * 1000);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

const DEPT_MAP = {
  'G_Cutting': 'Golf Cutting',
  'G_Rolling': 'Golf Rolling',
  'G_Finishing': 'Golf Finishing',
  'G_Buffing': 'Golf Buffing',
  'G_Dipping': 'Golf Dipping',
  'G_Graphics': 'Golf Graphics',
  'A_Blank': 'Arrow Blank',
  'A_Graphics': 'Arrow Graphics',
  'Kayak': 'Kayak',
  'QC': 'QC'
};

async function seedData() {
  try {
    const workbook = XLSX.readFile(filePath);
    
    // Ensure firestore_mock table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS firestore_mock (
        collection VARCHAR(128) NOT NULL,
        id VARCHAR(128) NOT NULL,
        data JSON NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (collection, id)
      ) ENGINE=InnoDB;
    `);
    
    console.log('Clearing old cnvh data in firestore_mock...');
    await pool.query("DELETE FROM firestore_mock WHERE collection = 'operation_certifications'");
    await pool.query("DELETE FROM firestore_mock WHERE collection = 'operation_certifications_chart'");
    
    const detailSheets = [
      'G_Cutting', 'G_Rolling', 'G_Finishing', 'G_Buffing', 'G_Dipping', 'G_Graphics',
      'A_Blank', 'A_Graphics', 'Kayak', 'QC'
    ];
    
    let totalEmployees = 0;
    
    for (const sheetName of detailSheets) {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        console.warn(`Sheet ${sheetName} not found, skipping.`);
        continue;
      }
      
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      if (data.length <= 6) continue;
      
      const headerRow = data[4] || [];
      const subHeaderRow = data[5] || [];
      
      // Find dynamic column offsets
      let evalDateIndex = -1;
      for (let c = 0; c < headerRow.length; c++) {
        const val = String(headerRow[c] || '').toUpperCase();
        if (val.includes('NGÀY') && val.includes('ĐÁNH GIÁ')) {
          evalDateIndex = c;
          break;
        }
      }
      
      const statusColIndex = subHeaderRow.indexOf('HIỆN TRẠNG');
      const reasonColIndex = subHeaderRow.indexOf('LÝ DO');
      const targetDateColIndex = subHeaderRow.indexOf('NGÀY DỰ KIẾN \r\nHOÀN THÀNH') !== -1 
        ? subHeaderRow.indexOf('NGÀY DỰ KIẾN \r\nHOÀN THÀNH')
        : subHeaderRow.indexOf('NGÀY DỰ KIẾN HOÀN THÀNH');
      
      if (statusColIndex === -1 || evalDateIndex === -1) {
        console.warn(`Could not find required columns in sheet ${sheetName}, skipping.`);
        continue;
      }
      
      const trainingStartCol = evalDateIndex + 1;
      
      // Determine training items
      const trainingItems = [];
      for (let c = trainingStartCol; c < statusColIndex; c++) {
        if (subHeaderRow[c]) {
          trainingItems.push({
            index: c,
            name: subHeaderRow[c].trim().replace(/\r?\n/g, ' ')
          });
        }
      }
      
      console.log(`Parsing sheet ${sheetName}: training items start at index ${trainingStartCol}, found ${trainingItems.length} items.`);
      
      for (let r = 6; r < data.length; r++) {
        const row = data[r];
        if (!row || row.length === 0 || row[1] === undefined || row[1] === null || row[1] === '') continue;
        
        const msnv = String(row[1]).trim();
        const name = String(row[2]).trim();
        const role = row[3] ? String(row[3]).trim() : '';
        const position = row[4] ? String(row[4]).trim() : '';
        const department = DEPT_MAP[sheetName] || row[5] || sheetName;
        const evalDate = formatExcelDate(row[evalDateIndex]);
        
        const status = row[statusColIndex] ? String(row[statusColIndex]).trim() : 'Thiếu chứng nhận';
        const reason = row[reasonColIndex] ? String(row[reasonColIndex]).trim() : null;
        
        let targetDate = null;
        if (targetDateColIndex !== -1 && row[targetDateColIndex]) {
          targetDate = formatExcelDate(row[targetDateColIndex]);
        }
        
        // Populate training items status
        const itemStatus = {};
        trainingItems.forEach(item => {
          const val = row[item.index];
          itemStatus[item.name] = (val === true || val === 1 || String(val).toUpperCase() === 'X' || String(val).toUpperCase() === 'TRUE');
        });
        
        const record = {
          msnv,
          name,
          role,
          position,
          department,
          deptCode: sheetName,
          evalDate,
          status,
          reason,
          targetDate,
          trainingItems: itemStatus,
          updatedBy: 'system',
          updatedAt: new Date().toISOString()
        };
        
        const docId = `${sheetName}_${msnv}`;
        await pool.query(
          "INSERT INTO firestore_mock (collection, id, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)",
          ['operation_certifications', docId, JSON.stringify(record)]
        );
        
        totalEmployees++;
      }
      console.log(`Seeded ${sheetName}: ${totalEmployees} total records.`);
    }
    
    // Parse Chart Data Sheet
    const dataSheet = workbook.Sheets['Data'];
    if (dataSheet) {
      console.log('Seeding chart data...');
      const rows = XLSX.utils.sheet_to_json(dataSheet, { header: 1 });
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row[12] === undefined || row[12] === null || row[12] === '') continue;
        
        const week = String(row[12]).trim();
        const dataObj = {
          week,
          G_Cutting: Number(row[13]) || 0,
          G_Rolling: Number(row[14]) || 0,
          G_Finishing: Number(row[15]) || 0,
          G_Buffing: Number(row[16]) || 0,
          G_Dipping: Number(row[17]) || 0,
          G_Graphics: Number(row[18]) || 0,
          A_Blank: Number(row[19]) || 0,
          A_Graphics: Number(row[20]) || 0,
          Kayak: Number(row[21]) || 0,
          total: Number(row[22]) || 0
        };
        
        await pool.query(
          "INSERT INTO firestore_mock (collection, id, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)",
          ['operation_certifications_chart', week, JSON.stringify(dataObj)]
        );
      }
      console.log('Chart data seeded successfully!');
    }
    
    console.log(`\nSUCCESS: Seeded ${totalEmployees} employee records and chart data.`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

seedData();
