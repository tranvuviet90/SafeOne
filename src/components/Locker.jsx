import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, doc, setDoc, writeBatch, arrayUnion, updateDoc, deleteField } from "firebase/firestore";
import { colors } from "../theme";
import { useConfirm, useToast } from "./LightboxSwipeOnly";
import { useI18n } from "../i18n/I18nProvider";

const DEPARTMENTS = [
  "Cutting", "Rolling", "Finishing", "Dipping", "Graphics", "QC", "Warehouse",
  "A_Blank", "A_Cosmetic", "MTN", "ENG", "Office", "Bảo Vệ", "Tạp Vụ", "Khác"
];

function getId(prefix, num) {
  return prefix + String(num).padStart(2, '0');
}

function maskPhoneNumber(phone) {
  if (!phone) return "";
  const cleaned = String(phone).trim();
  if (cleaned.length < 6) return "****";
  return cleaned.substring(0, 3) + "****" + cleaned.substring(cleaned.length - 3);
}

// Cấu trúc Sơ đồ Tủ đồ theo sơ đồ Excel
const LOCKER_LAYOUTS = {
  A: {
    name: "Khu A (A01 - A126)",
    groups: [
      {
        blocks: [
          { name: "Block 1", idPattern: (r, c) => getId("A", 0 * 18 + r * 3 + c + 1) },
          { name: "Block 2", idPattern: (r, c) => getId("A", 1 * 18 + r * 3 + c + 1) },
          { name: "Block 3", idPattern: (r, c) => getId("A", 2 * 18 + r * 3 + c + 1) },
          { name: "Block 4", idPattern: (r, c) => getId("A", 3 * 18 + r * 3 + c + 1) },
          { name: "Block 5", idPattern: (r, c) => getId("A", 4 * 18 + r * 3 + c + 1) },
          { name: "Block 6", idPattern: (r, c) => getId("A", 5 * 18 + r * 3 + c + 1) },
          { name: "Block 7", idPattern: (r, c) => getId("A", 6 * 18 + r * 3 + c + 1) },
        ]
      }
    ]
  },
  B: {
    name: "Khu B (B01 - B123)",
    groups: [
      {
        blocks: [
          { name: "Block 1", idPattern: (r, c) => getId("B", r * 21 + 0 * 3 + c + 1) },
          { name: "Block 2", idPattern: (r, c) => getId("B", r * 21 + 1 * 3 + c + 1) },
          { name: "Block 3", idPattern: (r, c) => getId("B", r * 21 + 2 * 3 + c + 1) },
          { name: "Block 4", idPattern: (r, c) => getId("B", r * 21 + 3 * 3 + c + 1) },
          { name: "Block 5", idPattern: (r, c) => getId("B", r * 21 + 4 * 3 + c + 1) },
          { name: "Block 6", idPattern: (r, c) => getId("B", r * 21 + 5 * 3 + c + 1) },
        ]
      }
    ]
  },
  R: {
    name: "Khu R (R01 - R210)",
    groups: [
      {
        title: "R Phía Trên",
        blocks: [
          { name: "Block 1", idPattern: (r, c) => getId("R", r * 15 + 0 * 3 + c + 1) },
          { name: "Block 2", idPattern: (r, c) => getId("R", r * 15 + 1 * 3 + c + 1) },
          { name: "Block 3", idPattern: (r, c) => getId("R", r * 15 + 2 * 3 + c + 1) },
          { name: "Block 4", idPattern: (r, c) => getId("R", r * 15 + 3 * 3 + c + 1) },
          { name: "Block 5", idPattern: (r, c) => getId("R", r * 15 + 4 * 3 + c + 1) },
          { name: "Block 6", cols: 2, idPattern: (r, c) => getId("R", 199 + r * 2 + c) },
        ]
      },
      {
        title: "R Phía Dưới",
        blocks: [
          { name: "Block 91-126", cols: 6, idPattern: (r, c) => getId("R", 91 + r * 6 + c) },
          { name: "Block 3", idPattern: (r, c) => getId("R", 127 + r * 3 + c) },
          { name: "Block 4", idPattern: (r, c) => getId("R", 145 + r * 3 + c) },
          { name: "Block 5", idPattern: (r, c) => getId("R", 163 + r * 3 + c) },
          { name: "Block 6", idPattern: (r, c) => getId("R", 181 + r * 3 + c) },
        ]
      }
    ]
  },
  D: {
    name: "Khu D (D01 - D234)",
    groups: [
      {
        title: "D Phía Trên",
        blocks: [
          { name: "Block 1-2", cols: 6, idPattern: (r, c) => getId("D", 1 + r * 6 + c) },
          { name: "Block 3-4", cols: 6, idPattern: (r, c) => getId("D", 37 + r * 6 + c) },
          { name: "Block 5-6", cols: 6, idPattern: (r, c) => getId("D", 127 + r * 6 + c) },
        ]
      },
      {
        title: "D Phía Dưới",
        blocks: [
          { name: "Block 7", idPattern: (r, c) => getId("D", 163 + r * 3 + c) },
          { name: "Block 8", idPattern: (r, c) => getId("D", 181 + r * 3 + c) },
          { name: "Block 9-11", cols: 9, idPattern: (r, c) => getId("D", 73 + r * 9 + c) },
          { name: "Block 12", idPattern: (r, c) => getId("D", 199 + r * 3 + c) },
          { name: "Block 13", idPattern: (r, c) => getId("D", 217 + r * 3 + c) },
        ]
      }
    ]
  },
  Q: {
    name: "Khu Q (Q01 - Q144)",
    groups: [
      {
        title: "Q Hàng Ngang",
        blocks: [
          { name: "Block 1", idPattern: (r, c) => getId("Q", r * 9 + 0 * 3 + c + 1) },
          { name: "Block 2", idPattern: (r, c) => getId("Q", r * 9 + 1 * 3 + c + 1) },
          { name: "Block 4", idPattern: (r, c) => getId("Q", 55 + r * 3 + c) },
          { name: "Block 5-8", cols: 12, idPattern: (r, c) => getId("Q", 73 + r * 12 + c) },
        ]
      },
      {
        title: "Khối Q Rời (Isolated Q07 - Q54)",
        blocks: [
          { name: "Block 3", idPattern: (r, c) => getId("Q", r * 9 + 2 * 3 + c + 1) }
        ]
      }
    ]
  },
  F: {
    name: "Khu F (F01 - F90)",
    groups: [
      {
        title: "F Phía Trên",
        blocks: [
          { name: "Block 1", idPattern: (r, c) => getId("F", r * 15 + 0 * 3 + c + 1) },
          { name: "Block 2", idPattern: (r, c) => getId("F", r * 15 + 1 * 3 + c + 1) },
          { name: "Block 3", idPattern: (r, c) => getId("F", r * 15 + 2 * 3 + c + 1) },
        ]
      },
      {
        title: "F Phía Dưới",
        blocks: [
          { name: "Block 4", idPattern: (r, c) => getId("F", r * 15 + 9 + 0 * 3 + c + 1) },
          { name: "Block 5", idPattern: (r, c) => getId("F", r * 15 + 9 + 1 * 3 + c + 1) },
        ]
      }
    ]
  }
};

export default function Locker({ user }) {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();

  const [activeZone, setActiveZone] = useState("A");
  const [lockersData, setLockersData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedLockerId, setSelectedLockerId] = useState(null);
  const [currentViewTab, setCurrentViewTab] = useState("map"); // "map" | "list" | "print" | "config"

  // Tìm kiếm
  const [searchQuery, setSearchQuery] = useState("");

  // Cấu hình EHS
  const [configSuccessText, setConfigSuccessText] = useState("");
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Sửa mô tả khu vực trực tiếp bằng cây bút ✏️
  const [showEditDescModal, setShowEditDescModal] = useState(false);
  const [tempDesc, setTempDesc] = useState("");

  // Kéo thả block layout
  const [draggedBlockInfo, setDraggedBlockInfo] = useState(null); // { groupIdx, blockName }

  // Phân quyền người dùng hiện tại
  const userRolesList = user?.role ? (Array.isArray(user.role) ? user.role.map(r => String(r).toLowerCase()) : String(user.role).split(',').map(r => r.trim().toLowerCase())) : [];
  const isEhsOrAdmin = userRolesList.some(r => r === 'admin' || r === 'ehs');

  // Load tủ đồ thời gian thực từ Firestore
  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(collection(db, "lockers"), (snap) => {
      const data = {};
      snap.forEach((doc) => {
        data[doc.id] = doc.data();
      });
      setLockersData(data);
      setLoading(false);
    }, (err) => {
      console.error("Lỗi onSnapshot lockers:", err);
      toast.show("Không thể tải dữ liệu tủ đồ.", "error");
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Ánh xạ dữ liệu cài đặt từ Firestore
  useEffect(() => {
    if (lockersData.settings) {
      const s = lockersData.settings;
      setConfigSuccessText(s.successNotificationText || "Đăng ký tủ đồ thành công! Yêu cầu của bạn đang chờ EHS duyệt.");
    } else {
      setConfigSuccessText("Đăng ký tủ đồ thành công! Yêu cầu của bạn đang chờ EHS duyệt.");
    }
  }, [lockersData.settings]);

  const globalSettings = lockersData.settings || {
    successNotificationText: "Đăng ký tủ đồ thành công! Yêu cầu của bạn đang chờ EHS duyệt.",
    zoneDescriptions: { A: "", B: "", R: "", D: "", Q: "", F: "" },
    blockOrder: {}
  };

  // Tính toán thống kê
  const stats = React.useMemo(() => {
    let total = 0;
    let occupied = 0;
    let pending = 0;
    
    // Đếm tất cả tủ được định nghĩa trong map
    Object.keys(LOCKER_LAYOUTS).forEach(zone => {
      LOCKER_LAYOUTS[zone].groups.forEach(group => {
        group.blocks.forEach(block => {
          const cols = block.cols || 3;
          total += cols * 6;
        });
      });
    });

    Object.keys(lockersData).forEach(id => {
      if (id !== "settings") {
        const info = lockersData[id]?.currentUser;
        if (info) {
          if (info.status === "pending") {
            pending++;
          } else {
            occupied++;
          }
        }
      }
    });

    return { total, occupied, pending, vacant: total - occupied - pending };
  }, [lockersData]);

  // Sắp xếp blocks dựa vào cấu hình kéo thả blockOrder
  const getSortedBlocks = (group, groupIndex) => {
    const customOrder = globalSettings.blockOrder?.[`${activeZone}_${groupIndex}`] || [];
    if (customOrder.length === 0) return group.blocks;
    
    return [...group.blocks].sort((a, b) => {
      const idxA = customOrder.indexOf(a.name);
      const idxB = customOrder.indexOf(b.name);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  };

  // Thu hồi tủ đồ hoặc từ chối yêu cầu đăng ký
  async function handleReleaseLocker(lockerId) {
    const locker = lockersData[lockerId];
    if (!locker || !locker.currentUser) return;

    const isPending = locker.currentUser.status === "pending";
    const confirmMsg = isPending 
      ? `Bạn có chắc chắn muốn TỪ CHỐI yêu cầu đăng ký tủ ${lockerId} của nhân viên ${locker.currentUser.name}?`
      : `Bạn có chắc chắn muốn THU HỒI tủ đồ ${lockerId} từ nhân viên ${locker.currentUser.name}?`;
    const confirmTitle = isPending ? "Xác nhận từ chối đăng ký" : "Xác nhận thu hồi tủ";

    if (await confirm.askConfirm(confirmMsg, confirmTitle)) {
      try {
        const docRef = doc(db, "lockers", lockerId);
        const historyItem = {
          ...locker.currentUser,
          action: isPending ? "rejected" : "released",
          timestamp: new Date().toISOString()
        };
        await setDoc(docRef, {
          currentUser: null,
          history: arrayUnion(historyItem)
        }, { merge: true });
        toast.show(isPending ? `Đã từ chối đăng ký tủ ${lockerId}.` : `Đã thu hồi tủ ${lockerId} thành công.`, "success");
        setSelectedLockerId(null);
      } catch (err) {
        console.error("Lỗi xử lý thu hồi/từ chối:", err);
        toast.show("Thao tác thất bại.", "error");
      }
    }
  }

  // Phê duyệt yêu cầu đăng ký tủ đồ
  async function handleApproveLocker(lockerId) {
    const locker = lockersData[lockerId];
    if (!locker || !locker.currentUser) return;

    try {
      const docRef = doc(db, "lockers", lockerId);
      const approvedUser = {
        ...locker.currentUser,
        status: "approved"
      };
      await setDoc(docRef, {
        currentUser: approvedUser,
        history: arrayUnion({
          ...approvedUser,
          action: "approved",
          timestamp: new Date().toISOString()
        })
      }, { merge: true });
      toast.show(`Đã phê duyệt sử dụng tủ ${lockerId} thành công.`, "success");
      setSelectedLockerId(null);
    } catch (err) {
      console.error("Lỗi phê duyệt tủ:", err);
      toast.show("Phê duyệt thất bại.", "error");
    }
  }

  // Lưu cấu hình toàn cục EHS (Chỉ thông báo thành công)
  async function handleSaveConfig(e) {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      await setDoc(doc(db, "lockers", "settings"), {
        successNotificationText: configSuccessText
      }, { merge: true });
      toast.show("Cập nhật thông báo thành công!", "success");
    } catch (err) {
      console.error("Lỗi lưu cấu hình:", err);
      toast.show("Không thể lưu cấu hình.", "error");
    } finally {
      setIsSavingConfig(false);
    }
  }

  // Chỉnh sửa mô tả trực tiếp
  function handleStartEditDescription() {
    setTempDesc(globalSettings.zoneDescriptions?.[activeZone] || "");
    setShowEditDescModal(true);
  }

  async function handleSaveDescription() {
    try {
      const newZoneDescriptions = {
        ...(globalSettings.zoneDescriptions || {}),
        [activeZone]: tempDesc
      };
      await setDoc(doc(db, "lockers", "settings"), {
        zoneDescriptions: newZoneDescriptions
      }, { merge: true });
      toast.show("Cập nhật mô tả khu vực thành công!", "success");
      setShowEditDescModal(false);
    } catch (err) {
      console.error("Lỗi khi lưu mô tả:", err);
      toast.show("Không thể lưu mô tả khu vực.", "error");
    }
  }

  async function handleExportExcel() {
    try {
      const [{ default: ExcelJS }, { saveAs }] = await Promise.all([ import("exceljs"), import("file-saver") ]);
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Danh sách tủ");

      // Set columns
      ws.columns = [
        { header: 'STT', key: 'stt', width: 8 },
        { header: 'Mã tủ', key: 'id', width: 15 },
        { header: 'Họ tên nhân viên', key: 'name', width: 25 },
        { header: 'Bộ phận', key: 'department', width: 20 },
        { header: 'MSNV', key: 'msnv', width: 15 },
        { header: 'Số điện thoại', key: 'phone', width: 18 },
        { header: 'Trạng thái cấp phát', key: 'status', width: 20 },
        { header: 'Tình trạng tủ', key: 'condition', width: 25 }
      ];

      // Format headers
      const headerRow = ws.getRow(1);
      headerRow.height = 28;
      headerRow.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF10414A' } // Primary EHS color
      };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

      // Collect data
      const allAssigned = [];
      Object.keys(lockersData).forEach(id => {
        if (id !== "settings" && (lockersData[id]?.currentUser || lockersData[id]?.damageReport)) {
          allAssigned.push({ 
            id, 
            ...lockersData[id].currentUser, 
            damageReport: lockersData[id].damageReport 
          });
        }
      });

      // Sort by locker ID numeric-wise (e.g. A01, A02, B01, etc.)
      allAssigned.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));

      // Filter based on search query
      const filtered = allAssigned.filter(item => {
        const q = searchQuery.toLowerCase();
        return (
          item.id.toLowerCase().includes(q) ||
          (item.name && item.name.toLowerCase().includes(q)) ||
          (item.department && item.department.toLowerCase().includes(q)) ||
          (item.msnv && item.msnv.toLowerCase().includes(q)) ||
          (item.phone && item.phone.includes(q))
        );
      });

      // Add rows
      filtered.forEach((item, index) => {
        const statusText = item.name ? (item.status === "pending" ? "Chờ duyệt" : "Đã duyệt") : "Trống";
        const phoneText = item.phone ? (isEhsOrAdmin ? item.phone : maskPhoneNumber(item.phone)) : "-";
        
        let conditionText = "Bình thường";
        if (item.damageReport) {
          conditionText = item.damageReport.status === "received" ? "Đang sửa chữa" : "Báo hỏng (Chờ xử lý)";
        }
        
        ws.addRow({
          stt: index + 1,
          id: item.id,
          name: item.name || "-",
          department: item.department || "-",
          msnv: item.msnv || "-",
          phone: phoneText,
          status: statusText,
          condition: conditionText
        });
      });

      // Style rows
      const borderThin = {
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };

      ws.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          row.height = 22;
          row.font = { name: 'Times New Roman', size: 11 };
          row.eachCell((cell, colNumber) => {
            cell.border = borderThin;
            if (colNumber === 1 || colNumber === 2 || colNumber === 5 || colNumber === 6 || colNumber === 7 || colNumber === 8) {
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else {
              cell.alignment = { horizontal: 'left', vertical: 'middle' };
            }
          });
        }
      });

      // Write to buffer & save
      const out = await wb.xlsx.writeBuffer();
      const dateStr = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-');
      saveAs(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `Bao_cao_cap_phat_tu_ca_nhan_${dateStr}.xlsx`);
      toast.show("Xuất báo cáo thành công!", "success");
    } catch (err) {
      console.error("Lỗi xuất excel:", err);
      toast.show("Xuất báo cáo thất bại: " + err.message, "error");
    }
  }

  // Nhận thông tin báo hỏng tủ
  async function handleReceiveDamage(lockerId) {
    try {
      const docRef = doc(db, "lockers", lockerId);
      await updateDoc(docRef, {
        "damageReport.status": "received",
        "damageReport.receivedAt": new Date().toISOString()
      });
      toast.show(`Đã nhận thông tin sửa chữa tủ ${lockerId}.`, "success");
    } catch (err) {
      console.error("Lỗi khi nhận thông tin báo hỏng:", err);
      toast.show("Thao tác thất bại.", "error");
    }
  }

  // Xác nhận sửa xong tủ đồ
  async function handleCompleteDamage(lockerId) {
    const locker = lockersData[lockerId];
    if (!locker || !locker.damageReport) return;

    if (await confirm.askConfirm(`Bạn có chắc chắn đã HOÀN THÀNH sửa chữa tủ ${lockerId} và muốn xóa thông tin báo lỗi?`, "Xác nhận hoàn thành sửa chữa")) {
      try {
        const imageUrl = locker.damageReport.imageUrl;
        if (imageUrl) {
          try {
            const [{ ref, deleteObject }, { storage }] = await Promise.all([
              import("firebase/storage"),
              import("../firebase")
            ]);
            await deleteObject(ref(storage, imageUrl));
            console.log("Đã xóa ảnh hư hỏng khỏi Storage:", imageUrl);
          } catch (storageErr) {
            console.error("Lỗi khi xóa ảnh khỏi Storage:", storageErr);
          }
        }

        const docRef = doc(db, "lockers", lockerId);
        await updateDoc(docRef, {
          damageReport: deleteField()
        });

        toast.show(`Đã hoàn thành sửa chữa tủ ${lockerId}.`, "success");
      } catch (err) {
        console.error("Lỗi hoàn thành sửa chữa:", err);
        toast.show("Thao tác thất bại.", "error");
      }
    }
  }

  // Khai báo state phụ cho các Modal trong nội bộ
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  // Helper tìm tủ trống
  const vacantLockers = React.useMemo(() => {
    const list = [];
    Object.keys(LOCKER_LAYOUTS).forEach(zone => {
      LOCKER_LAYOUTS[zone].groups.forEach(group => {
        group.blocks.forEach(block => {
          const cols = block.cols || 3;
          for (let r = 0; r < 6; r++) {
            for (let c = 0; c < cols; c++) {
              const id = block.idPattern(r, c);
              if (!lockersData[id]?.currentUser) {
                list.push(id);
              }
            }
          }
        });
      });
    });
    return list.sort();
  }, [lockersData]);

  return (
    <div className="locker-container" style={{ padding: "8px 0", background: "transparent", color: "var(--lk-text-primary)", width: "100%", boxSizing: "border-box" }}>
      <style dangerouslySetInnerHTML={{__html: `
        .locker-container {
          --lk-text-primary: #2b3a3c;
          --lk-text-secondary: #5a6f72;
          --lk-text-muted: #8c9fa1;
          --lk-card-bg: #ffffff;
          --lk-card-border: #d0e2e0;
          --lk-border-dashed: rgba(70, 110, 115, 0.3);
          --lk-input-bg: #ffffff;
          --lk-input-border: #a9d9d4;
          --lk-input-text: #2b3a3c;
          --lk-grid-bg: #f4faf9;
          --lk-grid-border: #d0e2e0;
          --lk-block-bg: #ffffff;
          --lk-block-border: #a9d9d4;
          --lk-modal-overlay: rgba(8, 16, 36, 0.6);
          --lk-modal-bg: #ffffff;
          --lk-modal-border: #a9d9d4;
          --lk-badge-bg: rgba(70, 110, 115, 0.08);
          --lk-badge-text: #2c494c;
          --lk-vacant-bg: #ffffff;
          --lk-vacant-text: #5a6f72;
          --lk-occupied-bg: linear-gradient(135deg, #ebf3f5 0%, #dbe8eb 100%);
          --lk-occupied-border: #a9d9d4;
          --lk-occupied-text: #466e73;
          --lk-pending-bg: #fffaf0;
          --lk-pending-border: #f6ad55;
          --lk-pending-text: #dd6b20;
          --lk-header-text: #2b3a3c;
        }
        @media (prefers-color-scheme: dark) {
          .locker-container {
            --lk-text-primary: #e8f0fe;
            --lk-text-secondary: #8a9fc8;
            --lk-text-muted: #688aa6;
            --lk-card-bg: #111a2e;
            --lk-card-border: rgba(255, 255, 255, 0.08);
            --lk-border-dashed: rgba(255, 255, 255, 0.15);
            --lk-input-bg: #1a243d;
            --lk-input-border: rgba(255, 255, 255, 0.15);
            --lk-input-text: #ffffff;
            --lk-grid-bg: rgba(255, 255, 255, 0.02);
            --lk-grid-border: rgba(255, 255, 255, 0.06);
            --lk-block-bg: rgba(255, 255, 255, 0.03);
            --lk-block-border: rgba(255, 255, 255, 0.05);
            --lk-modal-overlay: rgba(8, 16, 36, 0.75);
            --lk-modal-bg: #1a2540;
            --lk-modal-border: rgba(255, 255, 255, 0.1);
            --lk-badge-bg: rgba(255, 255, 255, 0.05);
            --lk-badge-text: #8a9fc8;
            --lk-vacant-bg: rgba(255, 255, 255, 0.04);
            --lk-vacant-text: #a0aec0;
            --lk-occupied-bg: linear-gradient(135deg, #2c3e50 0%, #1a252f 100%);
            --lk-occupied-border: #34495e;
            --lk-occupied-text: #63b3ed;
            --lk-pending-bg: rgba(237, 137, 54, 0.15);
            --lk-pending-border: #dd6b20;
            --lk-pending-text: #f6ad55;
            --lk-header-text: #e8f0fe;
          }
        }
        @keyframes pending-pulse {
          0% { box-shadow: 0 0 0 0 rgba(237, 137, 54, 0.5); }
          70% { box-shadow: 0 0 0 6px rgba(237, 137, 54, 0); }
          100% { box-shadow: 0 0 0 0 rgba(237, 137, 54, 0); }
        }
        .locker-pending-pulse {
          animation: pending-pulse 2s infinite;
        }
        .locker-block-dragover {
          border: 2px dashed var(--lk-pending-border) !important;
          opacity: 0.7;
        }
      `}} />
      
      {/* Header thống kê */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 800, color: "var(--lk-text-primary)", fontSize: "22px" }}>🔐 Quản lý Tủ đồ cá nhân (Locker)</h2>
          <p style={{ margin: "4px 0 0 0", color: "var(--lk-text-secondary)", fontSize: "13px" }}>Sơ đồ trực quan và danh mục cấp phát tủ đồ nhân viên</p>
        </div>

        {/* Stats badges */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ background: "var(--lk-badge-bg)", border: "1px solid var(--lk-card-border)", padding: "8px 16px", borderRadius: 12, textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "var(--lk-text-secondary)", fontWeight: "600" }}>TỔNG SỐ TỦ</div>
            <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--lk-text-primary)" }}>{stats.total}</div>
          </div>
          <div style={{ background: "rgba(229, 62, 62, 0.12)", border: "1px solid rgba(229, 62, 62, 0.2)", padding: "8px 16px", borderRadius: 12, textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "rgba(229, 62, 62, 0.8)", fontWeight: "600" }}>ĐANG SỬ DỤNG</div>
            <div style={{ fontSize: "18px", fontWeight: "800", color: "#e53e3e" }}>{stats.occupied}</div>
          </div>
          <div style={{ background: "rgba(237, 137, 54, 0.12)", border: "1px solid rgba(237, 137, 54, 0.2)", padding: "8px 16px", borderRadius: 12, textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "var(--lk-pending-text)", fontWeight: "600" }}>CHỜ XÁC NHẬN</div>
            <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--lk-pending-text)" }}>{stats.pending}</div>
          </div>
          <div style={{ background: "rgba(72, 187, 120, 0.12)", border: "1px solid rgba(72, 187, 120, 0.2)", padding: "8px 16px", borderRadius: 12, textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "rgba(72, 187, 120, 0.8)", fontWeight: "600" }}>TỦ CÒN TRỐNG</div>
            <div style={{ fontSize: "18px", fontWeight: "800", color: "#38a169" }}>{stats.vacant}</div>
          </div>
        </div>
      </div>

      {/* Điều hướng Chế độ Xem */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, borderBottom: "1.5px solid var(--lk-card-border)", paddingBottom: 10 }}>
        <button 
          onClick={() => setCurrentViewTab("map")} 
          style={{ padding: "8px 16px", background: currentViewTab === "map" ? colors.primary : "transparent", border: "none", borderRadius: 8, color: currentViewTab === "map" ? "#fff" : "var(--lk-text-secondary)", fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}
        >
          🗺️ Sơ đồ tủ trực quan
        </button>
        <button 
          onClick={() => setCurrentViewTab("list")} 
          style={{ padding: "8px 16px", background: currentViewTab === "list" ? colors.primary : "transparent", border: "none", borderRadius: 8, color: currentViewTab === "list" ? "#fff" : "var(--lk-text-secondary)", fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}
        >
          📋 Danh sách & Tra cứu
        </button>
        <button 
          onClick={() => setCurrentViewTab("print")} 
          style={{ padding: "8px 16px", background: currentViewTab === "print" ? colors.primary : "transparent", border: "none", borderRadius: 8, color: currentViewTab === "print" ? "#fff" : "var(--lk-text-secondary)", fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}
        >
          🖨️ In mã QR hàng loạt
        </button>
        {isEhsOrAdmin && (
          <button 
            onClick={() => setCurrentViewTab("config")} 
            style={{ padding: "8px 16px", background: currentViewTab === "config" ? colors.primary : "transparent", border: "none", borderRadius: 8, color: currentViewTab === "config" ? "#fff" : "var(--lk-text-secondary)", fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}
          >
            ⚙️ Cấu hình tủ đồ
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--lk-text-secondary)" }}>Đang tải sơ đồ tủ đồ...</div>
      ) : (
        <>
          {/* TAB 1: SƠ ĐỒ TRỰC QUAN */}
          {currentViewTab === "map" && (
            <div>
              {/* Chọn Khu Vực */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
                {Object.keys(LOCKER_LAYOUTS).map(zone => (
                  <button
                    key={zone}
                    onClick={() => setActiveZone(zone)}
                    style={{
                      padding: "8px 18px",
                      borderRadius: 8,
                      border: "none",
                      background: activeZone === zone ? "linear-gradient(135deg, #1a5c68 0%, #10414a 100%)" : "var(--lk-badge-bg)",
                      color: activeZone === zone ? "#fff" : "var(--lk-text-secondary)",
                      fontWeight: "800",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    Khu {zone}
                  </button>
                ))}
              </div>

              {/* Sơ đồ tủ của Khu vực đã chọn */}
              <div style={{ background: "var(--lk-grid-bg)", border: "1.5px solid var(--lk-grid-border)", borderRadius: 16, padding: "20px" }}>
                <h3 style={{ margin: "0 0 6px 0", color: "var(--lk-text-primary)", borderBottom: "1px solid var(--lk-card-border)", paddingBottom: 8, display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>{LOCKER_LAYOUTS[activeZone].name}</span>
                  {isEhsOrAdmin && (
                    <button 
                      onClick={handleStartEditDescription}
                      style={{ background: "transparent", border: "none", color: "var(--lk-text-secondary)", cursor: "pointer", fontSize: "14px", padding: "4px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                      title="Chỉnh sửa mô tả khu vực"
                    >
                      ✏️
                    </button>
                  )}
                </h3>
                {globalSettings.zoneDescriptions?.[activeZone] && (
                  <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "var(--lk-text-secondary)", fontStyle: "italic", whiteSpace: "pre-wrap" }}>
                    ℹ️ {globalSettings.zoneDescriptions[activeZone]}
                  </p>
                )}

                {isEhsOrAdmin && (
                  <div style={{ fontSize: "11px", color: "var(--lk-text-muted)", marginBottom: "12px", fontStyle: "italic" }}>
                    💡 EHS có thể kéo thả đầu các Block (biểu tượng ⋮⋮) để sắp xếp lại vị trí hiển thị của các Block tủ.
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
                  {LOCKER_LAYOUTS[activeZone].groups.map((group, gIdx) => (
                    <div key={gIdx}>
                      {group.title && (
                        <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--lk-text-secondary)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>
                          {group.title}
                        </div>
                      )}
                      
                      {/* flexWrap: "wrap" giúp tự động fit trang */}
                      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                        {getSortedBlocks(group, gIdx).map((block, bIdx) => {
                          const cols = block.cols || 3;
                          // Tạo danh sách tủ của block này
                          const blockLockers = [];
                          for (let r = 0; r < 6; r++) {
                            for (let c = 0; c < cols; c++) {
                              blockLockers.push(block.idPattern(r, c));
                            }
                          }

                          return (
                            <div 
                              key={block.name} 
                              draggable={isEhsOrAdmin}
                              onDragStart={(e) => {
                                if (!isEhsOrAdmin) return;
                                setDraggedBlockInfo({ groupIdx: gIdx, blockName: block.name });
                                e.dataTransfer.effectAllowed = "move";
                                e.currentTarget.style.opacity = "0.5";
                              }}
                              onDragEnd={(e) => {
                                e.currentTarget.style.opacity = "1";
                              }}
                              onDragOver={(e) => {
                                if (!isEhsOrAdmin) return;
                                e.preventDefault();
                                e.currentTarget.classList.add("locker-block-dragover");
                              }}
                              onDragLeave={(e) => {
                                e.currentTarget.classList.remove("locker-block-dragover");
                              }}
                              onDrop={async (e) => {
                                e.currentTarget.classList.remove("locker-block-dragover");
                                if (!isEhsOrAdmin || !draggedBlockInfo) return;
                                if (draggedBlockInfo.groupIdx !== gIdx) {
                                  toast.show("Chỉ cho phép kéo thả các block trong cùng một nhóm khu vực.", "warning");
                                  return;
                                }

                                const sourceBlockName = draggedBlockInfo.blockName;
                                const targetBlockName = block.name;
                                if (sourceBlockName === targetBlockName) return;

                                const currentBlocks = getSortedBlocks(group, gIdx);
                                const sourceIndex = currentBlocks.findIndex(b => b.name === sourceBlockName);
                                const targetIndex = currentBlocks.findIndex(b => b.name === targetBlockName);

                                if (sourceIndex !== -1 && targetIndex !== -1) {
                                  const newBlocks = [...currentBlocks];
                                  const [removed] = newBlocks.splice(sourceIndex, 1);
                                  newBlocks.splice(targetIndex, 0, removed);

                                  const newOrder = newBlocks.map(b => b.name);
                                  const targetKey = `${activeZone}_${gIdx}`;

                                  try {
                                    await setDoc(doc(db, "lockers", "settings"), {
                                      blockOrder: {
                                        ...(globalSettings.blockOrder || {}),
                                        [targetKey]: newOrder
                                      }
                                    }, { merge: true });
                                    toast.show(`Đã di chuyển ${sourceBlockName} thành công.`, "success");
                                  } catch (err) {
                                    console.error("Lỗi khi lưu vị trí block:", err);
                                    toast.show("Không thể lưu vị trí block.", "error");
                                  }
                                }
                                setDraggedBlockInfo(null);
                              }}
                              style={{ background: "var(--lk-block-bg)", padding: "12px", borderRadius: "12px", border: "1px solid var(--lk-block-border)", transition: "all 0.2s" }}
                            >
                              <div style={{ fontSize: "11px", fontWeight: "800", color: "var(--lk-text-muted)", marginBottom: "8px", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                                {isEhsOrAdmin && <span style={{ cursor: "grab", color: "var(--lk-text-muted)", fontSize: "13px", fontWeight: "bold", paddingRight: "4px" }}>⋮⋮</span>}
                                {block.name}
                              </div>
                              <div 
                                style={{ 
                                  display: "grid", 
                                  gridTemplateColumns: `repeat(${cols}, 48px)`, 
                                  gap: "6px" 
                                }}
                              >
                                {blockLockers.map(id => {
                                  const info = lockersData[id]?.currentUser;
                                  const isOccupied = !!info && info.status !== "pending";
                                  const isPending = !!info && info.status === "pending";
                                  
                                  let bg = "var(--lk-vacant-bg)";
                                  let border = "1.5px dashed var(--lk-border-dashed)";
                                  let textColor = "var(--lk-vacant-text)";
                                  let titleText = "Tủ trống";
                                  let shadow = "none";
                                  let className = "";

                                  if (isOccupied) {
                                    bg = "var(--lk-occupied-bg)";
                                    border = "1.5px solid var(--lk-occupied-border)";
                                    textColor = "var(--lk-occupied-text)";
                                    titleText = `Đang dùng: ${info.name} (${info.department})`;
                                    shadow = "0 2px 5px rgba(0,0,0,0.05)";
                                  } else if (isPending) {
                                    bg = "var(--lk-pending-bg)";
                                    border = "1.5px solid var(--lk-pending-border)";
                                    textColor = "var(--lk-pending-text)";
                                    titleText = `Chờ xác nhận: ${info.name} (${info.department})`;
                                    shadow = "0 2px 5px rgba(237, 137, 54, 0.15)";
                                    className = "locker-pending-pulse";
                                  }

                                  const damageReport = lockersData[id]?.damageReport;
                                  const hasDamage = !!damageReport;

                                  return (
                                    <div
                                      key={id}
                                      onClick={() => setSelectedLockerId(id)}
                                      className={className}
                                      style={{
                                        height: "44px",
                                        background: bg,
                                        border: border,
                                        borderRadius: "6px",
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        cursor: "pointer",
                                        fontSize: "11px",
                                        fontWeight: "700",
                                        color: textColor,
                                        boxShadow: shadow,
                                        transition: "all 0.2s",
                                        position: "relative"
                                      }}
                                      title={hasDamage ? `${titleText} (${damageReport.status === "received" ? "Đang sửa" : "Báo hỏng"})` : titleText}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = "scale(1.05)";
                                        e.currentTarget.style.borderColor = colors.primary;
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = "scale(1)";
                                        e.currentTarget.style.borderColor = isOccupied ? "var(--lk-occupied-border)" : (isPending ? "var(--lk-pending-border)" : "var(--lk-border-dashed)");
                                      }}
                                    >
                                      <div>{id}</div>
                                      {(isOccupied || isPending) && (
                                        <div style={{ fontSize: "8px", color: isOccupied ? "var(--lk-text-secondary)" : "var(--lk-pending-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", textAlign: "center", padding: "0 2px" }}>
                                          {info.name.split(" ").pop()}
                                        </div>
                                      )}
                                      {hasDamage && (
                                        <span 
                                          style={{ 
                                            position: "absolute", 
                                            top: "2px", 
                                            right: "2px", 
                                            fontSize: "9px",
                                            background: damageReport.status === "received" ? "#dd6b20" : "#e53e3e",
                                            color: "#fff",
                                            borderRadius: "50%",
                                            width: "12px",
                                            height: "12px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontWeight: "bold",
                                            lineHeight: 1
                                          }}
                                          title={damageReport.status === "received" ? "Đang sửa chữa" : "Có báo hỏng"}
                                        >
                                          {damageReport.status === "received" ? "🔧" : "⚠️"}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DANH SÁCH & TRA CỨU */}
          {currentViewTab === "list" && (
            <div>
              {/* Ô nhập tìm kiếm */}
              <div style={{ marginBottom: "16px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder="🔍 Nhập Tên, MSNV, Bộ phận hoặc Mã tủ để tìm..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ flex: 1, minWidth: "250px", padding: "10px 14px", borderRadius: "10px", border: "1.5px solid var(--lk-card-border)", background: "var(--lk-input-bg)", color: "var(--lk-input-text)", fontSize: "14px" }}
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    style={{ padding: "10px 16px", background: "var(--lk-badge-bg)", border: "none", borderRadius: "10px", color: "var(--lk-text-secondary)", cursor: "pointer", fontWeight: "600" }}
                  >
                    Xóa tìm kiếm
                  </button>
                )}
                <button
                  onClick={handleExportExcel}
                  style={{
                    padding: "10px 16px",
                    background: colors.success,
                    color: "#fff",
                    border: "none",
                    borderRadius: "10px",
                    cursor: "pointer",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    boxShadow: "0 2px 6px rgba(72,187,120,0.2)",
                    transition: "opacity 0.2s"
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 0.9}
                  onMouseLeave={e => e.currentTarget.style.opacity = 1}
                >
                  📥 Xuất báo cáo Excel
                </button>
              </div>

              {/* Bảng kết quả */}
              <div style={{ background: "var(--lk-card-bg)", border: "1.5px solid var(--lk-card-border)", borderRadius: 16, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                  <thead>
                    <tr style={{ background: "var(--lk-badge-bg)", borderBottom: "1px solid var(--lk-card-border)" }}>
                      <th style={{ padding: "12px 16px", textAlign: "left", color: "var(--lk-text-secondary)" }}>Mã tủ</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", color: "var(--lk-text-secondary)" }}>Tên nhân viên</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", color: "var(--lk-text-secondary)" }}>Bộ phận</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", color: "var(--lk-text-secondary)" }}>MSNV</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", color: "var(--lk-text-secondary)" }}>Số điện thoại</th>
                      <th style={{ padding: "12px 16px", textAlign: "center", color: "var(--lk-text-secondary)" }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const allAssigned = [];
                      Object.keys(lockersData).forEach(id => {
                        if (id !== "settings" && (lockersData[id]?.currentUser || lockersData[id]?.damageReport)) {
                          allAssigned.push({ 
                            id, 
                            ...lockersData[id].currentUser, 
                            damageReport: lockersData[id].damageReport 
                          });
                        }
                      });

                      const filtered = allAssigned.filter(item => {
                        const q = searchQuery.toLowerCase();
                        return (
                          item.id.toLowerCase().includes(q) ||
                          (item.name && item.name.toLowerCase().includes(q)) ||
                          (item.department && item.department.toLowerCase().includes(q)) ||
                          (item.msnv && item.msnv.toLowerCase().includes(q)) ||
                          (item.phone && item.phone.includes(q))
                        );
                      });

                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan={6} style={{ padding: "24px", textAlign: "center", color: "var(--lk-text-secondary)" }}>
                              {searchQuery ? "Không tìm thấy kết quả phù hợp." : "Chưa có tủ nào được cấp phát hoặc báo hỏng."}
                            </td>
                          </tr>
                        );
                      }

                      return filtered.map(item => (
                        <tr key={item.id} style={{ borderBottom: "1px solid var(--lk-block-border)" }}>
                          <td style={{ padding: "12px 16px", fontWeight: "700", color: "var(--lk-occupied-text)" }}>
                            {item.id}
                            {item.damageReport && (
                              <span 
                                style={{ 
                                  marginLeft: "6px", 
                                  background: item.damageReport.status === "received" ? "rgba(237, 137, 54, 0.15)" : "rgba(229, 62, 62, 0.15)", 
                                  color: item.damageReport.status === "received" ? "#dd6b20" : "#e53e3e", 
                                  padding: "2px 6px", 
                                  borderRadius: "4px", 
                                  fontSize: "10px",
                                  fontWeight: "bold",
                                  display: "inline-block"
                                }}
                              >
                                {item.damageReport.status === "received" ? "🔧 Đang sửa" : "⚠️ Báo hỏng"}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "12px 16px", fontWeight: "600", color: "var(--lk-text-primary)" }}>
                            {item.name || <span style={{ color: "var(--lk-text-muted)", fontStyle: "italic" }}>Tủ trống</span>}
                            {item.status === "pending" && (
                              <span style={{ color: "var(--lk-pending-text)", fontSize: "11px", marginLeft: "6px", background: "rgba(237, 137, 54, 0.1)", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" }}>
                                Chờ duyệt
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "12px 16px", color: "var(--lk-text-primary)" }}>{item.department || "-"}</td>
                          <td style={{ padding: "12px 16px", fontFamily: "monospace", color: "var(--lk-text-primary)" }}>{item.msnv || "-"}</td>
                          <td style={{ padding: "12px 16px", color: "var(--lk-text-primary)" }}>
                            {item.phone ? (isEhsOrAdmin ? item.phone : maskPhoneNumber(item.phone)) : "-"}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "center" }}>
                            <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                              <button 
                                onClick={() => setSelectedLockerId(item.id)}
                                style={{ padding: "4px 10px", background: colors.primary, color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}
                              >
                                ⚙️ Chi tiết
                              </button>
                              {item.name && (
                                <button 
                                  onClick={() => handleReleaseLocker(item.id)}
                                  style={{ padding: "4px 10px", background: "rgba(229, 62, 62, 0.12)", color: "#fc8181", border: "1px solid rgba(229, 62, 62, 0.3)", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}
                                >
                                  {item.status === "pending" ? "Từ chối" : "Thu hồi"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: IN MÃ QR HÀNG LOẠT */}
          {currentViewTab === "print" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--lk-text-secondary)" }}>Chọn khu vực để in mã QR:</span>
                  <select 
                    value={activeZone} 
                    onChange={e => setActiveZone(e.target.value)} 
                    style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--lk-input-border)", background: "var(--lk-input-bg)", color: "var(--lk-input-text)", fontSize: "14px", fontWeight: "700" }}
                  >
                    {Object.keys(LOCKER_LAYOUTS).map(zone => (
                      <option key={zone} value={zone}>Khu {zone}</option>
                    ))}
                  </select>
                </div>

                <button 
                  onClick={() => window.print()}
                  style={{ padding: "8px 20px", background: colors.success, color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "14px", boxShadow: "0 4px 10px rgba(72,187,120,0.2)" }}
                >
                  🖨️ Tiến hành in trang này
                </button>
              </div>

              {/* Printable Locker QR Cards Grid */}
              <div 
                className="printable-qr-grid"
                style={{ 
                  background: "#fff", 
                  padding: "20px", 
                  borderRadius: "16px", 
                  display: "grid", 
                  gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", 
                  gap: "20px",
                  color: "#000"
                }}
              >
                <style dangerouslySetInnerHTML={{__html: `
                  @media print {
                    body * {
                      visibility: hidden;
                    }
                    .printable-qr-grid, .printable-qr-grid * {
                      visibility: visible;
                    }
                    .printable-qr-grid {
                      position: absolute;
                      left: 0;
                      top: 0;
                      width: 100%;
                      grid-template-columns: repeat(4, 1fr) !important;
                      gap: 15px !important;
                      padding: 0 !important;
                    }
                    .qr-print-card {
                      border: 1px solid #000 !important;
                      page-break-inside: avoid;
                    }
                  }
                `}} />

                {(() => {
                  const items = [];
                  LOCKER_LAYOUTS[activeZone].groups.forEach(group => {
                    group.blocks.forEach(block => {
                      const cols = block.cols || 3;
                      for (let r = 0; r < 6; r++) {
                        for (let c = 0; c < cols; c++) {
                          items.push(block.idPattern(r, c));
                        }
                      }
                    });
                  });

                  return items.map(id => {
                    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(window.location.origin + "/?locker=" + id)}`;
                    return (
                      <div 
                        key={id} 
                        className="qr-print-card"
                        style={{ 
                          border: "1px solid #cbd5e0", 
                          borderRadius: "8px", 
                          padding: "10px", 
                          textAlign: "center", 
                          display: "flex", 
                          flexDirection: "column", 
                          alignItems: "center", 
                          justifyContent: "center",
                          background: "#fff"
                        }}
                      >
                        <div style={{ fontSize: "14px", fontWeight: "900", letterSpacing: "1px", marginBottom: "4px" }}>LOCKER</div>
                        <img src={qrUrl} alt={`QR tủ ${id}`} style={{ width: "90px", height: "90px", objectFit: "contain" }} />
                        <div style={{ fontSize: "18px", fontWeight: "900", marginTop: "4px", borderTop: "2px solid #000", width: "100%", paddingTop: "2px" }}>
                          {id}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* TAB 4: CẤU HÌNH TỦ ĐỒ (EHS/ADMIN ONLY) */}
          {currentViewTab === "config" && isEhsOrAdmin && (
            <div style={{ background: "var(--lk-card-bg)", border: "1.5px solid var(--lk-card-border)", borderRadius: 16, padding: "24px" }}>
              <h3 style={{ margin: "0 0 8px 0", color: "var(--lk-text-primary)" }}>⚙️ Cấu hình thông tin tủ đồ</h3>
              <p style={{ margin: "0 0 20px 0", color: "var(--lk-text-secondary)", fontSize: "14px" }}>
                Thiết lập thông báo đăng ký thành công cho nhân viên. Mô tả khu vực có thể được chỉnh sửa trực tiếp bằng nút cây bút ✏️ bên cạnh tên khu vực trên bản đồ.
              </p>
              
              <form onSubmit={handleSaveConfig} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div>
                  <label style={{ fontSize: "14px", color: "var(--lk-text-primary)", fontWeight: "700", display: "block", marginBottom: "6px" }}>
                    Nội dung thông báo đăng ký thành công (khi nhân viên quét QR tự đăng ký) *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={configSuccessText}
                    onChange={e => setConfigSuccessText(e.target.value)}
                    placeholder="Nhập nội dung thông báo hiển thị sau khi gửi đăng ký..."
                    style={{ 
                      width: "100%", 
                      padding: "10px 12px", 
                      borderRadius: "8px", 
                      border: "1px solid var(--lk-input-border)", 
                      background: "var(--lk-input-bg)", 
                      color: "var(--lk-input-text)", 
                      fontSize: "14px", 
                      boxSizing: "border-box",
                      resize: "vertical"
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSavingConfig}
                  style={{ 
                    padding: "12px 24px", 
                    background: colors.primary, 
                    color: "#fff", 
                    border: "none", 
                    borderRadius: "8px", 
                    fontWeight: "700", 
                    cursor: "pointer", 
                    fontSize: "15px", 
                    alignSelf: "flex-start",
                    marginTop: "10px"
                  }}
                >
                  {isSavingConfig ? "Đang lưu cấu hình..." : "Lưu cấu hình"}
                </button>
              </form>
            </div>
          )}
        </>
      )}

      {/* MODAL 1: CHI TIẾT TỦ ĐỒ (QUẢN TRỊ VIÊN) */}
      {selectedLockerId && (() => {
        const id = selectedLockerId;
        const info = lockersData[id]?.currentUser;
        const isOccupied = !!info;
        const isPending = !!info && info.status === "pending";
        
        return (
          <div style={{ position: "fixed", inset: 0, background: "var(--lk-modal-overlay)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200 }}>
            <div style={{ background: "var(--lk-modal-bg)", width: "100%", maxWidth: "480px", borderRadius: "20px", boxShadow: "0 10px 40px rgba(0,0,0,0.25)", overflow: "hidden", border: "1.5px solid var(--lk-modal-border)", color: "var(--lk-text-primary)" }}>
              
              {/* Header */}
              <div style={{ background: "linear-gradient(135deg, #1a5c68 0%, #10414a 100%)", padding: "18px 24px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: "800", fontSize: "18px" }}>Tủ đồ cá nhân {id}</div>
                <button 
                  onClick={() => setSelectedLockerId(null)}
                  style={{ background: "transparent", border: "none", color: "#fff", fontSize: "18px", cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: "24px" }}>
                
                {/* QR code card */}
                <div style={{ display: "flex", gap: "16px", background: "var(--lk-block-bg)", border: "1px solid var(--lk-block-border)", borderRadius: "12px", padding: "12px", marginBottom: "20px", alignItems: "center" }}>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(window.location.origin + "/?locker=" + id)}`}
                    alt={`QR tủ ${id}`}
                    style={{ width: "88px", height: "88px", background: "#fff", padding: "4px", borderRadius: "6px" }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "13px", color: "var(--lk-text-primary)", fontWeight: "700" }}>MÃ QR CỦA TỦ</div>
                    <div style={{ fontSize: "11px", color: "var(--lk-text-secondary)", marginTop: "4px", lineHeight: "1.4" }}>
                      Quét bằng camera điện thoại của nhân viên để xem thông tin hoặc đăng ký sử dụng công cộng mà không cần đăng nhập.
                    </div>
                  </div>
                </div>

                {/* Locker State Section */}
                {isOccupied ? (
                  // OCCUPIED OR PENDING STATE UI
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--lk-text-secondary)", marginBottom: "8px" }}>
                      {isPending ? "YÊU CẦU ĐĂNG KÝ CHỜ DUYỆT:" : "THÔNG TIN NGƯỜI SỬ DỤNG:"}
                    </div>
                    <div style={{ background: "var(--lk-block-bg)", padding: "16px", borderRadius: "12px", border: "1px solid var(--lk-block-border)", display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--lk-text-secondary)" }}>Họ và tên:</span>
                        <span style={{ fontWeight: "700", color: "var(--lk-text-primary)" }}>{info.name}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--lk-text-secondary)" }}>Bộ phận:</span>
                        <span style={{ fontWeight: "700", color: "var(--lk-text-primary)" }}>{info.department}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--lk-text-secondary)" }}>Mã số NV (MSNV):</span>
                        <span style={{ fontWeight: "700", fontFamily: "monospace", color: "var(--lk-text-primary)" }}>{info.msnv}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--lk-text-secondary)" }}>Số điện thoại:</span>
                        <span style={{ fontWeight: "700", color: "var(--lk-text-primary)" }}>
                          {isEhsOrAdmin ? info.phone : maskPhoneNumber(info.phone)}
                        </span>
                      </div>
                      {info.assignedAt && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--lk-text-secondary)" }}>Ngày đăng ký:</span>
                          <span style={{ fontWeight: "600", fontSize: "13px", color: "var(--lk-text-primary)" }}>
                            {new Date(info.assignedAt).toLocaleString("vi-VN")}
                          </span>
                        </div>
                      )}
                      {isPending && (
                        <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--lk-card-border)", paddingTop: "8px" }}>
                          <span style={{ color: "var(--lk-pending-text)", fontWeight: "bold" }}>Trạng thái:</span>
                          <span style={{ fontWeight: "bold", color: "var(--lk-pending-text)" }}>Chờ EHS xác nhận</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                      {isPending ? (
                        <>
                          <button
                            onClick={() => handleApproveLocker(id)}
                            style={{ flex: 1, padding: "10px", background: colors.success, color: "#fff", border: "none", borderRadius: "8px", fontWeight: "700", cursor: "pointer" }}
                          >
                            ✓ Phê duyệt
                          </button>
                          <button
                            onClick={() => handleReleaseLocker(id)}
                            style={{ flex: 1, padding: "10px", background: "rgba(229, 62, 62, 0.15)", color: "#fc8181", border: "1px solid rgba(229, 62, 62, 0.3)", borderRadius: "8px", fontWeight: "700", cursor: "pointer" }}
                          >
                            ✗ Từ chối
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setShowTransferModal(true)}
                            style={{ flex: 1, padding: "10px", background: colors.primary, color: "#fff", border: "none", borderRadius: "8px", fontWeight: "700", cursor: "pointer" }}
                          >
                            🔄 Đổi tủ
                          </button>
                          <button
                            onClick={() => handleReleaseLocker(id)}
                            style={{ flex: 1, padding: "10px", background: "rgba(229, 62, 62, 0.15)", color: "#fc8181", border: "1px solid rgba(229, 62, 62, 0.3)", borderRadius: "8px", fontWeight: "700", cursor: "pointer" }}
                          >
                            Thu hồi tủ
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  // VACANT STATE UI (REGISTRATION FORM)
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--lk-text-secondary)", marginBottom: "8px" }}>TỦ ĐỒ ĐANG TRỐNG - CẤP PHÁT CHO NHÂN VIÊN:</div>
                    <LockerAssignForm 
                      lockerId={id} 
                      lockersData={lockersData}
                      onSuccess={() => {
                        toast.show(`Cấp tủ ${id} thành công!`, "success");
                        setSelectedLockerId(null);
                      }} 
                    />
                  </div>
                )}

                {/* Damage Report Section */}
                {lockersData[id]?.damageReport && (() => {
                  const rep = lockersData[id].damageReport;
                  return (
                    <div style={{ 
                      marginTop: "16px", 
                      background: "rgba(229, 62, 62, 0.05)", 
                      border: `1.5px solid ${rep.status === "received" ? "#dd6b20" : "#e53e3e"}`, 
                      borderRadius: "12px", 
                      padding: "14px",
                      color: "var(--lk-text-primary)"
                    }}>
                      <div style={{ fontWeight: "800", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px", color: rep.status === "received" ? "#dd6b20" : "#e53e3e", marginBottom: "8px" }}>
                        <span>{rep.status === "received" ? "🔧 Đang sửa chữa" : "⚠️ Báo cáo hư hỏng tủ"}</span>
                      </div>
                      
                      <div style={{ fontSize: "13px", display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div>
                          <span style={{ color: "var(--lk-text-secondary)" }}>Mô tả lỗi:</span>{" "}
                          <span style={{ fontWeight: "600" }}>{rep.description}</span>
                        </div>
                        {rep.reportedAt && (
                          <div>
                            <span style={{ color: "var(--lk-text-secondary)" }}>Thời gian báo:</span>{" "}
                            <span style={{ fontWeight: "600" }}>{new Date(rep.reportedAt).toLocaleString("vi-VN")}</span>
                          </div>
                        )}
                        {rep.imageUrl && (
                          <div style={{ marginTop: "8px" }}>
                            <span style={{ color: "var(--lk-text-secondary)", display: "block", marginBottom: "4px" }}>Hình ảnh hư hỏng:</span>
                            <a href={rep.imageUrl} target="_blank" rel="noopener noreferrer">
                              <img 
                                src={rep.imageUrl} 
                                alt="Ảnh hư hỏng" 
                                style={{ maxWidth: "100%", maxHeight: "140px", borderRadius: "8px", border: "1px solid var(--lk-card-border)", display: "block", objectFit: "contain" }} 
                              />
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Nút hành động cho EHS */}
                      <div style={{ display: "flex", gap: "10px", marginTop: "12px", borderTop: "1px solid var(--lk-card-border)", paddingTop: "10px" }}>
                        {rep.status === "reported" && (
                          <button
                            onClick={() => handleReceiveDamage(id)}
                            style={{ 
                              flex: 1, 
                              padding: "8px 12px", 
                              background: "#dd6b20", 
                              color: "#fff", 
                              border: "none", 
                              borderRadius: "6px", 
                              fontWeight: "700", 
                              fontSize: "12px", 
                              cursor: "pointer" 
                            }}
                          >
                            Đã nhận thông tin
                          </button>
                        )}
                        <button
                          onClick={() => handleCompleteDamage(id)}
                          style={{ 
                            flex: 1, 
                            padding: "8px 12px", 
                            background: colors.success, 
                            color: "#fff", 
                            border: "none", 
                            borderRadius: "6px", 
                            fontWeight: "700", 
                            fontSize: "12px", 
                            cursor: "pointer" 
                          }}
                        >
                          Xác nhận hoàn thành
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* MODAL CON 1.1: ĐỔI TỦ (TRANSFER LOCKER) */}
            {showTransferModal && (
              <LockerTransferModal 
                lockerId={id} 
                currentUser={info} 
                vacantLockers={vacantLockers} 
                onClose={() => setShowTransferModal(false)}
                onSuccess={() => {
                  toast.show("Chuyển tủ thành công!", "success");
                  setShowTransferModal(false);
                  setSelectedLockerId(null);
                }}
              />
            )}
          </div>
        );
      })()}

      {/* MODAL 2: SỬA MÔ TẢ KHU VỰC TRỰC TIẾP */}
      {showEditDescModal && (
        <div style={{ position: "fixed", inset: 0, background: "var(--lk-modal-overlay)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1400 }}>
          <div style={{ background: "var(--lk-modal-bg)", width: "90%", maxWidth: "450px", padding: "22px", borderRadius: "16px", border: "1px solid var(--lk-modal-border)", boxShadow: "0 8px 30px rgba(0,0,0,0.3)", color: "var(--lk-text-primary)" }}>
            <h3 style={{ margin: "0 0 12px 0" }}>✏️ Chỉnh sửa mô tả: Khu {activeZone}</h3>
            <textarea
              rows={4}
              value={tempDesc}
              onChange={e => setTempDesc(e.target.value)}
              placeholder={`Nhập thông tin mô tả cho khu vực ${activeZone}...`}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--lk-input-border)", background: "var(--lk-input-bg)", color: "var(--lk-input-text)", fontSize: "14px", boxSizing: "border-box", resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "16px" }}>
              <button
                onClick={() => setShowEditDescModal(false)}
                style={{ padding: "8px 16px", background: "var(--lk-badge-bg)", border: "none", borderRadius: "8px", color: "var(--lk-text-secondary)", cursor: "pointer", fontWeight: "700" }}
              >
                Hủy
              </button>
              <button
                onClick={handleSaveDescription}
                style={{ padding: "8px 16px", background: colors.primary, border: "none", borderRadius: "8px", color: "#fff", cursor: "pointer", fontWeight: "700" }}
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// FORM CẤP PHÁT TỦ MỚI
function LockerAssignForm({ lockerId, lockersData, onSuccess }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [msnv, setMsnv] = useState("");
  const [phone, setPhone] = useState("");
  const [otherLockers, setOtherLockers] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // Kiểm tra sở hữu chéo chéo
  useEffect(() => {
    if (msnv.trim().length >= 3) {
      const assigned = [];
      Object.keys(lockersData).forEach(id => {
        if (id !== "settings" && lockersData[id]?.currentUser?.msnv?.toUpperCase() === msnv.trim().toUpperCase() && id !== lockerId) {
          assigned.push(id);
        }
      });
      setOtherLockers(assigned);
    } else {
      setOtherLockers([]);
    }
  }, [msnv, lockersData, lockerId]);

  async function handleAssign(e) {
    e.preventDefault();
    if (!name.trim() || !msnv.trim() || !phone.trim()) {
      toast.show("Vui lòng nhập đầy đủ thông tin.", "warning");
      return;
    }

    setIsSaving(true);
    try {
      const docRef = doc(db, "lockers", lockerId);
      const nowStr = new Date().toISOString();
      const payload = {
        name: name.trim(),
        department,
        msnv: msnv.trim().toUpperCase(),
        phone: phone.trim(),
        assignedAt: nowStr,
        status: "approved" // EHS cấp phát trực tiếp nên được approve luôn
      };

      await setDoc(docRef, {
        id: lockerId,
        currentUser: payload,
        history: arrayUnion({
          ...payload,
          action: "assigned_by_ehs",
          timestamp: nowStr
        })
      }, { merge: true });

      onSuccess();
    } catch (err) {
      console.error("Lỗi khi cấp tủ:", err);
      toast.show("Không thể cấp tủ đồ.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  const inputStyle = { width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--lk-input-border)", background: "var(--lk-input-bg)", color: "var(--lk-input-text)", fontSize: "14px", marginTop: "5px", boxSizing: "border-box" };

  return (
    <form onSubmit={handleAssign} style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "12px" }}>
      <div>
        <label style={{ fontSize: "12px", color: "var(--lk-text-secondary)", fontWeight: "700" }}>Tên nhân viên *</label>
        <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Nguyễn Văn A" style={inputStyle} />
      </div>

      <div style={{ display: "flex", gap: "12px" }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: "12px", color: "var(--lk-text-secondary)", fontWeight: "700" }}>Bộ phận *</label>
          <select value={department} onChange={e => setDepartment(e.target.value)} style={{ ...inputStyle, height: "40px" }}>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: "12px", color: "var(--lk-text-secondary)", fontWeight: "700" }}>MSNV *</label>
          <input type="text" required value={msnv} onChange={e => setMsnv(e.target.value)} placeholder="V123456" style={inputStyle} />
        </div>
      </div>

      {otherLockers.length > 0 && (
        <div style={{ background: "rgba(237, 137, 54, 0.15)", border: "1px solid rgba(237, 137, 54, 0.3)", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", color: "var(--lk-pending-text)", fontWeight: "600" }}>
          ⚠️ Nhân viên này hiện đang sử dụng tủ: {otherLockers.join(", ")}
        </div>
      )}

      <div>
        <label style={{ fontSize: "12px", color: "var(--lk-text-secondary)", fontWeight: "700" }}>Số điện thoại liên hệ *</label>
        <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="0987654321" style={inputStyle} />
      </div>

      <button
        type="submit"
        disabled={isSaving}
        style={{ width: "100%", padding: "11px", background: colors.success, color: "#fff", border: "none", borderRadius: "8px", fontWeight: "700", cursor: "pointer", fontSize: "15px", marginTop: "10px" }}
      >
        {isSaving ? "Đang tiến hành..." : "Xác nhận Bàn giao tủ"}
      </button>
    </form>
  );
}

// MODAL ĐỔI TỦ (TRANSFER LOCKER)
function LockerTransferModal({ lockerId, currentUser, vacantLockers, onClose, onSuccess }) {
  const toast = useToast();
  const [targetLockerId, setTargetLockerId] = useState(vacantLockers[0] || "");
  const [isTransferring, setIsTransferring] = useState(false);

  async function handleTransfer() {
    if (!targetLockerId) {
      toast.show("Vui lòng chọn tủ đích để di dời.", "warning");
      return;
    }

    setIsTransferring(true);
    try {
      const nowStr = new Date().toISOString();
      const oldDocRef = doc(db, "lockers", lockerId);
      const newDocRef = doc(db, "lockers", targetLockerId);
      
      const batch = writeBatch(db);

      // 1. Cập nhật tủ mới (Ghi nhận thông tin người dùng và lịch sử nhận tủ, trạng thái đã phê duyệt)
      const payload = {
        ...currentUser,
        assignedAt: nowStr,
        status: "approved"
      };
      batch.set(newDocRef, {
        id: targetLockerId,
        currentUser: payload,
        history: arrayUnion({
          ...payload,
          action: "transferred_from_" + lockerId,
          timestamp: nowStr
        })
      }, { merge: true });

      // 2. Thu hồi tủ cũ (Clear người dùng hiện tại và ghi lịch sử bàn giao)
      batch.set(oldDocRef, {
        currentUser: null,
        history: arrayUnion({
          ...currentUser,
          action: "transferred_to_" + targetLockerId,
          timestamp: nowStr
        })
      }, { merge: true });

      await batch.commit();
      onSuccess();
    } catch (err) {
      console.error("Lỗi đổi tủ:", err);
      toast.show("Đổi tủ thất bại.", "error");
    } finally {
      setIsTransferring(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1300 }}>
      <div style={{ background: "var(--lk-modal-bg)", width: "90%", maxWidth: "400px", padding: "22px", borderRadius: "16px", border: "1px solid var(--lk-modal-border)", boxShadow: "0 8px 30px rgba(0,0,0,0.3)" }}>
        <h3 style={{ margin: "0 0 12px 0", color: "var(--lk-text-primary)" }}>🔄 Đổi tủ cho: {currentUser.name}</h3>
        <p style={{ fontSize: "13px", color: "var(--lk-text-secondary)", lineHeight: "1.5" }}>
          Di chuyển nhân viên từ tủ hiện tại <b>{lockerId}</b> sang tủ mới trống.
        </p>

        <div style={{ margin: "20px 0 24px 0" }}>
          <label style={{ fontSize: "12px", color: "var(--lk-text-secondary)", fontWeight: "700", display: "block", marginBottom: "6px" }}>Chọn tủ đích trống *</label>
          {vacantLockers.length > 0 ? (
            <select
              value={targetLockerId}
              onChange={e => setTargetLockerId(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--lk-input-border)", background: "var(--lk-input-bg)", color: "var(--lk-input-text)", fontSize: "15px", fontWeight: "700" }}
            >
              {vacantLockers.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          ) : (
            <div style={{ color: "#fc8181", fontSize: "14px", fontWeight: "600" }}>⚠️ Không còn tủ trống nào khả dụng.</div>
          )}
        </div>

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            disabled={isTransferring}
            style={{ padding: "8px 16px", background: "var(--lk-badge-bg)", border: "none", borderRadius: "8px", color: "var(--lk-text-secondary)", cursor: "pointer", fontWeight: "700" }}
          >
            Hủy
          </button>
          <button
            onClick={handleTransfer}
            disabled={isTransferring || !targetLockerId}
            style={{ padding: "8px 16px", background: colors.primary, border: "none", borderRadius: "8px", color: "#fff", cursor: "pointer", fontWeight: "700" }}
          >
            {isTransferring ? "Đang xử lý..." : "Xác nhận Đổi tủ"}
          </button>
        </div>
      </div>
    </div>
  );
}
