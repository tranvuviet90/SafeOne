import React, { useState, useEffect } from "react";
import originalDbService from "../services/dbService";
import apiClient from "../services/apiClient";
import realtimeService from "../services/realtimeService";

let globalRefreshCallback = null;
const dbService = {
  getDoc: (col, id) => originalDbService.getDoc(col, id),
  getDocs: (col) => originalDbService.getDocs(col),
  createDoc: async (col, data) => {
    const res = await originalDbService.createDoc(col, data);
    if (globalRefreshCallback) globalRefreshCallback();
    return res;
  },
  updateDoc: async (col, id, data) => {
    const res = await originalDbService.updateDoc(col, id, data);
    if (globalRefreshCallback) globalRefreshCallback();
    return res;
  },
  deleteDoc: async (col, id) => {
    const res = await originalDbService.deleteDoc(col, id);
    if (globalRefreshCallback) globalRefreshCallback();
    return res;
  },
  commitBatch: async (ops) => {
    const res = await originalDbService.commitBatch(ops);
    if (globalRefreshCallback) globalRefreshCallback();
    return res;
  }
};

// REST API adapter (legacy doc/writeBatch shims)
// `db` is a no-op handle kept only so legacy Firebase-style call sites
// (doc(db, ...), collection(db, ...)) still type-check; the shims ignore it.
const db = null;
const doc = (_db, col, id) => ({ collection: col, id });
const collection = (_db, col) => ({ collection: col });
const addDoc = async (collectionRef, data) => {
  return await dbService.createDoc(collectionRef.collection, data);
};
const updateDoc = async (docRef, data) => {
  return await dbService.updateDoc(docRef.collection, docRef.id, data);
};
const deleteDoc = async (docRef) => {
  return await dbService.deleteDoc(docRef.collection, docRef.id);
};
const serverTimestamp = () => new Date().toISOString();
import { useToast, useConfirm } from "./LightboxSwipeOnly";
import { colors } from "../theme";
import { 
  IoDocumentsOutline, 
  IoCloudUploadOutline, 
  IoTrashOutline, 
  IoDownloadOutline, 
  IoSearchOutline, 
  IoCloseOutline, 
  IoEyeOutline, 
  IoFileTrayOutline,
  IoCreateOutline
} from "react-icons/io5";
import { normalizeRole } from "../utils/string";
import { useI18n } from "../i18n/I18nProvider";
import License from "./License";

export default function DocumentManager({ user, isMobile }) {
  const { t } = useI18n();
  const { pushToast } = useToast();
  const { askConfirm } = useConfirm();

  // Active sub-tab state: 'license' | 'sop' | 'quytrinh' | 'bieumau' | 'msds'
  const [activeSubTab, setActiveSubTab] = useState("license");
  const [documents, setDocuments] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Upload form state
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [selectedFileVi, setSelectedFileVi] = useState(null);
  const [selectedFileEn, setSelectedFileEn] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isAITrained, setIsAITrained] = useState(true);

  // Edit form state
  const [editingDoc, setEditingDoc] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editFileVi, setEditFileVi] = useState(null);
  const [editFileEn, setEditFileEn] = useState(null);
  const [editUploading, setEditUploading] = useState(false);
  const [editProgress, setEditProgress] = useState(0);



  // Roles verification
  const userRoles = user?.role ? (Array.isArray(user.role) ? user.role.map(normalizeRole) : String(user.role).split(',').map(normalizeRole)) : [];
  const isAdmin = userRoles.includes("admin");
  const canView = userRoles.some(r => ["admin", "ehs", "ehs committee", "trainer", "manager"].includes(r));
  const canViewMSDS = userRoles.some(r => ["admin", "ehs", "manager"].includes(r));

  // Fetch documents via Polling
  useEffect(() => {
    if (!canView) return;

    // Do not attempt to query MSDS if user does not have permission
    if (activeSubTab === "msds" && !canViewMSDS) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    if (activeSubTab === "license") {
      setDocuments([]);
      setLoading(false);
      return;
    }

    const fetchDocs = async () => {
      try {
        const snap = await dbService.getDocs("documents");
        const list = Array.isArray(snap) ? snap : [];
        setDocuments(list.filter(d => d.type === activeSubTab));
      } catch (err) {
        console.error("Lỗi khi tải tài liệu:", err);
        pushToast("Không thể tải danh sách tài liệu", "error");
      }
    };

    globalRefreshCallback = fetchDocs;

    setLoading(true);
    fetchDocs().finally(() => setLoading(false));

    const unsub = realtimeService.subscribeToPath("documents", () => { fetchDocs(); });

    const interval = setInterval(fetchDocs, 30000);
    return () => {
      globalRefreshCallback = null;
      unsub();
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pushToast ổn định, không cần làm dependency
  }, [canView, activeSubTab, canViewMSDS]);

  // Filter documents in memory
  const currentDocs = documents
    .filter((doc) => doc.type === activeSubTab)
    .sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA; // Descending order
    })
    .filter((doc) => {
      const matchQuery = searchQuery.trim().toLowerCase();
      if (!matchQuery) return true;
      return (
        doc.title?.toLowerCase().includes(matchQuery) ||
        doc.fileName?.toLowerCase().includes(matchQuery)
      );
    });

  // Handle file select - Vi
  const handleFileChangeVi = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      pushToast("Chỉ hỗ trợ tải lên file PDF!", "warning");
      setSelectedFileVi(null);
      e.target.value = "";
      return;
    }

    setSelectedFileVi(file);
    if (!uploadTitle) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setUploadTitle(nameWithoutExt);
    }
  };

  // Handle file select - En
  const handleFileChangeEn = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      pushToast("Chỉ hỗ trợ tải lên file PDF!", "warning");
      setSelectedFileEn(null);
      e.target.value = "";
      return;
    }

    setSelectedFileEn(file);
    if (!uploadTitle) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setUploadTitle(nameWithoutExt);
    }
  };

  // Handle document upload
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      pushToast("Bạn không có quyền thực hiện chức năng này!", "error");
      return;
    }

    if (!selectedFileVi && !selectedFileEn) {
      pushToast("Vui lòng chọn ít nhất một file PDF (Tiếng Việt hoặc Tiếng Anh)", "warning");
      return;
    }

    if (!uploadTitle.trim()) {
      pushToast("Vui lòng nhập tên tài liệu", "warning");
      return;
    }

    setUploading(true);
    setUploadProgress(10);

    try {
      let fileUrlVi = "";
      let storagePathVi = "";
      let fileUrlEn = "";
      let storagePathEn = "";

      // 1. Upload Vietnamese PDF if selected
      if (selectedFileVi) {
        setUploadProgress(20);
        const cleanFileNameVi = `${Date.now()}_vi_${selectedFileVi.name.replace(/\s+/g, "_")}`;
        const formData = new FormData();
        formData.append("file", selectedFileVi, cleanFileNameVi);
        const res = await apiClient.post("/api/storage/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        fileUrlVi = res.data.url;
        storagePathVi = cleanFileNameVi;
      }

      // 2. Upload English PDF if selected
      if (selectedFileEn) {
        setUploadProgress(50);
        const cleanFileNameEn = `${Date.now()}_en_${selectedFileEn.name.replace(/\s+/g, "_")}`;
        const formData = new FormData();
        formData.append("file", selectedFileEn, cleanFileNameEn);
        const res = await apiClient.post("/api/storage/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        fileUrlEn = res.data.url;
        storagePathEn = cleanFileNameEn;
      }

      setUploadProgress(80);
      
      // Save metadata via REST API
      const docData = {
        title: uploadTitle.trim(),
        type: activeSubTab,
        createdAt: serverTimestamp(),
        uploadedBy: user?.name || user?.email || "Admin",
        isAITrained: isAITrained,
      };

      if (selectedFileVi) {
        docData.fileUrl = fileUrlVi;
        docData.storagePath = storagePathVi;
        docData.fileName = selectedFileVi.name;
        
        docData.fileUrlVi = fileUrlVi;
        docData.storagePathVi = storagePathVi;
        docData.fileNameVi = selectedFileVi.name;
      }

      if (selectedFileEn) {
        docData.fileUrlEn = fileUrlEn;
        docData.storagePathEn = storagePathEn;
        docData.fileNameEn = selectedFileEn.name;
        
        if (!selectedFileVi) {
          docData.fileUrl = fileUrlEn;
          docData.storagePath = storagePathEn;
          docData.fileName = selectedFileEn.name;
        }
      }

      const docRef = await addDoc(collection(db, "documents"), docData);
      setUploadProgress(100);

      pushToast("Tải lên tài liệu thành công!", "success");

      // Extract markdown content asynchronously if isAITrained is true
      if (docData.fileUrl && docData.isAITrained) {
        pushToast("Đang trích xuất nội dung văn bản bằng AI...", "info");
        (async () => {
          try {
            await apiClient.post("/api/functions/extractMarkdown", { docId: docRef.id, fileUrl: docData.fileUrl });
            pushToast("AI đã huấn luyện và trích xuất tài liệu thành công!", "success");
          } catch (err) {
            console.error("Lỗi khi trích xuất AI:", err);
            pushToast("AI trích xuất tài liệu thất bại, vui lòng thử lại sau.", "error");
          }
        })();
      }
      
      // Reset form
      setUploadTitle("");
      setSelectedFileVi(null);
      setSelectedFileEn(null);
      setIsAITrained(true);
      setShowUploadForm(false);
      
      const fileInputVi = document.getElementById("pdf-file-input-vi");
      if (fileInputVi) fileInputVi.value = "";
      const fileInputEn = document.getElementById("pdf-file-input-en");
      if (fileInputEn) fileInputEn.value = "";

    } catch (error) {
      console.error("Lỗi khi tải tài liệu lên:", error);
      pushToast("Tải tài liệu lên thất bại: " + error.message, "error");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Handle document update (Admin only)
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      pushToast("Bạn không có quyền thực hiện chức năng này!", "error");
      return;
    }

    if (!editTitle.trim()) {
      pushToast("Vui lòng nhập tên tài liệu", "warning");
      return;
    }

    setEditUploading(true);
    setEditProgress(10);

    try {
      const updateData = {
        title: editTitle.trim(),
        updatedAt: serverTimestamp(),
      };

      // 1. If new Vietnamese file is selected
      if (editFileVi) {
        setEditProgress(25);
        
        // Delete old VI file if it existed
        const oldPathVi = editingDoc.storagePathVi || editingDoc.storagePath;
        if (oldPathVi) {
          try {
            const oldFilename = oldPathVi.substring(oldPathVi.lastIndexOf('/') + 1);
            await apiClient.delete(`/api/storage/${oldFilename}`);
          } catch (err) {
            console.error("Error deleting old VI file:", err);
          }
        }

        // Upload new VI file
        const cleanFileNameVi = `${Date.now()}_vi_${editFileVi.name.replace(/\s+/g, "_")}`;
        const formData = new FormData();
        formData.append("file", editFileVi, cleanFileNameVi);
        const res = await apiClient.post("/api/storage/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });

        updateData.fileUrl = res.data.url;
        updateData.storagePath = cleanFileNameVi;
        updateData.fileName = editFileVi.name;
        
        updateData.fileUrlVi = res.data.url;
        updateData.storagePathVi = cleanFileNameVi;
        updateData.fileNameVi = editFileVi.name;
      }

      // 2. If new English file is selected
      if (editFileEn) {
        setEditProgress(60);

        // Delete old EN file if it existed
        const oldPathEn = editingDoc.storagePathEn;
        if (oldPathEn) {
          try {
            const oldFilename = oldPathEn.substring(oldPathEn.lastIndexOf('/') + 1);
            await apiClient.delete(`/api/storage/${oldFilename}`);
          } catch (err) {
            console.error("Error deleting old EN file:", err);
          }
        }

        // Upload new EN file
        const cleanFileNameEn = `${Date.now()}_en_${editFileEn.name.replace(/\s+/g, "_")}`;
        const formData = new FormData();
        formData.append("file", editFileEn, cleanFileNameEn);
        const res = await apiClient.post("/api/storage/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });

        updateData.fileUrlEn = res.data.url;
        updateData.storagePathEn = cleanFileNameEn;
        updateData.fileNameEn = editFileEn.name;

        // If document had no VI file, make EN the default fileUrl too
        if (!editingDoc.fileUrlVi && !editingDoc.fileUrl && !editFileVi) {
          updateData.fileUrl = res.data.url;
          updateData.storagePath = cleanFileNameEn;
          updateData.fileName = editFileEn.name;
        }
      }

      setEditProgress(90);
      await updateDoc(doc(db, "documents", editingDoc.id), updateData);
      setEditProgress(100);

      pushToast("Cập nhật tài liệu thành công!", "success");

      // Extract markdown content asynchronously if fileUrl has been updated
      if (updateData.fileUrl) {
        pushToast("Đang cập nhật nội dung văn bản bằng AI...", "info");
        (async () => {
          try {
            await apiClient.post("/api/functions/extractMarkdown", { docId: editingDoc.id, fileUrl: updateData.fileUrl });
            pushToast("AI đã cập nhật tài liệu thành công!", "success");
          } catch (err) {
            console.error("Lỗi khi trích xuất AI:", err);
          }
        })();
      }

      setEditingDoc(null);
      setEditTitle("");
      setEditFileVi(null);
      setEditFileEn(null);
      
      const fileInputVi = document.getElementById("pdf-edit-input-vi");
      if (fileInputVi) fileInputVi.value = "";
      const fileInputEn = document.getElementById("pdf-edit-input-en");
      if (fileInputEn) fileInputEn.value = "";
    } catch (error) {
      console.error("Lỗi khi cập nhật tài liệu:", error);
      pushToast("Cập nhật tài liệu thất bại: " + error.message, "error");
    } finally {
      setEditUploading(false);
      setEditProgress(0);
    }
  };

  // Handle document delete
  const handleDelete = async (docData) => {
    if (!isAdmin) {
      pushToast("Bạn không có quyền xóa tài liệu!", "error");
      return;
    }

    const confirm = await askConfirm(
      `Bạn có chắc chắn muốn xóa tài liệu "${docData.title}" không?`,
      "Xác nhận xóa tài liệu"
    );

    if (!confirm) return;

    try {
      // 1. Delete Vietnamese file from Storage
      const pathVi = docData.storagePathVi || docData.storagePath;
      if (pathVi) {
        try {
          const fn = pathVi.substring(pathVi.lastIndexOf('/') + 1);
          await apiClient.delete(`/api/storage/${fn}`);
        } catch (storageError) {
          console.error("Lỗi khi xóa file tiếng Việt:", storageError);
        }
      }

      // 2. Delete English file from Storage
      const pathEn = docData.storagePathEn;
      if (pathEn) {
        try {
          const fn = pathEn.substring(pathEn.lastIndexOf('/') + 1);
          await apiClient.delete(`/api/storage/${fn}`);
        } catch (storageError) {
          console.error("Lỗi khi xóa file tiếng Anh:", storageError);
        }
      }

      // 3. Delete document via REST API
      await deleteDoc(doc(null, "documents", docData.id));
      pushToast("Đã xóa tài liệu thành công!", "success");
    } catch (error) {
      console.error("Lỗi khi xóa tài liệu:", error);
      pushToast("Xóa tài liệu thất bại", "error");
    }
  };

  // Format timestamp to user friendly string
  const formatTime = (ts) => {
    if (!ts) return "";
    const date = ts.toDate ? ts.toDate() : (typeof ts === 'string' ? new Date(ts) : new Date(ts.seconds * 1000));
    return date.toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!canView) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: colors.error, fontWeight: "bold" }}>
        Bạn không có quyền truy cập tab Tài liệu.
      </div>
    );
  }

  return (
    <div style={{ width: "100%", fontFamily: "inherit" }}>
      {/* Component Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ margin: "0 0 8px 0", color: colors.primary, display: "flex", alignItems: "center", gap: 10, fontSize: isMobile ? 22 : 28 }}>
          <IoDocumentsOutline /> Hệ thống Tài liệu EHS
        </h2>
        <p style={{ margin: 0, color: colors.textSecondary, fontSize: isMobile ? 14 : 16 }}>
          Tra cứu, xem trực tuyến và tải về các tài liệu MSDS, SOP, Quy trình, và Biểu mẫu an toàn.
        </p>
      </div>

      {/* Sub-tab Navigation */}
      <div style={{ 
        display: "flex", 
        width: "100%",
        boxSizing: "border-box",
        borderBottom: `2px solid ${colors.border}`, 
        marginBottom: 24, 
        overflowX: "auto",
        whiteSpace: "nowrap",
        gap: isMobile ? 3 : 6,
        paddingBottom: 2
      }} className="no-scrollbar">
        {[
          { key: "license", label: t("menu.license") || "Chứng nhận vận hành" },
          { key: "sop", label: "SOP" },
          { key: "quytrinh", label: "Quy trình" },
          { key: "bieumau", label: "Biểu mẫu" },
          { key: "msds", label: "MSDS" }
        ].map((tab) => {
          const isActive = activeSubTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveSubTab(tab.key);
                setSearchQuery("");
                setShowUploadForm(false);
              }}
              style={{
                flex: isMobile ? 1 : "initial",
                textAlign: "center",
                padding: isMobile ? "10px 4px" : "12px 24px",
                background: isActive ? colors.primary : "transparent",
                color: isActive ? colors.white : colors.textSecondary,
                border: "none",
                borderRadius: "8px 8px 0 0",
                fontSize: isMobile ? 12 : 15,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
                outline: "none",
                whiteSpace: "normal",
                wordBreak: "break-word"
              }}
              onMouseOver={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = colors.backgroundLight;
                  e.currentTarget.style.color = colors.primary;
                }
              }}
              onMouseOut={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = colors.textSecondary;
                }
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeSubTab === "license" ? (
        <License user={user} isMobile={isMobile} />
      ) : (
        <>

      {/* Toolbar Section */}
      <div style={{ 
        display: "flex", 
        flexDirection: isMobile ? "column" : "row", 
        gap: 16, 
        marginBottom: 24,
        alignItems: "stretch"
      }}>
        {/* Search Input */}
        <div style={{ 
          position: "relative", 
          flexGrow: 1,
          display: "flex",
          alignItems: "center"
        }}>
          <IoSearchOutline style={{ 
            position: "absolute", 
            left: 14, 
            color: colors.textSecondary, 
            fontSize: 18 
          }} />
          <input
            type="text"
            placeholder={`Tìm kiếm trong danh mục ${activeSubTab.toUpperCase()}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 16px 12px 42px",
              borderRadius: 10,
              border: `1.5px solid ${colors.border}`,
              fontSize: 15,
              color: colors.textPrimary,
              outline: "none",
              transition: "border-color 0.2s",
              boxSizing: "border-box",
              background: colors.white
            }}
            onFocus={(e) => e.target.style.borderColor = colors.primary}
            onBlur={(e) => e.target.style.borderColor = colors.border}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute",
                right: 12,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: colors.textSecondary,
                fontSize: 18,
                display: "flex",
                alignItems: "center",
                padding: 0
              }}
            >
              <IoCloseOutline />
            </button>
          )}
        </div>

        {/* Upload Trigger Button (Admin only) */}
        {isAdmin && (
          <button
            onClick={() => setShowUploadForm(!showUploadForm)}
            style={{
              background: showUploadForm ? colors.error : colors.primary,
              color: colors.white,
              border: "none",
              borderRadius: 10,
              padding: "0 22px",
              height: isMobile ? 48 : "auto",
              fontWeight: "bold",
              fontSize: 15,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: `0 4px 12px ${showUploadForm ? colors.error : colors.primary}33`,
              transition: "all 0.2s ease"
            }}
          >
            {showUploadForm ? (
              <>
                <IoCloseOutline fontSize={18} /> Đóng form
              </>
            ) : (
              <>
                <IoCloudUploadOutline fontSize={18} /> Thêm tài liệu
              </>
            )}
          </button>
        )}
      </div>

      {/* Upload Form Panel (Collapsible, Admin only) */}
      {isAdmin && showUploadForm && (
        <div style={{
          background: colors.backgroundLight,
          borderRadius: 14,
          padding: 20,
          marginBottom: 24,
          border: `1px solid ${colors.border}`,
          animation: "fadeIn 0.3s ease"
        }}>
          <h3 style={{ margin: "0 0 16px 0", color: colors.primaryDark, fontSize: 16, fontWeight: 700 }}>
            Tải lên tài liệu mới vào danh mục: <span style={{ textTransform: "uppercase", color: colors.primary }}>{activeSubTab}</span>
          </h3>
          <form onSubmit={handleUpload} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              {/* Title input */}
              <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 600, color: colors.textPrimary }}>
                Tên tài liệu <span style={{ color: colors.error }}>*</span>
              </label>
              <input
                type="text"
                placeholder="Nhập tiêu đề hoặc tên hiển thị của tài liệu..."
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                disabled={uploading}
                required
                style={{
                  width: "100%",
                  padding: 11,
                  borderRadius: 8,
                  border: `1.5px solid ${colors.border}`,
                  fontSize: 14,
                  boxSizing: "border-box",
                  background: colors.white,
                  outline: "none"
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 16 }}>
              {/* File picker Vi */}
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 600, color: colors.textPrimary }}>
                  File PDF Tiếng Việt (🇻🇳)
                </label>
                <input
                  id="pdf-file-input-vi"
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChangeVi}
                  disabled={uploading}
                  style={{
                    width: "100%",
                    padding: "8px 11px",
                    borderRadius: 8,
                    border: `1.5px solid ${colors.border}`,
                    fontSize: 14,
                    boxSizing: "border-box",
                    background: colors.white,
                    outline: "none"
                  }}
                />
              </div>

              {/* File picker En */}
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 600, color: colors.textPrimary }}>
                  File PDF Tiếng Anh (🇬🇧)
                </label>
                <input
                  id="pdf-file-input-en"
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChangeEn}
                  disabled={uploading}
                  style={{
                    width: "100%",
                    padding: "8px 11px",
                    borderRadius: 8,
                    border: `1.5px solid ${colors.border}`,
                    fontSize: 14,
                    boxSizing: "border-box",
                    background: colors.white,
                    outline: "none"
                  }}
                />
              </div>
            </div>

            {/* Selected Files Details */}
            {(selectedFileVi || selectedFileEn) && (
              <div style={{ fontSize: 13, color: colors.textSecondary, display: "flex", flexDirection: "column", gap: 4 }}>
                {selectedFileVi && (
                  <div>🇻🇳 Tiếng Việt: <strong>{selectedFileVi.name}</strong> ({(selectedFileVi.size / (1024 * 1024)).toFixed(2)} MB)</div>
                )}
                {selectedFileEn && (
                  <div>🇬🇧 English: <strong>{selectedFileEn.name}</strong> ({(selectedFileEn.size / (1024 * 1024)).toFixed(2)} MB)</div>
                )}
              </div>
            )}

            {/* Progress Bar */}
            {uploading && (
              <div style={{ width: "100%", background: "#e0e0e0", borderRadius: 4, height: 8, overflow: "hidden" }}>
                <div style={{ 
                  width: `${uploadProgress}%`, 
                  background: colors.primary, 
                  height: "100%", 
                  transition: "width 0.2s ease" 
                }} />
              </div>
            )}

            {/* Submit buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, marginTop: 4 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: colors.textPrimary, cursor: "pointer", marginRight: "auto" }}>
                <input
                  type="checkbox"
                  checked={isAITrained}
                  onChange={(e) => setIsAITrained(e.target.checked)}
                  disabled={uploading}
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
                Huấn luyện AI
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowUploadForm(false);
                  setUploadTitle("");
                  setSelectedFileVi(null);
                  setSelectedFileEn(null);
                  setIsAITrained(true);
                }}
                disabled={uploading}
                style={{
                  padding: "9px 18px",
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                  background: colors.white,
                  color: colors.textSecondary,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={uploading}
                style={{
                  padding: "9px 24px",
                  borderRadius: 8,
                  border: "none",
                  background: colors.primary,
                  color: colors.white,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  opacity: uploading ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}
              >
                {uploading ? "Đang tải lên..." : "Bắt đầu tải lên"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Content Area: Document List */}
      {loading ? (
        <div style={{ padding: "60px 0", textAlign: "center", color: colors.textSecondary }}>
          <div className="spinner" style={{ marginBottom: 12 }}></div>
          Đang tải dữ liệu tài liệu...
        </div>
      ) : (activeSubTab === "msds" && !canViewMSDS) ? (
        <div style={{
          padding: isMobile ? "32px 16px" : 60,
          textAlign: "center",
          border: `2px dashed ${colors.error}44`,
          borderRadius: 16,
          background: "#fff5f5",
          color: colors.error,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12
        }}>
          <div style={{ fontSize: 48 }}>🔒</div>
          <div>
            <h3 style={{ margin: "0 0 4px 0", color: "#c92a2a", fontSize: 16, fontWeight: 700 }}>Quyền truy cập bị giới hạn</h3>
            <p style={{ margin: 0, fontSize: 14, color: "#e03131" }}>
              Chỉ người dùng có vai trò <strong>Admin, EHS</strong> hoặc <strong>Manager</strong> mới được phép xem tài liệu MSDS.
            </p>
          </div>
        </div>
      ) : currentDocs.length === 0 ? (
        <div style={{
          padding: isMobile ? "32px 16px" : 60,
          textAlign: "center",
          border: `2px dashed ${colors.border}`,
          borderRadius: 16,
          background: colors.background,
          color: colors.textSecondary,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12
        }}>
          <IoFileTrayOutline size={48} style={{ color: colors.primaryLight }} />
          <div>
            <h3 style={{ margin: "0 0 4px 0", color: colors.textPrimary, fontSize: 16, fontWeight: 700 }}>Không tìm thấy tài liệu nào</h3>
            <p style={{ margin: 0, fontSize: 14 }}>
              {searchQuery ? "Không có kết quả nào khớp với từ khóa tìm kiếm." : `Chưa có tài liệu nào trong danh mục ${activeSubTab.toUpperCase()}.`}
            </p>
          </div>
          {isAdmin && !searchQuery && (
            <button
              onClick={() => setShowUploadForm(true)}
              style={{
                marginTop: 8,
                padding: "8px 16px",
                borderRadius: 8,
                background: colors.primary,
                color: colors.white,
                border: "none",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Tải lên tài liệu đầu tiên
            </button>
          )}
        </div>
      ) : (
        /* Document Cards Grid */
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: 16
        }}>
          {currentDocs.map((docItem) => (
            <div
              key={docItem.id}
              style={{
                background: colors.white,
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 14,
                boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
                transition: "all 0.2s ease-in-out",
                cursor: "default",
                minWidth: 0
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.boxShadow = "0 6px 16px rgba(70,110,115,0.08)";
                e.currentTarget.style.borderColor = colors.primaryLight;
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.02)";
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {/* Card Header & Metadata */}
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                {/* PDF Icon Badge */}
                <div style={{
                  background: "linear-gradient(135deg, #FF6B6B 0%, #E63946 100%)",
                  borderRadius: 10,
                  width: 44,
                  height: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: colors.white,
                  fontWeight: 900,
                  fontSize: 13,
                  boxShadow: "0 4px 10px rgba(230,57,70,0.25)"
                }}>
                  PDF
                </div>
                
                {/* Text Metadata */}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h4 style={{ 
                    margin: "0 0 6px 0", 
                    color: colors.textPrimary, 
                    fontSize: 16, 
                    fontWeight: 700,
                    lineHeight: 1.3,
                    wordBreak: "break-word"
                  }}>
                    {docItem.title}
                  </h4>
                  <div style={{ 
                    fontSize: 12, 
                    color: colors.textSecondary,
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                    minWidth: 0,
                    width: "100%"
                  }}>
                    {(docItem.fileNameVi || docItem.fileUrlVi || docItem.fileName) && (
                      <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", display: "block", width: "100%" }}>
                        🇻🇳 Tiếng Việt: {docItem.fileNameVi || docItem.fileName}
                      </span>
                    )}
                    {(docItem.fileNameEn || docItem.fileUrlEn) && (
                      <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", display: "block", width: "100%" }}>
                        🇬🇧 English: {docItem.fileNameEn}
                      </span>
                    )}
                    <span>
                      Đăng bởi: <strong>{docItem.uploadedBy}</strong>
                    </span>
                    <span>
                      Ngày đăng: {formatTime(docItem.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "flex-end", 
                gap: 8,
                borderTop: `1px solid ${colors.backgroundLight}`,
                paddingTop: 12,
                flexWrap: "wrap"
              }}>
                {/* AI Train button (Admin only, if missing markdownContent) */}
                {isAdmin && docItem.isAITrained && !docItem.markdownContent && (
                  <button
                    onClick={async () => {
                      pushToast("Đang trích xuất nội dung văn bản bằng AI...", "info");
                      try {
                        await apiClient.post("/api/functions/extractMarkdown", { docId: docItem.id, fileUrl: docItem.fileUrlVi || docItem.fileUrl || docItem.fileUrlEn });
                        pushToast("AI đã trích xuất tài liệu thành công!", "success");
                      } catch (err) {
                        console.error("Lỗi khi trích xuất AI:", err);
                        pushToast("AI trích xuất thất bại", "error");
                      }
                    }}
                    title="Phân tích nội dung AI"
                    style={{
                      background: "none",
                      border: `1.5px solid ${colors.primary}44`,
                      borderRadius: 8,
                      width: 36,
                      height: 36,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: colors.primary,
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = colors.backgroundLight;
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = "none";
                    }}
                  >
                    🤖
                  </button>
                )}

                {/* Edit button (Admin only) */}
                {isAdmin && (
                  <button
                    onClick={() => {
                      setEditingDoc(docItem);
                      setEditTitle(docItem.title || "");
                      setEditFileVi(null);
                      setEditFileEn(null);
                    }}
                    title="Chỉnh sửa tài liệu"
                    style={{
                      background: "none",
                      border: `1.5px solid ${colors.primary}44`,
                      borderRadius: 8,
                      width: 36,
                      height: 36,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: colors.primary,
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = colors.primary;
                      e.currentTarget.style.color = colors.white;
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = "none";
                      e.currentTarget.style.color = colors.primary;
                    }}
                  >
                    <IoCreateOutline fontSize={16} />
                  </button>
                )}

                {/* Delete button (Admin only) */}
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(docItem)}
                    title="Xóa tài liệu"
                    style={{
                      background: "none",
                      border: `1.5px solid ${colors.error}44`,
                      borderRadius: 8,
                      width: 36,
                      height: 36,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: colors.error,
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = colors.error;
                      e.currentTarget.style.color = colors.white;
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = "none";
                      e.currentTarget.style.color = colors.error;
                    }}
                  >
                    <IoTrashOutline fontSize={16} />
                  </button>
                )}

                {/* Download button */}
                <a
                  href={docItem.fileUrlVi || docItem.fileUrl || docItem.fileUrlEn}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={docItem.fileNameVi || docItem.fileName || docItem.fileNameEn}
                  title="Tải về file PDF"
                  style={{
                    background: "none",
                    border: `1.5px solid ${colors.primary}44`,
                    borderRadius: 8,
                    width: 36,
                    height: 36,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: colors.primary,
                    cursor: "pointer",
                    textDecoration: "none",
                    boxSizing: "border-box",
                    transition: "all 0.2s ease"
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = colors.backgroundLight;
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = "none";
                  }}
                >
                  <IoDownloadOutline fontSize={16} />
                </a>

                {/* View button */}
                <button
                  onClick={() => {
                    const url = docItem.fileUrlVi || docItem.fileUrl || docItem.fileUrlEn;
                    if (url) {
                      window.open(url, "_blank");
                    } else {
                      pushToast("Tài liệu không có đường dẫn trực tiếp", "warning");
                    }
                  }}
                  style={{
                    background: colors.primary,
                    color: colors.white,
                    border: "none",
                    borderRadius: 8,
                    padding: "0 14px",
                    height: 36,
                    fontWeight: "bold",
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    transition: "background 0.2s"
                  }}
                  onMouseOver={(e) => e.target.style.background = colors.primaryDark}
                  onMouseOut={(e) => e.target.style.background = colors.primary}
                >
                  <IoEyeOutline fontSize={14} /> Xem trực tiếp
                </button>
              </div>
            </div>
          ))}
        </div>
      )}



      {/* Edit Document Modal Overlay - Admin only */}
      {isAdmin && editingDoc && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: 16
        }}>
          <div style={{
            background: "white",
            padding: 24,
            borderRadius: 14,
            width: "100%",
            maxWidth: 550,
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            animation: "fadeIn 0.2s ease"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, borderBottom: `1px solid ${colors.border}`, paddingBottom: 12 }}>
              <h3 style={{ margin: 0, color: colors.primaryDark, fontSize: 18, fontWeight: 700 }}>✏️ Chỉnh sửa tài liệu</h3>
              <button
                onClick={() => setEditingDoc(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: colors.textSecondary, fontSize: 20 }}
              >
                <IoCloseOutline />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Tên tài liệu */}
              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 600, color: colors.textPrimary }}>
                  Tên tài liệu <span style={{ color: colors.error }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Nhập tiêu đề hoặc tên hiển thị mới..."
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  disabled={editUploading}
                  required
                  style={{
                    width: "100%",
                    padding: 11,
                    borderRadius: 8,
                    border: `1.5px solid ${colors.border}`,
                    fontSize: 14,
                    boxSizing: "border-box",
                    background: colors.white,
                    outline: "none"
                  }}
                />
              </div>

              {/* PDF Tiếng Việt */}
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: 600, color: colors.textPrimary }}>
                  File Tiếng Việt (🇻🇳)
                </label>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>
                  Hiện tại: {editingDoc.fileNameVi || editingDoc.fileName || "Chưa có file"}
                </div>
                <input
                  id="pdf-edit-input-vi"
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => {
                    const f = e.target.files[0];
                    if (f && f.type === "application/pdf") setEditFileVi(f);
                    else if (f) pushToast("Chỉ hỗ trợ tải lên file PDF!", "warning");
                  }}
                  disabled={editUploading}
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: `1.5px solid ${colors.border}`,
                    fontSize: 13,
                    boxSizing: "border-box",
                    background: colors.white,
                    outline: "none"
                  }}
                />
              </div>

              {/* PDF Tiếng Anh */}
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: 600, color: colors.textPrimary }}>
                  File Tiếng Anh (🇬🇧)
                </label>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>
                  Hiện tại: {editingDoc.fileNameEn || "Chưa có file"}
                </div>
                <input
                  id="pdf-edit-input-en"
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => {
                    const f = e.target.files[0];
                    if (f && f.type === "application/pdf") setEditFileEn(f);
                    else if (f) pushToast("Chỉ hỗ trợ tải lên file PDF!", "warning");
                  }}
                  disabled={editUploading}
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: `1.5px solid ${colors.border}`,
                    fontSize: 13,
                    boxSizing: "border-box",
                    background: colors.white,
                    outline: "none"
                  }}
                />
              </div>

              {/* Progress bar */}
              {editUploading && (
                <div style={{ width: "100%", background: "#e0e0e0", borderRadius: 4, height: 8, overflow: "hidden" }}>
                  <div style={{ 
                    width: `${editProgress}%`, 
                    background: colors.primary, 
                    height: "100%", 
                    transition: "width 0.2s ease" 
                  }} />
                </div>
              )}

              {/* Nút lưu */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8, borderTop: `1px solid ${colors.border}`, paddingTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setEditingDoc(null)}
                  disabled={editUploading}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 8,
                    border: `1px solid ${colors.border}`,
                    background: colors.white,
                    color: colors.textSecondary,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={editUploading}
                  style={{
                    padding: "9px 24px",
                    borderRadius: 8,
                    border: "none",
                    background: colors.primary,
                    color: colors.white,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    opacity: editUploading ? 0.7 : 1,
                  }}
                >
                  {editUploading ? "Đang cập nhật..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
