import React, { useState, useEffect, useMemo } from "react";
import dbService from "../services/dbService";
import { colors } from "../theme";
import { useConfirm, useToast } from "./LightboxSwipeOnly";
import {
  FaSearch, FaFileExcel, FaDownload, FaUpload, FaEdit, FaTrash
} from "react-icons/fa";
import { FaScissors } from "react-icons/fa6";
import * as XLSX from "xlsx";
import realtimeService from "../services/realtimeService";

const DEPARTMENTS = [
  { code: "G_Cutting", name: "Golf Cutting" },
  { code: "G_Rolling", name: "Golf Rolling" },
  { code: "G_Finishing", name: "Golf Finishing" },
  { code: "G_Buffing", name: "Golf Buffing" },
  { code: "G_Dipping", name: "Golf Dipping" },
  { code: "G_Graphics", name: "Golf Graphics" },
  { code: "A_Blank", name: "Arrow Blank" },
  { code: "A_Graphics", name: "Arrow Graphics" },
  { code: "Kayak", name: "Kayak" },
  { code: "QC", name: "QC" },
  { code: "MTN", name: "Maintenance (MTN)" },
  { code: "Warehouse", name: "Warehouse" },
  { code: "PAINT BLENDING", name: "Paint Blending" },
  { code: "QA", name: "QA" },
  { code: "Other", name: "Khác" }
];

const KNIFE_TYPES = [
  "Dao cán kim loại",
  "Dao cán nhựa lớn",
  "Dao cán nhựa nhỏ",
  "Dao X-ACTO",
  "Dao Cross Hatch",
  "Dao răng cưa",
  "Móng tay giả",
  "Kéo",
  "Sủi",
  "Sủi sử dụng lưỡi dao cán kim loại",
  "Khác"
];

// Tùy chọn cho "Loại dao đang dùng": các loại dao + "Không sử dụng" + "Khác" (chọn "Khác" sẽ hiện ô nhập tự do)
const CURRENT_KNIFE_OPTIONS = [
  ...KNIFE_TYPES.filter(t => t !== "Khác"),
  "Không sử dụng",
  "Khác"
];

// Tùy chọn cho "Dao mới đề xuất": mẫu Martor mặc định + cùng danh sách loại dao như "Loại dao đang dùng"
const NEW_KNIFE_OPTIONS = [
  "Dao cắt an toàn Martor 124001",
  ...KNIFE_TYPES.filter(t => t !== "Khác"),
  "Không sử dụng",
  "Khác"
];

// Giá trị được coi là "Khác" (không nằm trong danh sách cố định, trừ mục "Khác")
const isOtherValue = (value, options) =>
  !options.filter(o => o !== "Khác").includes((value || "").trim());

export default function Knife({ user, isMobile }) {
  const toast = useToast();
  const confirm = useConfirm();

  const [activeTab, setActiveTab] = useState("dashboard"); // "dashboard" | "list" | "registrations" | "excel"
  const [knives, setKnives] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDept, setFilterDept] = useState("all");
  const [searchRegQuery, setSearchRegQuery] = useState("");
  const [filterRegDept, setFilterRegDept] = useState("all");

  // Modal States for Knife Registration/Evaluation
  const [showRegModal, setShowRegModal] = useState(false);
  const [editingReg, setEditingReg] = useState(null);
  const [regForm, setRegForm] = useState({
    employeeName: "",
    userLocation: "",
    intendedUse: "",
    supervisor: "",
    currentKnifeType: "Dao cán kim loại",
    newKnifeType: "Dao cắt an toàn Martor 124001",
    usageStatus: "",
    agreement: "Chờ duyệt",
    note: "",
    department: "G_Cutting"
  });

  // User privileges
  const userRolesList = user?.role ? (Array.isArray(user.role) ? user.role.map(r => String(r).toLowerCase()) : String(user.role).split(',').map(r => r.trim().toLowerCase())) : [];
  const isEhsOrAdmin = userRolesList.some(r => r === 'admin' || r === 'ehs');

  const fetchKnives = async () => {
    try {
      const snap = await dbService.getDocs("knives");
      const list = Array.isArray(snap) ? snap : [];
      list.sort((a, b) => {
        if (a.department !== b.department) {
          return a.department.localeCompare(b.department);
        }
        return (a.stt || 0) - (b.stt || 0);
      });
      setKnives(list);
    } catch (err) {
      console.error(err);
      toast.show("Không thể tải danh sách dao.", "error");
    }
  };

  const fetchRegs = async () => {
    try {
      const snap = await dbService.getDocs("knife_registrations");
      const list = Array.isArray(snap) ? snap : [];
      list.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
      setRegistrations(list);
    } catch (err) {
      console.error(err);
      toast.show("Không thể tải danh sách đăng ký sử dụng.", "error");
    }
  };

  // Load Data qua Polling (real-time)
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchKnives(), fetchRegs()]).finally(() => setLoading(false));

    const unsubKnives = realtimeService.subscribeToPath("knives", () => { fetchKnives(); });
    const unsubRegs = realtimeService.subscribeToPath("knife_registrations", () => { fetchRegs(); });

    const intervalKnives = setInterval(fetchKnives, 30000);
    const intervalRegs = setInterval(fetchRegs, 30000);
    return () => {
      unsubKnives();
      unsubRegs();
      clearInterval(intervalKnives);
      clearInterval(intervalRegs);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy một lần khi mount
  }, []);

  // Compute stats — nguồn dữ liệu là các ĐĂNG KÝ (knife_registrations).
  // "Dao" trong danh sách/báo cáo = các đăng ký đã được EHS duyệt (agreement === "Đồng ý").
  const stats = useMemo(() => {
    const approved = registrations.filter(r => r.agreement === "Đồng ý");

    const totalRegs = registrations.length;
    const approvedCount = approved.length;
    // Chờ xác nhận = chưa có quyết định (Chờ duyệt / chưa đặt)
    const pendingCount = registrations.filter(r => !r.agreement || r.agreement === "Chờ duyệt").length;
    const agreeRate = totalRegs > 0 ? Math.round((approvedCount / totalRegs) * 100) : 0;

    // Thống kê dao đã duyệt theo loại dao mới và theo bộ phận (khóa động, không cố định)
    const knivesByType = {};
    const knivesByDept = {};
    approved.forEach(r => {
      const type = (r.newKnifeType || "").trim() || "Khác";
      knivesByType[type] = (knivesByType[type] || 0) + 1;
      const dept = r.department || "Other";
      knivesByDept[dept] = (knivesByDept[dept] || 0) + 1;
    });

    return {
      totalRegs,
      approvedCount,
      pendingCount,
      agreeRate,
      knivesByType,
      knivesByDept
    };
  }, [registrations]);

  // DANH SÁCH DAO = các đăng ký đã được duyệt (Đồng ý), áp bộ lọc của tab "Danh sách dao"
  const filteredApproved = useMemo(() => {
    let list = registrations.filter(r => r.agreement === "Đồng ý");
    if (filterDept !== "all") {
      list = list.filter(r => r.department === filterDept);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(r =>
        (r.employeeName || "").toLowerCase().includes(q) ||
        (r.userLocation || "").toLowerCase().includes(q) ||
        (r.supervisor || "").toLowerCase().includes(q) ||
        (r.newKnifeType || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [registrations, filterDept, searchQuery]);

  // FORM ĐĂNG KÝ & ĐÁNH GIÁ = hộp chờ: các đăng ký CHƯA được duyệt (khác "Đồng ý").
  // Sau khi EHS duyệt (Đồng ý), bản ghi rời khỏi tab này và sang tab "Danh sách dao".
  const filteredRegs = useMemo(() => {
    let list = registrations.filter(r => r.agreement !== "Đồng ý");
    if (filterRegDept !== "all") {
      list = list.filter(r => r.department === filterRegDept);
    }
    if (searchRegQuery) {
      const q = searchRegQuery.toLowerCase().trim();
      list = list.filter(r =>
        (r.employeeName || "").toLowerCase().includes(q) ||
        (r.userLocation || "").toLowerCase().includes(q) ||
        (r.supervisor || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [registrations, filterRegDept, searchRegQuery]);

  // Modal open helper
  const openRegModal = (reg = null) => {
    if (reg) {
      setEditingReg(reg);
      setRegForm({
        employeeName: reg.employeeName || "",
        userLocation: reg.userLocation || "",
        intendedUse: reg.intendedUse || "",
        supervisor: reg.supervisor || "",
        currentKnifeType: reg.currentKnifeType || "Dao cán kim loại",
        newKnifeType: reg.newKnifeType || "Dao cắt an toàn Martor 124001",
        usageStatus: reg.usageStatus || "",
        agreement: reg.agreement || "Chờ duyệt",
        note: reg.note || "",
        department: reg.department || "G_Cutting"
      });
    } else {
      setEditingReg(null);
      setRegForm({
        employeeName: "",
        userLocation: "",
        intendedUse: "",
        supervisor: "",
        currentKnifeType: "Dao cán kim loại",
        newKnifeType: "Dao cắt an toàn Martor 124001",
        usageStatus: "",
        agreement: "Chờ duyệt",
        note: "",
        department: "G_Cutting"
      });
    }
    setShowRegModal(true);
  };

  // CRUD Registrations
  const handleSaveReg = async (e) => {
    e.preventDefault();
    if (!regForm.employeeName || !regForm.userLocation) {
      toast.show("Vui lòng điền Họ tên và Vị trí!", "warning");
      return;
    }
    try {
      const id = editingReg ? editingReg.id : `reg_${Date.now()}`;
      const payload = {
        ...regForm,
        timestamp: editingReg ? editingReg.timestamp : new Date().toISOString()
      };
      await dbService.updateDoc("knife_registrations", id, payload);
      await fetchRegs();
      toast.show("Đăng ký thành công!", "success");
      setShowRegModal(false);
    } catch (err) {
      console.error(err);
      toast.show("Đăng ký thất bại.", "error");
    }
  };

  const handleDeleteReg = async (id, name) => {
    if (await confirm.askConfirm(`Bạn có chắc muốn xóa bản đăng ký của nhân viên "${name}" không?`, "Xác nhận xóa đăng ký")) {
      try {
        await dbService.deleteDoc("knife_registrations", id);
        await fetchRegs();
        toast.show("Đã xóa bản đăng ký thành công.", "success");
      } catch (err) {
        console.error(err);
        toast.show("Xóa thất bại.", "error");
      }
    }
  };

  // Excel Import
  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });

        // Parse Sheet 1: Danh Sách Dao
        const knivesSheet = workbook.Sheets['Danh Sách Dao'];
        let knivesCount = 0;
        if (knivesSheet) {
          const rawRows = XLSX.utils.sheet_to_json(knivesSheet, { header: 1, defval: "" });
          let currentDept = "Other";
          const parsedKnives = [];

          for (let r = 7; r < rawRows.length; r++) {
            const row = rawRows[r];
            if (!row || row.length === 0) continue;

            const val0 = String(row[0] || "").trim();
            const val1 = String(row[1] || "").trim();
            const val2 = String(row[2] || "").trim();
            const val4 = String(row[4] || "").trim();

            if (val0 && !val1 && !val2 && !val4) {
              currentDept = val0;
              continue;
            }

            if (val1 || val2) {
              parsedKnives.push({
                department: currentDept,
                userLocation: val1,
                type: val2,
                quantity: Number(row[3]) || 0,
                storageLocation: String(row[4] || "").trim(),
                intendedUse: String(row[5] || "").trim(),
                responsiblePerson: String(row[6] || "").trim(),
                registrationCode: String(row[7] || "").trim(),
                note: String(row[8] || "").trim(),
                martorStatus: String(row[9] || "").trim(),
                stt: row[0] !== "" ? Number(row[0]) : null
              });
            }
          }

          // Clear old
          const existKnives = await dbService.getDocs("knives");
          const opClear = (existKnives || []).map(d => ({
            path: `/api/db/knives/${d.id}`,
            method: "DELETE"
          }));
          await dbService.commitBatch(opClear);

          // Set new
          const opNew = parsedKnives.map((k, idx) => ({
            path: `/api/db/knives/knife_${idx + 1}`,
            method: "POST",
            body: k
          }));
          await dbService.commitBatch(opNew);
          knivesCount = parsedKnives.length;
        }

        // Parse Sheet 3: Nội dung đánh giá
        const evalSheet = workbook.Sheets['Nội dung đánh giá'];
        let regsCount = 0;
        if (evalSheet) {
          const rawRows = XLSX.utils.sheet_to_json(evalSheet, { header: 1, defval: "" });
          const parsedRegs = [];

          for (let r = 2; r < rawRows.length; r++) {
            const row = rawRows[r];
            if (!row || row.length === 0) continue;

            const stt = row[0];
            const userLocation = String(row[1] || "").trim();
            const employeeName = String(row[3] || "").trim();
            if (!employeeName && !userLocation) continue;

            const agreement = String(row[8] || "").trim() ? "Đồng ý" : (String(row[9] || "").trim() ? "Không đồng ý" : "Chưa xác định");
            
            // Map location to deptCode
            let department = "Other";
            const userLocLower = userLocation.toLowerCase();
            if (userLocLower.includes("cutting") || userLocLower.includes("sheet")) department = "G_Cutting";
            else if (userLocLower.includes("rolling") || userLocLower.includes("cdi") || userLocLower.includes("revo") || userLocLower.includes("lò sấy")) department = "G_Rolling";
            else if (userLocLower.includes("finishing") || userLocLower.includes("cạo tem")) department = "G_Finishing";
            else if (userLocLower.includes("buff") || userLocLower.includes("buffing")) department = "G_Buffing";
            else if (userLocLower.includes("dipping") || userLocLower.includes("pha sơn")) department = "G_Dipping";
            else if (userLocLower.includes("graphics")) department = "G_Graphics";
            else if (userLocLower.includes("kayak")) department = "Kayak";
            else if (userLocLower.includes("qc") || userLocLower.includes("kiểm")) department = "G_QC";
            else if (userLocLower.includes("kho rác") || userLocLower.includes("kho")) department = "Warehouse";

            parsedRegs.push({
              stt: stt !== "" ? Number(stt) : null,
              userLocation,
              intendedUse: String(row[2] || "").trim(),
              employeeName,
              supervisor: String(row[4] || "").trim(),
              currentKnifeType: String(row[5] || "").trim(),
              newKnifeType: String(row[6] || "").trim(),
              usageStatus: String(row[7] || "").trim(),
              agreement,
              note: String(row[11] || "").trim(),
              department,
              status: "Approved",
              timestamp: new Date().toISOString()
            });
          }

          // Clear old
          const existRegs = await dbService.getDocs("knife_registrations");
          const opClearRegs = (existRegs || []).map(d => ({
            path: `/api/db/knife_registrations/${d.id}`,
            method: "DELETE"
          }));
          await dbService.commitBatch(opClearRegs);

          // Set new
          const opNewRegs = parsedRegs.map((rg, idx) => ({
            path: `/api/db/knife_registrations/reg_${idx + 1}`,
            method: "POST",
            body: rg
          }));
          await dbService.commitBatch(opNewRegs);
          regsCount = parsedRegs.length;
        }

        toast.show(`Đã nhập thành công ${knivesCount} dao và ${regsCount} đăng ký đánh giá!`, "success");
        await fetchKnives();
        await fetchRegs();
        if (e.target) e.target.value = "";
      } catch (err) {
        console.error(err);
        toast.show("Nhập tệp Excel thất bại: " + err.message, "error");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Excel Export
  const handleExportExcel = async () => {
    try {
      const [{ default: ExcelJS }, { saveAs }] = await Promise.all([
        import("exceljs"),
        import("file-saver")
      ]);
      const wb = new ExcelJS.Workbook();

      // Styles
      const titleFont = { name: "Times New Roman", size: 16, bold: true };
      const headerFont = { name: "Times New Roman", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF466E73" } }; // Teal
      const borderThin = {
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        right: { style: "thin", color: { argb: "FFCBD5E1" } },
        top: { style: "thin", color: { argb: "FFCBD5E1" } },
        bottom: { style: "thin", color: { argb: "FFCBD5E1" } }
      };

      // ==========================================
      // SHEET 1: Danh Sách Dao
      // ==========================================
      const wsKnives = wb.addWorksheet("Danh Sách Dao");
      
      wsKnives.mergeCells("A1:K2");
      const titleCell = wsKnives.getCell("A1");
      titleCell.value = "DANH SÁCH QUẢN LÝ DAO\nLIST OF KNIVES MANAGEMENT";
      titleCell.font = titleFont;
      titleCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      wsKnives.getRow(1).height = 25;
      wsKnives.getRow(2).height = 25;

      wsKnives.getCell("A5").value = "Updated: " + new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
      wsKnives.getCell("A5").font = { name: "Times New Roman", size: 10, italic: true };

      const headers1 = [
        "STT\nNo.",
        "VỊ TRÍ SỬ DỤNG\nUser location",
        "LOẠI DAO\nType",
        "SL\nQuantity",
        "VỊ TRÍ LƯU TRỮ\nStorage location",
        "Mục Đích Sử Dụng\nIntended Use",
        "NGƯỜI PHỤ TRÁCH\nResponsible person",
        "MÃ ĐĂNG KÝ\nRegistration Code",
        "GHI CHÚ\nNote",
        "ĐÁNH GIÁ MARTOR\nMartor Status",
        ""
      ];
      wsKnives.getRow(7).values = headers1;
      wsKnives.getRow(7).height = 28;

      wsKnives.columns = [
        { key: "stt", width: 6 },
        { key: "userLocation", width: 22 },
        { key: "type", width: 22 },
        { key: "quantity", width: 10 },
        { key: "storageLocation", width: 22 },
        { key: "intendedUse", width: 30 },
        { key: "responsiblePerson", width: 22 },
        { key: "registrationCode", width: 15 },
        { key: "note", width: 15 },
        { key: "martorStatus", width: 25 },
        { width: 5 }
      ];

      // Format Header Row
      wsKnives.getRow(7).eachCell((cell) => {
        cell.font = headerFont;
        cell.fill = headerFill;
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = borderThin;
      });

      // Write Data grouped by department
      let rowIndex = 8;
      const depts = Array.from(new Set(knives.map(k => k.department)));
      
      depts.forEach(dept => {
        // Department Title Row
        wsKnives.addRow([dept]);
        const deptRow = wsKnives.getRow(rowIndex);
        deptRow.height = 22;
        deptRow.getCell(1).font = { name: "Times New Roman", size: 11, bold: true, color: { argb: "FF2C494C" } };
        deptRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEBF5F4" } };
        
        // Merge cells for department name
        wsKnives.mergeCells(`A${rowIndex}:J${rowIndex}`);
        wsKnives.getCell(`A${rowIndex}`).border = borderThin;
        rowIndex++;

        // Department items
        const deptKnives = knives.filter(k => k.department === dept);
        deptKnives.forEach((k, i) => {
          wsKnives.addRow([
            k.stt || (i + 1),
            k.userLocation || "",
            k.type || "",
            k.quantity || 0,
            k.storageLocation || "",
            k.intendedUse || "",
            k.responsiblePerson || "",
            k.registrationCode || "",
            k.note || "",
            k.martorStatus || ""
          ]);
          
          const row = wsKnives.getRow(rowIndex);
          row.height = 20;
          row.font = { name: "Times New Roman", size: 11 };
          row.eachCell((cell, colNum) => {
            cell.border = borderThin;
            if (colNum === 1 || colNum === 4 || colNum === 8 || colNum === 10) {
              cell.alignment = { horizontal: "center", vertical: "middle" };
            } else {
              cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
            }
          });
          rowIndex++;
        });
      });

      // ==========================================
      // SHEET 2: Tổng số lượng
      // ==========================================
      const wsSummary = wb.addWorksheet("Tổng số lượng");
      wsSummary.columns = [
        { header: "Loại Dao", key: "type", width: 30 },
        { header: "Số Lượng", key: "quantity", width: 15 }
      ];
      wsSummary.getRow(1).height = 24;
      wsSummary.getRow(1).eachCell((cell) => {
        cell.font = headerFont;
        cell.fill = headerFill;
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = borderThin;
      });

      // Đếm số lượng theo loại dao từ kho master (knives) — độc lập với stats (vốn dựa trên đăng ký đã duyệt)
      const exportTypeCount = {};
      KNIFE_TYPES.forEach(t => { exportTypeCount[t] = 0; });
      knives.forEach(k => {
        const t = KNIFE_TYPES.includes(k.type) ? k.type : "Khác";
        exportTypeCount[t] += k.quantity || 0;
      });

      KNIFE_TYPES.forEach((type, idx) => {
        const qty = exportTypeCount[type] || 0;
        wsSummary.addRow([type, qty]);
        const row = wsSummary.getRow(idx + 2);
        row.height = 20;
        row.font = { name: "Times New Roman", size: 11 };
        row.getCell(1).border = borderThin;
        row.getCell(2).border = borderThin;
        row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
      });

      // ==========================================
      // SHEET 3: Nội dung đánh giá
      // ==========================================
      const wsEval = wb.addWorksheet("Nội dung đánh giá");
      
      wsEval.mergeCells("A1:L1");
      const titleCell3 = wsEval.getCell("A1");
      titleCell3.value = "Đánh Giá Sử Dụng Dao An Toàn Martor 124001";
      titleCell3.font = { name: "Times New Roman", size: 15, bold: true };
      titleCell3.alignment = { horizontal: "center", vertical: "middle" };
      wsEval.getRow(1).height = 28;

      const headers3 = [
        "STT",
        "Vị trí",
        "Mục đích sử dụng",
        "Nhân viên sử dụng",
        "Giám sát xác nhận",
        "Loại dao đang sử dụng",
        "Dao mới",
        "Hiện trạng sử dụng",
        "Đồng ý thay đổi",
        "Không đồng ý thay đổi",
        "Ảnh",
        "Ghi chú"
      ];
      wsEval.getRow(2).values = headers3;
      wsEval.getRow(2).height = 24;

      wsEval.columns = [
        { key: "stt", width: 6 },
        { key: "userLocation", width: 22 },
        { key: "intendedUse", width: 25 },
        { key: "employeeName", width: 22 },
        { key: "supervisor", width: 20 },
        { key: "currentKnifeType", width: 20 },
        { key: "newKnifeType", width: 22 },
        { key: "usageStatus", width: 25 },
        { key: "agree", width: 15 },
        { key: "disagree", width: 18 },
        { key: "photo", width: 12 },
        { key: "note", width: 25 }
      ];

      wsEval.getRow(2).eachCell((cell) => {
        cell.font = headerFont;
        cell.fill = headerFill;
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = borderThin;
      });

      registrations.forEach((r, idx) => {
        wsEval.addRow([
          r.stt || (idx + 1),
          r.userLocation || "",
          r.intendedUse || "",
          r.employeeName || "",
          r.supervisor || "",
          r.currentKnifeType || "",
          r.newKnifeType || "",
          r.usageStatus || "",
          r.agreement === "Đồng ý" ? "Đồng ý sử dụng" : "",
          r.agreement === "Không đồng ý" ? "Không đồng ý" : "",
          "", // Photo blank
          r.note || ""
        ]);
        
        const row = wsEval.getRow(idx + 3);
        row.height = 22;
        row.font = { name: "Times New Roman", size: 11 };
        row.eachCell((cell, colNum) => {
          cell.border = borderThin;
          if (colNum === 1 || colNum === 9 || colNum === 10) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
          } else {
            cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
          }
        });
      });

      // Write and save
      const out = await wb.xlsx.writeBuffer();
      const dateStr = new Date().toLocaleDateString("vi-VN").replace(/\//g, "-");
      saveAs(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `List_of_knives_management_ACP_${dateStr}.xlsx`);
      toast.show("Xuất báo cáo Excel thành công!", "success");

    } catch (err) {
      console.error(err);
      toast.show("Xuất báo cáo thất bại: " + err.message, "error");
    }
  };

  // Nhóm danh sách dao đã duyệt theo bộ phận để hiển thị tab "Danh sách dao"
  const approvedGroupedByDept = useMemo(() => {
    const grouped = {};
    filteredApproved.forEach(r => {
      const dept = r.department || "Other";
      if (!grouped[dept]) grouped[dept] = [];
      grouped[dept].push(r);
    });
    return grouped;
  }, [filteredApproved]);

  // Các bộ phận đang có dao đã duyệt (cho biểu đồ + bộ lọc)
  const activeDepts = useMemo(() => {
    return Object.keys(stats.knivesByDept).sort();
  }, [stats.knivesByDept]);

  return (
    <div className="knife-container" style={{ padding: "8px 0", color: "var(--kf-text-primary)", width: "100%", boxSizing: "border-box" }}>
      <style dangerouslySetInnerHTML={{__html: `
        /* Biến cục bộ --kf-* là bí danh của token --so-* toàn app. Khối dark
           riêng cũ (bám prefers-color-scheme của OS) đã bỏ: nó không nghe công
           tắc sáng/tối của app; --so-* tự đổi theo data-theme nên bí danh đổi theo. */
        .knife-container {
          --kf-text-primary: var(--so-text-primary);
          --kf-text-secondary: var(--so-text-secondary);
          --kf-card-bg: var(--so-surface);
          --kf-card-border: var(--so-border);
          --kf-input-bg: var(--so-surface);
          --kf-input-border: var(--so-border);
          --kf-grid-bg: var(--so-background);
          --kf-grid-border: var(--so-border);
          --kf-badge-agree-bg: rgba(var(--so-success-rgb), 0.15);
          --kf-badge-agree-text: var(--so-success);
          --kf-badge-disagree-bg: rgba(var(--so-error-rgb), 0.15);
          --kf-badge-disagree-text: var(--so-error);
          --kf-badge-pending-bg: rgba(var(--so-warning-rgb), 0.15);
          --kf-badge-pending-text: var(--so-warning);
        }
      `}} />

      {/* Title */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 800, color: "var(--kf-text-primary)", fontSize: "22px" }}>✂️ Quản Lý Dao</h2>
          <p style={{ margin: "4px 0 0 0", color: "var(--kf-text-secondary)", fontSize: "13px" }}>Quản lý đăng ký sử dụng dao, kiểm soát danh mục và báo cáo tổng hợp</p>
        </div>

        {/* Dynamic Metric summary cards */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ background: "var(--kf-card-bg)", border: "1px solid var(--kf-card-border)", padding: "8px 16px", borderRadius: 12, textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "var(--kf-text-secondary)", fontWeight: "600" }}>TỔNG DAO ĐÃ ĐĂNG KÝ</div>
            <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--kf-text-primary)" }}>{stats.totalRegs}</div>
          </div>
          <div style={{ background: "var(--kf-badge-pending-bg)", border: "1px solid var(--kf-card-border)", padding: "8px 16px", borderRadius: 12, textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "var(--kf-badge-pending-text)", fontWeight: "600" }}>CHỜ XÁC NHẬN</div>
            <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--kf-badge-pending-text)" }}>{stats.pendingCount}</div>
          </div>
          <div style={{ background: "var(--kf-badge-agree-bg)", border: "1px solid var(--kf-card-border)", padding: "8px 16px", borderRadius: 12, textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "var(--kf-badge-agree-text)", fontWeight: "600" }}>ĐỒNG Ý DÙNG DAO</div>
            <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--kf-badge-agree-text)" }}>{stats.approvedCount} / {stats.totalRegs} ({stats.agreeRate}%)</div>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, borderBottom: "1.5px solid var(--kf-card-border)", paddingBottom: 10, overflowX: "auto" }}>
        <button 
          onClick={() => setActiveTab("dashboard")} 
          style={{ padding: "8px 16px", background: activeTab === "dashboard" ? colors.primary : "transparent", border: "none", borderRadius: 8, color: activeTab === "dashboard" ? colors.white : "var(--kf-text-secondary)", fontWeight: "bold", cursor: "pointer", fontSize: "14px", whiteSpace: "nowrap" }}
        >
          📊 Báo cáo tổng hợp
        </button>
        <button 
          onClick={() => setActiveTab("list")} 
          style={{ padding: "8px 16px", background: activeTab === "list" ? colors.primary : "transparent", border: "none", borderRadius: 8, color: activeTab === "list" ? colors.white : "var(--kf-text-secondary)", fontWeight: "bold", cursor: "pointer", fontSize: "14px", whiteSpace: "nowrap" }}
        >
          📋 Danh sách dao
        </button>
        <button 
          onClick={() => setActiveTab("registrations")} 
          style={{ padding: "8px 16px", background: activeTab === "registrations" ? colors.primary : "transparent", border: "none", borderRadius: 8, color: activeTab === "registrations" ? colors.white : "var(--kf-text-secondary)", fontWeight: "bold", cursor: "pointer", fontSize: "14px", whiteSpace: "nowrap" }}
        >
          📝 Form đăng ký & Đánh giá
        </button>
        {isEhsOrAdmin && (
          <button
            onClick={() => setActiveTab("excel")}
            style={{ padding: "8px 16px", background: activeTab === "excel" ? colors.primary : "transparent", border: "none", borderRadius: 8, color: activeTab === "excel" ? colors.white : "var(--kf-text-secondary)", fontWeight: "bold", cursor: "pointer", fontSize: "14px", whiteSpace: "nowrap" }}
          >
            📤 Xuất/Nhập tệp Excel
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--kf-text-secondary)" }}>Đang tải dữ liệu quản lý dao...</div>
      ) : (
        <>
          {/* TAB 1: BÁO CÁO TỔNG HỢP */}
          {activeTab === "dashboard" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 }}>
                {/* Panel 1: Thống kê loại dao */}
                <div style={{ background: "var(--kf-card-bg)", border: "1.5px solid var(--kf-card-border)", borderRadius: 16, padding: "20px" }}>
                  <h3 style={{ margin: "0 0 16px 0", color: colors.primary }}>Thống kê dao đã duyệt theo loại</h3>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: `1.5px solid ${colors.border}` }}>
                        <th style={{ textAlign: "left", padding: "8px 4px", fontSize: "13px", color: "var(--kf-text-secondary)" }}>Loại Dao</th>
                        <th style={{ textAlign: "center", padding: "8px 4px", fontSize: "13px", color: "var(--kf-text-secondary)", width: "100px" }}>Số Lượng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(stats.knivesByType).length === 0 ? (
                        <tr>
                          <td colSpan={2} style={{ padding: "16px 4px", fontSize: "13px", textAlign: "center", color: "var(--kf-text-secondary)" }}>Chưa có dao nào được duyệt.</td>
                        </tr>
                      ) : (
                        Object.entries(stats.knivesByType)
                          .sort((a, b) => b[1] - a[1])
                          .map(([type, qty], idx) => (
                            <tr key={idx} style={{ borderBottom: `1px solid var(--kf-card-border)` }}>
                              <td style={{ padding: "8px 4px", fontSize: "14px", fontWeight: "600" }}>{type}</td>
                              <td style={{ padding: "8px 4px", fontSize: "14px", textAlign: "center", fontWeight: "800", color: colors.primary }}>{qty}</td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Panel 2: Biểu đồ SVG Thống kê dao theo bộ phận */}
                <div style={{ background: "var(--kf-card-bg)", border: "1.5px solid var(--kf-card-border)", borderRadius: 16, padding: "20px", display: "flex", flexDirection: "column" }}>
                  <h3 style={{ margin: "0 0 16px 0", color: colors.primary }}>Dao đã duyệt theo bộ phận</h3>
                  
                  <div style={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
                    {/* SVG Chart */}
                    <svg viewBox="0 0 400 220" style={{ width: "100%", maxHeight: "250px" }}>
                      {/* Grid lines */}
                      {[0, 25, 50, 75, 100].map((tick, i) => (
                        <g key={i}>
                          <line x1="40" y1={180 - tick * 1.5} x2="380" y2={180 - tick * 1.5} stroke="var(--kf-card-border)" strokeWidth="0.5" />
                          <text x="10" y={184 - tick * 1.5} style={{ fontSize: "9px", fill: "var(--kf-text-secondary)" }}>{tick}</text>
                        </g>
                      ))}

                      {/* Render Bars */}
                      {activeDepts.map((deptCode, idx) => {
                        const count = stats.knivesByDept[deptCode] || 0;
                        const x = 50 + idx * 25;
                        const barHeight = Math.min(count * 1.5, 150); // Scale logic
                        const y = 180 - barHeight;

                        return (
                          <g key={deptCode} className="chart-bar-group">
                            {/* Bar */}
                            <rect 
                              x={x} 
                              y={y} 
                              width="14" 
                              height={Math.max(barHeight, 2)} 
                              fill={colors.primary} 
                              rx="3" 
                              style={{ cursor: "pointer" }}
                            />
                            
                            {/* Value text above bar */}
                            {count > 0 && (
                              <text x={x + 7} y={y - 4} textAnchor="middle" style={{ fontSize: "8px", fontWeight: "bold", fill: "var(--kf-text-primary)" }}>{count}</text>
                            )}

                            {/* Label text rotated at bottom */}
                            <text 
                              x={x + 7} 
                              y="194" 
                              textAnchor="end" 
                              transform={`rotate(-45, ${x + 7}, 194)`}
                              style={{ fontSize: "8px", fill: "var(--kf-text-secondary)" }}
                            >
                              {deptCode.replace("G_", "")}
                            </text>

                            <title>{`${deptCode}: ${count} dao`}</title>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DANH SÁCH DAO — các đăng ký đã được EHS duyệt (Đồng ý) */}
          {activeTab === "list" && (
            <div style={{ background: "var(--kf-card-bg)", border: "1.5px solid var(--kf-card-border)", borderRadius: 16, padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flexGrow: 1 }}>
                  {/* Search */}
                  <div style={{ position: "relative", minWidth: "200px" }}>
                    <FaSearch style={{ position: "absolute", left: 10, top: 12, color: "var(--kf-text-muted)" }} />
                    <input
                      type="text"
                      placeholder="Tìm nhân viên, vị trí, loại dao..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      style={{ padding: "8px 12px 8px 30px", borderRadius: 8, border: "1px solid var(--kf-input-border)", background: "var(--kf-input-bg)", color: "var(--kf-input-text)", width: "100%", boxSizing: "border-box" }}
                    />
                  </div>

                  {/* Dept Filter */}
                  <select
                    value={filterDept}
                    onChange={e => setFilterDept(e.target.value)}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--kf-input-border)", background: "var(--kf-input-bg)", color: "var(--kf-input-text)", fontWeight: "600" }}
                  >
                    <option value="all">Tất cả bộ phận</option>
                    {activeDepts.map(d => (
                      <option key={d} value={d}>{DEPARTMENTS.find(x => x.code === d)?.name || d}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Table list grouped by department */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                  <thead>
                    <tr style={{ background: colors.primary, color: colors.white, height: "35px" }}>
                      <th style={{ padding: "8px 6px", width: 50, textAlign: "center" }}>No.</th>
                      <th style={{ padding: "8px 6px", textAlign: "left" }}>Nhân viên sử dụng</th>
                      <th style={{ padding: "8px 6px", textAlign: "left" }}>Vị trí sử dụng</th>
                      <th style={{ padding: "8px 6px", textAlign: "left" }}>Mục đích sử dụng</th>
                      <th style={{ padding: "8px 6px", textAlign: "left" }}>Giám sát xác nhận</th>
                      <th style={{ padding: "8px 6px", textAlign: "left" }}>Loại dao</th>
                      <th style={{ padding: "8px 6px", textAlign: "center" }}>Trạng thái</th>
                      {isEhsOrAdmin && <th style={{ padding: "8px 6px", width: 80, textAlign: "center" }}>Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(approvedGroupedByDept).length === 0 ? (
                      <tr>
                        <td colSpan={isEhsOrAdmin ? 8 : 7} style={{ padding: "20px", textAlign: "center", color: "var(--kf-text-secondary)" }}>
                          Chưa có dao nào được duyệt.
                        </td>
                      </tr>
                    ) : (
                      Object.keys(approvedGroupedByDept).map(dept => (
                        <React.Fragment key={dept}>
                          {/* Department Title bar */}
                          <tr style={{ background: "var(--kf-grid-bg)" }}>
                            <td colSpan={isEhsOrAdmin ? 8 : 7} style={{ padding: "8px 12px", fontWeight: "bold", color: colors.primaryDark, fontSize: "14px", borderBottom: `1px solid var(--kf-grid-border)` }}>
                              📁 Bộ phận: {DEPARTMENTS.find(x => x.code === dept)?.name || dept}
                            </td>
                          </tr>

                          {/* Dao đã duyệt trong bộ phận */}
                          {approvedGroupedByDept[dept].map((r, idx) => (
                            <tr key={r.id} style={{ borderBottom: `1px solid var(--kf-card-border)` }} className="hover-row">
                              <td style={{ padding: "8px 6px", textAlign: "center", fontWeight: "600", fontSize: "13px" }}>{r.stt || (idx + 1)}</td>
                              <td style={{ padding: "8px 6px", fontSize: "14px", fontWeight: "600" }}>{r.employeeName}</td>
                              <td style={{ padding: "8px 6px", fontSize: "13px" }}>{r.userLocation}</td>
                              <td style={{ padding: "8px 6px", fontSize: "13px", color: "var(--kf-text-secondary)" }}>{r.intendedUse}</td>
                              <td style={{ padding: "8px 6px", fontSize: "13px" }}>{r.supervisor}</td>
                              <td style={{ padding: "8px 6px", fontSize: "13px", fontWeight: "500", color: colors.primary }}>{r.newKnifeType}</td>
                              <td style={{ padding: "8px 6px", textAlign: "center" }}>
                                <span style={{ padding: "4px 8px", borderRadius: 6, fontSize: "11px", fontWeight: "bold", background: "var(--kf-badge-agree-bg)", color: "var(--kf-badge-agree-text)" }}>
                                  {r.agreement}
                                </span>
                              </td>
                              {isEhsOrAdmin && (
                                <td style={{ padding: "8px 6px", textAlign: "center" }}>
                                  <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                                    <button onClick={() => openRegModal(r)} style={{ border: "none", background: "transparent", cursor: "pointer", color: colors.primary }} title="Xem / Chỉnh sửa"><FaEdit /></button>
                                    <button onClick={() => handleDeleteReg(r.id, r.employeeName)} style={{ border: "none", background: "transparent", cursor: "pointer", color: colors.error }} title="Xóa"><FaTrash /></button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: ĐĂNG KÝ & ĐÁNH GIÁ DAO */}
          {activeTab === "registrations" && (
            <div style={{ background: "var(--kf-card-bg)", border: "1.5px solid var(--kf-card-border)", borderRadius: 16, padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flexGrow: 1 }}>
                  {/* Search */}
                  <div style={{ position: "relative", minWidth: "200px" }}>
                    <FaSearch style={{ position: "absolute", left: 10, top: 12, color: "var(--kf-text-muted)" }} />
                    <input
                      type="text"
                      placeholder="Tìm nhân viên, vị trí, người xác nhận..."
                      value={searchRegQuery}
                      onChange={e => setSearchRegQuery(e.target.value)}
                      style={{ padding: "8px 12px 8px 30px", borderRadius: 8, border: "1px solid var(--kf-input-border)", background: "var(--kf-input-bg)", color: "var(--kf-input-text)", width: "100%", boxSizing: "border-box" }}
                    />
                  </div>

                  {/* Dept Filter */}
                  <select
                    value={filterRegDept}
                    onChange={e => setFilterRegDept(e.target.value)}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--kf-input-border)", background: "var(--kf-input-bg)", color: "var(--kf-input-text)", fontWeight: "600" }}
                  >
                    <option value="all">Tất cả bộ phận</option>
                    {DEPARTMENTS.map(d => (
                      <option key={d.code} value={d.code}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <button 
                  onClick={() => openRegModal(null)}
                  style={{ padding: "8px 16px", background: colors.secondary, color: colors.white, border: "none", borderRadius: 8, fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                >
                  <FaScissors /> Đăng ký sử dụng dao
                </button>
              </div>

              {/* Regs Table */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 950 }}>
                  <thead>
                    <tr style={{ background: colors.primary, color: colors.white, height: "35px" }}>
                      <th style={{ padding: "8px 6px", width: 50, textAlign: "center" }}>STT</th>
                      <th style={{ padding: "8px 6px", textAlign: "left" }}>Nhân viên sử dụng</th>
                      <th style={{ padding: "8px 6px", textAlign: "left" }}>Bộ phận</th>
                      <th style={{ padding: "8px 6px", textAlign: "left" }}>Vị trí</th>
                      <th style={{ padding: "8px 6px", textAlign: "left" }}>Mục đích sử dụng</th>
                      <th style={{ padding: "8px 6px", textAlign: "left" }}>Giám sát xác nhận</th>
                      <th style={{ padding: "8px 6px", textAlign: "left" }}>Dao đang dùng</th>
                      <th style={{ padding: "8px 6px", textAlign: "left" }}>Dao mới đề xuất</th>
                      <th style={{ padding: "8px 6px", textAlign: "center" }}>Đồng ý Martor</th>
                      <th style={{ padding: "8px 6px", textAlign: "left" }}>Ghi chú</th>
                      <th style={{ padding: "8px 6px", width: 80, textAlign: "center" }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRegs.length === 0 ? (
                      <tr>
                        <td colSpan={11} style={{ padding: "20px", textAlign: "center", color: "var(--kf-text-secondary)" }}>
                          Không có đăng ký nào đang chờ duyệt.
                        </td>
                      </tr>
                    ) : (
                      filteredRegs.map((r, idx) => (
                        <tr key={r.id} style={{ borderBottom: `1px solid var(--kf-card-border)` }} className="hover-row">
                          <td style={{ padding: "8px 6px", textAlign: "center", fontWeight: "600" }}>{r.stt || (idx + 1)}</td>
                          <td style={{ padding: "8px 6px", fontSize: "14px", fontWeight: "600" }}>{r.employeeName}</td>
                          <td style={{ padding: "8px 6px", fontSize: "13px" }}>
                            {DEPARTMENTS.find(d => d.code === r.department)?.name || r.department}
                          </td>
                          <td style={{ padding: "8px 6px", fontSize: "13px" }}>{r.userLocation}</td>
                          <td style={{ padding: "8px 6px", fontSize: "13px", color: "var(--kf-text-secondary)" }}>{r.intendedUse}</td>
                          <td style={{ padding: "8px 6px", fontSize: "13px" }}>{r.supervisor}</td>
                          <td style={{ padding: "8px 6px", fontSize: "13px" }}>{r.currentKnifeType}</td>
                          <td style={{ padding: "8px 6px", fontSize: "13px", fontWeight: "500", color: colors.primary }}>{r.newKnifeType}</td>
                          <td style={{ padding: "8px 6px", textAlign: "center" }}>
                            <span style={{ 
                              padding: "4px 8px", 
                              borderRadius: 6, 
                              fontSize: "11px", 
                              fontWeight: "bold",
                              background: r.agreement === "Đồng ý" 
                                ? "var(--kf-badge-agree-bg)" 
                                : r.agreement === "Không đồng ý" 
                                  ? "var(--kf-badge-disagree-bg)" 
                                  : "var(--kf-badge-pending-bg)",
                              color: r.agreement === "Đồng ý" 
                                ? "var(--kf-badge-agree-text)" 
                                : r.agreement === "Không đồng ý" 
                                  ? "var(--kf-badge-disagree-text)" 
                                  : "var(--kf-badge-pending-text)"
                            }}>
                              {r.agreement || "Chờ duyệt"}
                            </span>
                          </td>
                          <td style={{ padding: "8px 6px", fontSize: "13px", color: "var(--kf-text-secondary)" }}>{r.note || "-"}</td>
                          <td style={{ padding: "8px 6px", textAlign: "center" }}>
                            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                              <button onClick={() => openRegModal(r)} style={{ border: "none", background: "transparent", cursor: "pointer", color: colors.primary }} title="Chỉnh sửa"><FaEdit /></button>
                              {isEhsOrAdmin && (
                                <button onClick={() => handleDeleteReg(r.id, r.employeeName)} style={{ border: "none", background: "transparent", cursor: "pointer", color: colors.error }} title="Xóa"><FaTrash /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: NHẬP/XUẤT EXCEL — chỉ admin & ehs */}
          {activeTab === "excel" && isEhsOrAdmin && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 }}>
                {/* Panel 1: Import */}
                <div style={{ background: "var(--kf-card-bg)", border: "1.5px solid var(--kf-card-border)", borderRadius: 16, padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
                  <h3 style={{ margin: 0, color: colors.primary, display: "flex", alignItems: "center", gap: 6 }}><FaUpload /> Nhập dữ liệu từ tệp Excel</h3>
                  <p style={{ margin: 0, fontSize: "13px", color: "var(--kf-text-secondary)", lineHeight: 1.4 }}>
                    Tải lên file Excel quản lý dao (`.xls` hoặc `.xlsx`) để đồng bộ nhanh danh sách dao master và các hồ sơ đánh giá Martor lên hệ thống.
                  </p>
                  
                  <div style={{ 
                    border: "2px dashed var(--kf-input-border)", 
                    borderRadius: 12, 
                    padding: "20px", 
                    textAlign: "center",
                    cursor: "pointer",
                    background: "var(--kf-grid-bg)"
                  }} onClick={() => document.getElementById("excel-knife-import").click()}>
                    <FaFileExcel style={{ fontSize: "36px", color: colors.secondary, marginBottom: 8 }} />
                    <div style={{ fontSize: "14px", fontWeight: "bold" }}>Chọn file để tải lên</div>
                    <div style={{ fontSize: "11px", color: "var(--kf-text-muted)", marginTop: 4 }}>Hỗ trợ định dạng .xls và .xlsx</div>
                    <input 
                      id="excel-knife-import"
                      type="file" 
                      accept=".xls,.xlsx" 
                      onChange={handleImportExcel} 
                      style={{ display: "none" }}
                    />
                  </div>
                </div>

                {/* Panel 2: Export */}
                <div style={{ background: "var(--kf-card-bg)", border: "1.5px solid var(--kf-card-border)", borderRadius: 16, padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
                  <h3 style={{ margin: 0, color: colors.primary, display: "flex", alignItems: "center", gap: 6 }}><FaDownload /> Xuất báo cáo dữ liệu Excel</h3>
                  <p style={{ margin: 0, fontSize: "13px", color: "var(--kf-text-secondary)", lineHeight: 1.4 }}>
                    Xuất và tải tệp báo cáo tổng hợp dao về máy. Tệp xuất ra sẽ giữ nguyên cấu trúc 3 sheet: Danh sách dao master, Thống kê số lượng và Đánh giá đăng ký dao Martor.
                  </p>
                  
                  <button 
                    onClick={handleExportExcel}
                    style={{ 
                      padding: "14px 20px",
                      // Nút Excel: gradient xanh lá theo token success, đầu cuối trộn đen 25% tạo chiều sâu
                      background: `linear-gradient(135deg, ${colors.success} 0%, color-mix(in srgb, ${colors.success}, #000 25%) 100%)`,
                      color: colors.white, 
                      border: "none", 
                      borderRadius: 12, 
                      fontWeight: "800", 
                      fontSize: "15px",
                      cursor: "pointer", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center",
                      gap: 8,
                      boxShadow: "0 4px 15px rgba(32,115,53,0.3)"
                    }}
                  >
                    <FaFileExcel /> Tải xuống file Excel báo cáo
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ============================================================= */}
      {/* MODAL: Đăng ký & Đánh giá sử dụng dao */}
      {/* ============================================================= */}
      {showRegModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1002 }}>
          <form onSubmit={handleSaveReg} style={{ background: "var(--kf-card-bg)", padding: 22, borderRadius: 12, width: "90%", maxWidth: 500, display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 4px 15px rgba(0,0,0,.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `2px solid ${colors.primaryLight}`, paddingBottom: 10 }}>
              <h3 style={{ margin: 0, color: colors.primary }}>{editingReg ? "Chỉnh sửa đăng ký" : "Đăng ký sử dụng dao mới"}</h3>
              <button type="button" onClick={() => setShowRegModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textSecondary }}>✕</button>
            </div>

            <div style={{ maxHeight: "400px", overflowY: "auto", paddingRight: 6, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontWeight: "600", fontSize: "13px" }}>Họ tên nhân viên *</label>
                  <input
                    type="text"
                    required
                    value={regForm.employeeName}
                    onChange={e => setRegForm({ ...regForm, employeeName: e.target.value })}
                    placeholder="Ví dụ: Trần Minh Tâm"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--kf-input-border)", background: "var(--kf-input-bg)", color: "var(--kf-input-text)", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontWeight: "600", fontSize: "13px" }}>Bộ phận</label>
                  <select
                    value={regForm.department}
                    onChange={e => setRegForm({ ...regForm, department: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--kf-input-border)", background: "var(--kf-input-bg)", color: "var(--kf-input-text)" }}
                  >
                    {DEPARTMENTS.map(d => (
                      <option key={d.code} value={d.code}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontWeight: "600", fontSize: "13px" }}>Vị trí làm việc *</label>
                  <input
                    type="text"
                    required
                    value={regForm.userLocation}
                    onChange={e => setRegForm({ ...regForm, userLocation: e.target.value })}
                    placeholder="Ví dụ: Vận hành máy sheet..."
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--kf-input-border)", background: "var(--kf-input-bg)", color: "var(--kf-input-text)", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontWeight: "600", fontSize: "13px" }}>Giám sát xác nhận</label>
                  <input
                    type="text"
                    value={regForm.supervisor}
                    onChange={e => setRegForm({ ...regForm, supervisor: e.target.value })}
                    placeholder="Ví dụ: Nguyễn Chí Long"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--kf-input-border)", background: "var(--kf-input-bg)", color: "var(--kf-input-text)", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 4, fontWeight: "600", fontSize: "13px" }}>Mục đích sử dụng</label>
                <input
                  type="text"
                  value={regForm.intendedUse}
                  onChange={e => setRegForm({ ...regForm, intendedUse: e.target.value })}
                  placeholder="Ví dụ: Cắt Prepreg, thùng carton..."
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--kf-input-border)", background: "var(--kf-input-bg)", color: "var(--kf-input-text)", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontWeight: "600", fontSize: "13px" }}>Loại dao đang dùng</label>
                  <select
                    value={isOtherValue(regForm.currentKnifeType, CURRENT_KNIFE_OPTIONS) ? "Khác" : regForm.currentKnifeType}
                    onChange={e => setRegForm({ ...regForm, currentKnifeType: e.target.value === "Khác" ? "" : e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--kf-input-border)", background: "var(--kf-input-bg)", color: "var(--kf-input-text)" }}
                  >
                    {CURRENT_KNIFE_OPTIONS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  {isOtherValue(regForm.currentKnifeType, CURRENT_KNIFE_OPTIONS) && (
                    <input
                      type="text"
                      value={regForm.currentKnifeType}
                      onChange={e => setRegForm({ ...regForm, currentKnifeType: e.target.value })}
                      placeholder="Nhập tên dao"
                      style={{ width: "100%", marginTop: 6, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--kf-input-border)", background: "var(--kf-input-bg)", color: "var(--kf-input-text)", boxSizing: "border-box" }}
                    />
                  )}
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontWeight: "600", fontSize: "13px" }}>Dao mới đề xuất</label>
                  <select
                    value={isOtherValue(regForm.newKnifeType, NEW_KNIFE_OPTIONS) ? "Khác" : regForm.newKnifeType}
                    onChange={e => setRegForm({ ...regForm, newKnifeType: e.target.value === "Khác" ? "" : e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--kf-input-border)", background: "var(--kf-input-bg)", color: "var(--kf-input-text)" }}
                  >
                    {NEW_KNIFE_OPTIONS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  {isOtherValue(regForm.newKnifeType, NEW_KNIFE_OPTIONS) && (
                    <input
                      type="text"
                      value={regForm.newKnifeType}
                      onChange={e => setRegForm({ ...regForm, newKnifeType: e.target.value })}
                      placeholder="Nhập tên dao"
                      style={{ width: "100%", marginTop: 6, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--kf-input-border)", background: "var(--kf-input-bg)", color: "var(--kf-input-text)", boxSizing: "border-box" }}
                    />
                  )}
                </div>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 4, fontWeight: "600", fontSize: "13px" }}>Hiện trạng sử dụng</label>
                <textarea
                  value={regForm.usageStatus}
                  onChange={e => setRegForm({ ...regForm, usageStatus: e.target.value })}
                  placeholder="Ví dụ: Thao tác bình thường, an toàn hơn dao hiện tại..."
                  rows={2}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--kf-input-border)", background: "var(--kf-input-bg)", color: "var(--kf-input-text)", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontWeight: "600", fontSize: "13px" }}>
                    {isEhsOrAdmin ? "EHS phê duyệt đăng ký" : "Trạng thái phê duyệt"}
                  </label>
                  {isEhsOrAdmin ? (
                    <select
                      value={regForm.agreement}
                      onChange={e => setRegForm({ ...regForm, agreement: e.target.value })}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--kf-input-border)", background: "var(--kf-input-bg)", color: "var(--kf-input-text)" }}
                    >
                      <option value="Chờ duyệt">Chờ duyệt</option>
                      <option value="Đồng ý">Đồng ý sử dụng</option>
                      <option value="Không đồng ý">Không đồng ý</option>
                    </select>
                  ) : (
                    <div style={{ 
                      width: "100%", 
                      padding: "8px 12px", 
                      borderRadius: 8, 
                      border: "1px solid var(--kf-input-border)", 
                      background: "var(--kf-grid-bg)", 
                      color: regForm.agreement === "Đồng ý" 
                        ? "var(--kf-badge-agree-text)" 
                        : regForm.agreement === "Không đồng ý" 
                          ? "var(--kf-badge-disagree-text)" 
                          : "var(--kf-badge-pending-text)", 
                      fontWeight: "bold",
                      fontSize: "13px",
                      boxSizing: "border-box"
                    }}>
                      {regForm.agreement || "Chờ duyệt"}
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontWeight: "600", fontSize: "13px" }}>Ghi chú khác</label>
                  <input
                    type="text"
                    value={regForm.note}
                    onChange={e => setRegForm({ ...regForm, note: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--kf-input-border)", background: "var(--kf-input-bg)", color: "var(--kf-input-text)", boxSizing: "border-box" }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 10 }}>
              <button type="button" onClick={() => setShowRegModal(false)} style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px solid var(--kf-card-border)", background: "transparent", cursor: "pointer", fontWeight: "bold" }}>Hủy</button>
              <button type="submit" style={{ padding: "8px 20px", background: colors.secondary, color: colors.white, border: "none", borderRadius: 8, fontWeight: "bold", cursor: "pointer" }}>OK</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
