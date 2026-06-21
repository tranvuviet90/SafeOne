import fs from 'fs';

try {
  const buffer = fs.readFileSync('C:\\Users\\tranv\\SafeOne\\public\\templates\\022-3 - Huấn luyện vận hành & đánh giá kết quả.doc');
  console.log('File size:', buffer.length);
  console.log('First 20 bytes (hex):', buffer.slice(0, 20).toString('hex').toUpperCase());
  console.log('First 20 bytes (chars):', JSON.stringify(buffer.slice(0, 50).toString('utf8')));
} catch (e) {
  console.error(e);
}
