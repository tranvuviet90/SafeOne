import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { 
  getFirestore, collection, query, where, getDocs, doc, 
  getDoc, setDoc, deleteDoc, updateDoc, writeBatch 
} from "firebase/firestore";
import dotenv from "dotenv";
import readline from "readline";
import { exec } from "child_process";
import fs from "fs";

// Load Firebase configuration
if (fs.existsSync(".env.local")) {
  dotenv.config({ path: ".env.local" });
} else {
  dotenv.config();
}

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

async function runLocalMigration() {
  console.log("\n--- [1/2] ĐANG THỰC HIỆN DI CƯ DỮ LIỆU MYSQL CỤC BỘ ---");
  const mysqlCmd = 'C:\\xampp\\mysql\\bin\\mysql.exe';
  if (!fs.existsSync(mysqlCmd)) {
    console.log("ℹ️ Không tìm thấy đường dẫn MySQL XAMPP cục bộ. Bỏ qua bước di cư MySQL.");
    return;
  }

  const dbName = 'safeone';

  // 1. Update gemba_scores key
  const sql1 = `UPDATE IGNORE gemba_scores SET department = 'A_Blank' WHERE department = 'Arrow'; DELETE FROM gemba_scores WHERE department = 'Arrow';`;
  // 2. Update gemba_events event_data
  const sql2 = `UPDATE gemba_events SET event_data = JSON_SET(event_data, '$.department', 'A_Blank') WHERE event_data->>'$.department' = 'Arrow';`;
  // 3. Update tu_gemba_logs if exists
  const sql3 = `UPDATE tu_gemba_logs SET event_data = JSON_SET(event_data, '$.department', 'A_Blank') WHERE event_data->>'$.department' = 'Arrow';`;

  const runSql = (sql) => new Promise((resolve) => {
    exec(`"${mysqlCmd}" -u root -e "use ${dbName}; ${sql}"`, (err, stdout, stderr) => {
      resolve();
    });
  });

  try {
    await runSql(sql1);
    await runSql(sql2);
    await runSql(sql3);
    console.log("✅ Đã cập nhật xong dữ liệu Arrow -> A_Blank trong MySQL cục bộ (nếu có bảng)!");
  } catch (err) {
    console.warn("⚠️ Có lỗi khi cập nhật MySQL:", err.message);
  }
}

async function runFirestoreMigration() {
  console.log("\n--- [2/2] ĐANG TIẾN HÀNH DI CƯ DỮ LIỆU FIRESTORE (PRODUCTION) ---");
  if (!firebaseConfig.apiKey) {
    console.error("❌ Không tìm thấy cấu hình Firebase trong tệp .env.local!");
    return;
  }

  console.log(`Đang kết nối tới dự án Firebase: ${firebaseConfig.projectId}`);
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log("\nYêu cầu xác thực tài khoản có quyền EHS/Admin để thực hiện cập nhật.");
  const email = await askQuestion("Nhập Email của bạn: ");
  const password = await askQuestion("Nhập Mật khẩu: ");

  try {
    console.log("Đang đăng nhập...");
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log(`✅ Đăng nhập thành công! User: ${userCredential.user.email}`);

    const batch = writeBatch(db);

    // 1. Migrate gemba_events
    console.log("\n1. Đang quét bộ sưu tập 'gemba_events'...");
    const eventsRef = collection(db, "gemba_events");
    const qEvents = query(eventsRef, where("department", "==", "Arrow"));
    const snapEvents = await getDocs(qEvents);
    let eventCount = 0;
    
    snapEvents.forEach(docSnap => {
      batch.update(docSnap.ref, { department: "A_Blank" });
      eventCount++;
    });
    console.log(`-> Tìm thấy ${eventCount} sự cố của bộ phận Arrow.`);

    // 2. Migrate tu_gemba_logs
    console.log("\n2. Đang quét bộ sưu tập 'tu_gemba_logs'...");
    const logsRef = collection(db, "tu_gemba_logs");
    const qLogs = query(logsRef, where("department", "==", "Arrow"));
    const snapLogs = await getDocs(qLogs);
    let logCount = 0;
    
    snapLogs.forEach(docSnap => {
      batch.update(docSnap.ref, { department: "A_Blank" });
      logCount++;
    });
    console.log(`-> Tìm thấy ${logCount} nhật ký tự Gemba của bộ phận Arrow.`);

    // 3. Migrate gemba_scores
    console.log("\n3. Đang quét điểm số 'gemba_scores'...");
    const scoreArrowRef = doc(db, "gemba_scores", "Arrow");
    const scoreArrowSnap = await getDoc(scoreArrowRef);
    let migratedScore = false;

    if (scoreArrowSnap.exists()) {
      const data = scoreArrowSnap.data();
      const scoreABlankRef = doc(db, "gemba_scores", "A_Blank");
      batch.set(scoreABlankRef, data);
      batch.delete(scoreArrowRef);
      migratedScore = true;
      console.log("-> Đã phát hiện và sẽ chuyển tài liệu điểm số của Arrow sang A_Blank.");
    } else {
      console.log("-> Không phát hiện điểm số riêng biệt của Arrow.");
    }

    if (eventCount > 0 || logCount > 0 || migratedScore) {
      console.log("\nĐang gửi lệnh cập nhật hàng loạt (commit batch) lên Firestore...");
      await batch.commit();
      console.log("✅ Đã hoàn tất di cư dữ liệu Firestore thành công!");
    } else {
      console.log("\n✅ Không có dữ liệu nào cần di cư trên Firestore.");
    }

  } catch (err) {
    console.error("❌ Đã xảy ra lỗi trong quá trình di cư Firestore:", err.message);
  }
}

async function main() {
  await runLocalMigration();
  const choice = await askQuestion("\nBạn có muốn di cư dữ liệu trên Firestore (Production) không? (y/n): ");
  if (choice.trim().toLowerCase() === 'y') {
    await runFirestoreMigration();
  }
  rl.close();
}

main();
