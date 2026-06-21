import pool from "../backend/db.js";

async function run() {
  try {
    console.log("Querying firestore_mock for documents...");
    const [rows] = await pool.query(
      "SELECT id, data FROM firestore_mock WHERE collection = ?",
      ["documents"]
    );
    console.log(`Found ${rows.length} documents in MySQL.`);
    rows.forEach(r => {
      const data = typeof r.data === "string" ? JSON.parse(r.data) : r.data;
      console.log(`ID: ${r.id}`);
      console.log(`Title: ${data.title}`);
      console.log(`Type: ${data.type}`);
      console.log(`isAITrained: ${data.isAITrained}`);
      console.log(`Has markdownContent: ${!!data.markdownContent}`);
      if (data.markdownContent) {
        console.log(`Markdown length: ${data.markdownContent.length}`);
      }
      console.log("-----------------------------------");
    });
    pool.end();
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
