async function run() {
  try {
    const url = "https://firestore.googleapis.com/v1/projects/acp360/databases/(default)/documents/documents?pageSize=100";
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Error: REST API returned status ${res.status}`);
      return;
    }
    const data = await res.json();
    const documents = data.documents || [];
    console.log(`Found ${documents.length} documents in Firestore.`);
    documents.forEach(doc => {
      // Get doc name from path
      const docPath = doc.name;
      const docId = docPath.split("/").pop();
      const fields = doc.fields || {};
      
      const title = fields.title?.stringValue || "";
      const type = fields.type?.stringValue || "";
      const isAITrained = fields.isAITrained?.booleanValue;
      const markdownContent = fields.markdownContent?.stringValue || "";
      const fileUrl = fields.fileUrl?.stringValue || "";

      console.log(`Doc ID: ${docId}`);
      console.log(`Title: ${title}`);
      console.log(`Type: ${type}`);
      console.log(`isAITrained: ${isAITrained}`);
      console.log(`fileUrl: ${fileUrl}`);
      console.log(`Has markdownContent: ${!!markdownContent} (length: ${markdownContent.length})`);
      console.log("-----------------------------------------");
    });
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

run();
