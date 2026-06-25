import React, { useState, useEffect, useMemo } from "react";
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
// The adapter shims ignore this handle (the REST layer needs no db handle),
// but legacy call sites still pass `db` as the first arg, so define it once here.
const db = null;
const doc = (db, col, id) => ({ collection: col, id });
const collection = (db, col) => ({ collection: col });
const getDoc = async (docRef) => {
  try {
    const data = await dbService.getDoc(docRef.collection, docRef.id);
    return {
      exists() { return data && data._exists !== false; },
      data() { return data; }
    };
  } catch (err) {
    return {
      exists() { return false; },
      data() { return null; }
    };
  }
};
const setDoc = async (docRef, data) => {
  return await dbService.updateDoc(docRef.collection, docRef.id, data);
};
const deleteDoc = async (docRef) => {
  return await dbService.deleteDoc(docRef.collection, docRef.id);
};
const writeBatch = (db) => {
  const operations = [];
  return {
    set(docRef, data) {
      operations.push({
        path: `/api/db/${docRef.collection}/${docRef.id}`,
        method: "POST",
        body: data
      });
    },
    update(docRef, data) {
      operations.push({
        path: `/api/db/${docRef.collection}/${docRef.id}`,
        method: "PATCH",
        body: data
      });
    },
    delete(docRef) {
      operations.push({
        path: `/api/db/${docRef.collection}/${docRef.id}`,
        method: "DELETE"
      });
    },
    async commit() {
      await dbService.commitBatch(operations);
    }
  };
};
import { useI18n } from "../i18n/I18nProvider";
import { colors } from "../theme";
import { 
  FaSearch, FaPlus, FaFileExcel, FaDownload, FaUpload, 
  FaEdit, FaTrash, FaCheck, FaTimes, FaCamera, FaImage 
} from "react-icons/fa";
import { useConfirm } from "./LightboxSwipeOnly";
import imageCompression from "browser-image-compression";
import * as XLSX from "xlsx";

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
  { code: "QC", name: "QC" }
];

const TRAINING_ITEMS = {
  G_Cutting: [
    "Máy  Sheet 45°", "Máy  Sheet 90°", "Máy  Sheet 135°", "Xe Nâng  Prepreg", 
    "Máy  Shear", "Máy  Die Cut", "Splicing", "Máy  Inkjet", "Máy Ép  Hashima", 
    "Máy Hút  Chân Không", "Sử Dụng  Vật Sắc Nhọn", "Xử Lý Phân  Loại Rác Thải"
  ],
  G_Rolling: [
    "Bàn  Nhiệt", "Máy  CDI", "Máy  Revo", "Máy Auto  Rolling", "Máy Cello  Ngang", 
    "Máy  Cello Đứng", "Máy Rút  Dây Cello", "Máy Rút  Mandrel", "Máy Rửa  Mandrel", 
    "Máy Đo/Uốn  Thẳng Mandrel", "Lò  Sấy", "Máy  Khắc Laser", "Sử Dụng  Vật Sắc Nhọn", 
    "Xử Lý Phân  Loại Rác Thải"
  ],
  G_Finishing: [
    "Máy  Dual Saw", "Máy  Đo OD", "Máy Soi  Đầu TIP", "Máy Mài Đánh Bóng", "Auto  Sanding", 
    "Máy Rửa -  Sấy Tự Động", "Máy  Paragon", "Máy  Khắc Laser", "Máy  Frequency", 
    "Máy/Bảng Đo  Ortho Flex", "Sử Dụng  Vật Sắc Nhọn", "Xử Lý Phân  Loại Rác Thải"
  ],
  G_Buffing: [
    "Máy Rửa -  Sấy Tự Động", "Máy Bom  Áp Lực", "Máy Mài  Đánh Bóng", "Máy  Tip - Blast", 
    "Máy  Đánh Bóng", "Máy  Scrap Shaft", "Máy  Bắn Cát", "Máy  Đo OD", "Cân  Weight", 
    "Máy  Straightness", "Sử Dụng  Vật Sắc Nhọn", "Xử Lý Phân  Loại Rác Thải"
  ],
  G_Dipping: [
    "Máy  Lắc Sơn", "Máy/Kệ  Khuấy Sơn", "Máy Phun  Sơn Tự động", 
    "Máy Rửa Mắt Đứng/ Vòi Tắm Khẩn Cấp", "Máy Auto Dipping", "Lò  Sấy", 
    "Máy  Scrap Shaft", "Máy  Bắn Cát", "Sử Dụng  Vật Sắc Nhọn", "Xử Lý Phân  Loại Rác Thải"
  ],
  G_Graphics: [
    "Máy  Decal", "Máy  In Lụa", "Băng  Tải", "Lò  Sấy", "Thước  Đo Laser", 
    "Máy  Khắc Laser", "Máy  Đo OD", "Cân  Weight", "Máy  Straightness", 
    "Sử Dụng Vật  Sắc Nhọn", "Xử Lý Phân  Loại Rác Thải"
  ],
  A_Blank: [
    "Máy  CDI", "Máy  Revo", "Bàn  Nhiệt", "Máy Cello  Ngang", "Sử Dụng  Ống Tool", 
    "Lò  Sấy", "Lò sấy nhỏ", "Máy Rút  Dây Cello", "Máy Rút  Mandrel", 
    "Máy Đo/Uốn  Thẳng Mandrel", "Máy  Dual Saw", "Máy  Paragon", "Máy Mài  Đánh Bóng", 
    "Máy  Khắc Laser", "Máy Cắt  (Apple)", "Máy Đo Đầu Cong", "Máy Xác Định Điểm Cong", 
    "Sử Dụng  Vật Sắc Nhọn", "Xử Lý Phân  Loại Rác Thải"
  ],
  A_Graphics: [
    "Máy  Decal", "Máy  In Lụa", "Lò  Sấy", "Máy Cắt", "Máy Mài", 
    "Sử Dụng Vật  Sắc Nhọn", "Xử Lý Phân  Loại Rác Thải"
  ],
  Kayak: [
    "Máy  Sheet", "Máy  Shear", "Xe nâng  Prepreg", "Máy  Die Cut", "Máy ép Hashima", 
    "Máy  CDI", "Máy Cello  Ngang", "Lò  Sấy", "Máy Rút Mandrel", "Máy  Cắt Đầu", 
    "Máy  Cắt", "Máy Rút  Dây Cello", "Máy Paragon", "Máy Mài  Đánh Bóng", 
    "Máy  Mài", "Máy  Đánh Bóng", "Máy Phun  Sơn Tự động", "Sử Dụng  Vật Sắc Nhọn", 
    "Xử Lý Phân  Loại Rác Thải"
  ],
  QC: [
    "Máy Đo Độ Võng (SPINE)", "Máy Tìm  Điểm Cứng  (SPINE FINDER)", 
    "Máy Kiểm  Tra Độ Bền  (PROOF LOAD)", "Cân Weight  Đơn (CG)", 
    "Cân Weight  Tự Động (CG)", "Máy Đo  Độ Cong  (ZONE)", 
    "Máy  Soi Đầu  TIP - Apple", "Máy Đo  OD (Z-Mike)", "Máy Đo  Ortho Flex", 
    "Bảng Đo  Ortho Flex", "Máy Kiểm Tra  Giao Động  (FREQUENCY)", 
    "Máy Kiểm Tra  Độ Gãy  (BENDING TEST)", "Máy Kiểm Tra  Độ Xoắn  (TORQUE)", 
    "Máy  Auto Inspection  Golf Shaft", "Máy Đo  Độ Cong  3 Điểm", "Máy Cắt  Đầu Flex", 
    "Máy Đo  HST Flex", "Máy Kiểm Tra  Độ Bền Sơn", "Máy Kiểm Tra  Độ Bền Sơn  (RUBTEST)", 
    "Máy Kiểm Tra  Độ Bền Sơn  (FALLING SAND)", "Máy Đo  Mandrel", "Thước Đo Laser", 
    "Máy Đo OD KAYAK"
  ]
};

const CHART_COLORS = {
  G_Cutting: "#e056fd",
  G_Rolling: "#f0932b",
  G_Finishing: "#eb4d4b",
  G_Buffing: "#6ab04c",
  G_Dipping: "#00a8ff",
  G_Graphics: "#22a6b3",
  A_Blank: "#3f51b5",
  A_Graphics: "#be2edd",
  Kayak: "#607d8b"
};

const SVG_W = 800;
const SVG_H = 260;
const PAD_L = 50;
const PAD_R = 20;
const PAD_T = 20;
const PAD_B = 30;
const CHART_W = SVG_W - PAD_L - PAD_R;
const CHART_H = SVG_H - PAD_T - PAD_B;
const Y_MAX = 100;

const DEFAULT_QUESTIONS = [
  {
    question: "Quy trình chuẩn bị trước khi vận hành máy móc thiết bị là gì?",
    hint: "Kiểm tra nguồn điện, các nút dừng khẩn cấp, các bộ phận che chắn an toàn, và trang bị đầy đủ bảo hộ lao động cá nhân."
  },
  {
    question: "Nút dừng khẩn cấp (Emergency Stop) được sử dụng trong tình huống nào và cách thao tác?",
    hint: "Sử dụng khi xảy ra sự cố nghiêm trọng, kẹt máy, hoặc nguy cơ tai nạn lao động. Thao tác: ấn mạnh nút dừng khẩn cấp để tắt máy ngay lập tức."
  },
  {
    question: "Khi phát hiện máy móc có tiếng động lạ, rò rỉ điện hoặc chất lỏng, bạn cần làm gì?",
    hint: "Ngay lập tức tắt máy, ngắt nguồn năng lượng, treo biển cảnh báo đang sửa chữa và báo cáo ngay cho giám sát hoặc đội bảo trì."
  },
  {
    question: "Trang thiết bị bảo hộ cá nhân (PPE) nào là bắt buộc khi vận hành thiết bị tại vị trí này?",
    hint: "Kính bảo hộ an toàn, nút tai chống ồn, găng tay bảo hộ chống cắt và giày mũi sắt bảo hộ."
  },
  {
    question: "Quy trình vệ sinh thiết bị và bàn giao ca làm việc được thực hiện như thế nào?",
    hint: "Tắt máy và ngắt điện hoàn toàn. Dùng giẻ lau sạch bụi bẩn, dầu mỡ. Dọn dẹp khu vực xung quanh và ghi nhận tình trạng máy vào sổ bàn giao ca."
  }
];

const DEFAULT_POSITIONS = [
  "Vận hành máy cắt (Golf Cutting)",
  "Vận hành máy cán (Golf Rolling)",
  "Vận hành máy mài (Golf Buffing)",
  "Vận hành máy sơn (Golf Dipping)",
  "Kiểm tra chất lượng (QC)",
  "Vận hành máy Arrow Blank",
  "Vận hành máy Kayak",
  "Vị trí chung"
];

export default function License({ user, isMobile }) {
  const { t } = useI18n();
  const { askConfirm } = useConfirm();

  const [records, setRecords] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchText, setSearchText] = useState("");
  const [filterDept, setFilterDept] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterReason, setFilterReason] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [modalForm, setModalForm] = useState({
    msnv: "",
    name: "",
    role: "",
    position: "",
    deptCode: "G_Cutting",
    evalDate: "",
    status: "Đủ điều kiện",
    reason: "",
    targetDate: "",
    trainingItems: {}
  });

  // Photo state inside modal
  const [uploadProgress, setUploadProgress] = useState(0);
  const [compressing, setCompressing] = useState(false);
  const [tempFileUrl, setTempFileUrl] = useState("");

  const userRolesList = user?.role ? (Array.isArray(user.role) ? user.role.map(r => String(r).toLowerCase()) : String(user.role).split(",").map(r => r.trim().toLowerCase())) : [];
  const isAdmin = userRolesList.some(r => r === "admin" || r === "ehs");
  const isPrivileged = userRolesList.some(r => r === "admin" || r === "ehs" || r === "manager");
  const isEvaluator = userRolesList.some(r => r === "admin" || r === "ehs");

  // State for Question Bank Modal
  const [showQuestionsModal, setShowQuestionsModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState("");
  const [questionsList, setQuestionsList] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // State for Evaluation Quiz Wizard
  const [showEvalWizard, setShowEvalWizard] = useState(false);
  const [evalCandidate, setEvalCandidate] = useState(null);
  const [wizardQuestions, setWizardQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answersMap, setAnswersMap] = useState({});
  const [evalComment, setEvalComment] = useState("");
  const [trainerName, setTrainerName] = useState("");
  const [workingShift, setWorkingShift] = useState("");

  const addDays = (dateStr, days) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const fetchRecords = async () => {
    try {
      const snap = await dbService.getDocs("operation_certifications");
      setRecords(Array.isArray(snap) ? snap : []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCharts = async () => {
    try {
      const snap = await dbService.getDocs("operation_certifications_chart");
      const list = Array.isArray(snap) ? snap : [];
      list.sort((a, b) => a.week.localeCompare(b.week));
      setChartData(list);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    globalRefreshCallback = () => {
      fetchRecords();
      fetchCharts();
    };
    return () => {
      globalRefreshCallback = null;
    };
  }, []);

  // Fetch data via Polling
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchRecords(), fetchCharts()]).finally(() => setLoading(false));

    const unsubRecords = realtimeService.subscribeToPath("operation_certifications", () => { fetchRecords(); });
    const unsubCharts = realtimeService.subscribeToPath("operation_certifications_chart", () => { fetchCharts(); });

    const intervalRecords = setInterval(fetchRecords, 30000);
    const intervalCharts = setInterval(fetchCharts, 30000);
    return () => {
      unsubRecords();
      unsubCharts();
      clearInterval(intervalRecords);
      clearInterval(intervalCharts);
    };
  }, []);

  const allPositions = useMemo(() => {
    const set = new Set(DEFAULT_POSITIONS);
    records.forEach(r => {
      if (r.position) set.add(r.position.trim());
      if (r.role) set.add(r.role.trim());
    });
    return Array.from(set).filter(Boolean).sort();
  }, [records]);

  // Aggregate stats dynamically for Tables 1 and 2
  const computedStats = useMemo(() => {
    return DEPARTMENTS.map(dept => {
      const deptRecords = records.filter(r => r.deptCode === dept.code);
      const totalStaff = deptRecords.length;
      const totalItems = TRAINING_ITEMS[dept.code]?.length || 0;
      const qualified = deptRecords.filter(r => r.status === "Đủ điều kiện").length;
      const lacking = deptRecords.filter(r => r.status === "Thiếu chứng nhận").length;
      const complianceRate = totalStaff > 0 ? Math.round((qualified / totalStaff) * 100) : 100;

      // Table 2 stats
      const notTrained = deptRecords.filter(r => r.status === "Thiếu chứng nhận" && (!r.reason || r.reason === "CHƯA ĐÀO TẠO")).length;
      const inTraining = deptRecords.filter(r => r.status === "Thiếu chứng nhận" && r.reason === "ĐANG ĐÀO TẠO").length;
      const waitingEval = deptRecords.filter(r => r.status === "Thiếu chứng nhận" && r.reason === "CHỜ ĐÁNH GIÁ").length;
      const waitingCard = deptRecords.filter(r => r.status === "Thiếu chứng nhận" && r.reason === "CHỜ CẤP THẺ CNVH").length;
      const reEval = deptRecords.filter(r => r.status === "Thiếu chứng nhận" && r.reason === "ĐÁNH GIÁ LẠI").length;

      return {
        ...dept,
        totalItems,
        totalStaff,
        qualified,
        lacking,
        complianceRate,
        notTrained,
        inTraining,
        waitingEval,
        waitingCard,
        reEval
      };
    });
  }, [records]);

  // Filters logic
  const filteredRecords = useMemo(() => {
    let list = [...records];
    if (searchText) {
      const st = searchText.toLowerCase().trim();
      list = list.filter(r => 
        (r.name || "").toLowerCase().includes(st) || 
        (r.msnv || "").toLowerCase().includes(st)
      );
    }
    if (filterDept !== "all") {
      list = list.filter(r => r.deptCode === filterDept);
    }
    if (filterStatus !== "all") {
      list = list.filter(r => r.status === filterStatus);
    }
    if (filterReason !== "all") {
      if (filterReason === "CHƯA ĐÀO TẠO") {
        list = list.filter(r => r.status === "Thiếu chứng nhận" && (!r.reason || r.reason === "CHƯA ĐÀO TẠO"));
      } else {
        list = list.filter(r => r.status === "Thiếu chứng nhận" && r.reason === filterReason);
      }
    }
    return list;
  }, [records, searchText, filterDept, filterStatus, filterReason]);

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(start, start + itemsPerPage);
  }, [filteredRecords, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, filterDept, filterStatus, filterReason]);

  // Automatic scheduling of evaluation alerts (7 days training timeout / 1 year recertification)
  useEffect(() => {
    if (loading || records.length === 0 || !user) return;

    const isEhsOrAdmin = userRolesList.some(r => r === "admin" || r === "ehs");
    if (!isEhsOrAdmin) return;

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayMs = new Date(todayStr).getTime();
    const batch = writeBatch(db);
    let hasUpdates = false;

    records.forEach(r => {
      // 1. Check if trainee completed 7 days of training
      if (r.status === "Thiếu chứng nhận" && r.reason === "ĐANG ĐÀO TẠO" && r.evalDate) {
        const startDateMs = new Date(r.evalDate).getTime();
        const diffDays = (todayMs - startDateMs) / (1000 * 60 * 60 * 24);
        if (diffDays >= 7 && !r.evalRequestedNotifSent) {
          const notifId = `eval-req-${r.deptCode}-${r.msnv}-${Date.now()}`;
          const notifRef = doc(db, "notifications", notifId);
          batch.set(notifRef, {
            type: "operation_cert_eval",
            message: `Nhân viên ${r.name} (${r.msnv}) đã hoàn thành 7 ngày đào tạo tại bộ phận ${r.department || r.deptCode}. Yêu cầu EHS tiến hành đánh giá.`,
            targetRole: "ehs",
            createdBy: "system",
            readBy: [],
            relatedId: notifId,
            timestamp: Date.now()
          });

          const recordRef = doc(db, "operation_certifications", `${r.deptCode}_${r.msnv}`);
          batch.update(recordRef, {
            reason: "CHỜ ĐÁNH GIÁ",
            evalRequestedNotifSent: true
          });
          hasUpdates = true;
        }
      }

      // 2. Check if recertification is due (1 year since evaluation completion)
      if (r.status === "Đủ điều kiện" && r.evalDate) {
        const completedDateMs = new Date(r.evalDate).getTime();
        const diffDays = (todayMs - completedDateMs) / (1000 * 60 * 60 * 24);
        if (diffDays >= 365 && !r.reEvalRequestedNotifSent) {
          const notifId = `reeval-req-${r.deptCode}-${r.msnv}-${Date.now()}`;
          const notifRef = doc(db, "notifications", notifId);
          batch.set(notifRef, {
            type: "operation_cert_eval",
            message: `Hồ sơ chứng nhận vận hành của ${r.name} (${r.msnv}) đã hết hạn 1 năm. Yêu cầu EHS tiến hành tái đánh giá.`,
            targetRole: "ehs",
            createdBy: "system",
            readBy: [],
            relatedId: notifId,
            timestamp: Date.now()
          });

          const recordRef = doc(db, "operation_certifications", `${r.deptCode}_${r.msnv}`);
          batch.update(recordRef, {
            status: "Thiếu chứng nhận",
            reason: "ĐÁNH GIÁ LẠI",
            reEvalRequestedNotifSent: true,
            evalRequestedNotifSent: false // reset for new cycle
          });
          hasUpdates = true;
        }
      }
    });

    if (hasUpdates) {
      batch.commit().catch(e => console.error("Lỗi tự động gửi thông báo lịch đánh giá:", e));
    }
  }, [records, loading, user, userRolesList]);

  // Chart hover state
  const [hoveredBar, setHoveredBar] = useState(null);

  const openModal = (record = null) => {
    setUploadProgress(0);
    setCompressing(false);
    
    if (record) {
      setEditingRecord(record);
      setTempFileUrl(record.certificateCardUrl || "");
      setModalForm({
        msnv: record.msnv || "",
        name: record.name || "",
        role: record.role || "",
        position: record.position || "",
        deptCode: record.deptCode || "G_Cutting",
        evalDate: record.evalDate || "",
        status: record.status || "Đủ điều kiện",
        reason: record.reason || "",
        targetDate: record.targetDate || "",
        trainingItems: record.trainingItems || {}
      });
    } else {
      setEditingRecord(null);
      setTempFileUrl("");
      
      const todayStr = new Date().toISOString().slice(0, 10);
      const initialStatus = isPrivileged ? "Đủ điều kiện" : "Thiếu chứng nhận";
      const initialReason = isPrivileged ? "" : "ĐANG ĐÀO TẠO";
      const initialTargetDate = isPrivileged ? "" : addDays(todayStr, 7);
      
      setModalForm({
        msnv: "",
        name: "",
        role: "",
        position: "",
        deptCode: "G_Cutting",
        evalDate: todayStr,
        status: initialStatus,
        reason: initialReason,
        targetDate: initialTargetDate,
        trainingItems: {}
      });
    }
    setShowModal(true);
  };

  const handleEvalDateChange = (e) => {
    const val = e.target.value;
    setModalForm(prev => {
      const updated = { ...prev, evalDate: val };
      if (!isPrivileged && !editingRecord) {
        updated.targetDate = addDays(val, 7);
      }
      return updated;
    });
  };

  // Question Bank Modal
  const openQuestionBankModal = () => {
    const set = new Set(DEFAULT_POSITIONS);
    records.forEach(r => {
      if (r.position) set.add(r.position.trim());
      if (r.role) set.add(r.role.trim());
    });
    const positionsList = Array.from(set).filter(Boolean).sort();
    setSelectedPosition(positionsList[0] || "Vị trí chung");
    setShowQuestionsModal(true);
  };

  // Load questions for position
  useEffect(() => {
    if (!showQuestionsModal || !selectedPosition) return;
    
    setLoadingQuestions(true);
    const docRef = doc(db, "operation_certification_questions", selectedPosition);
    getDoc(docRef).then(snap => {
      if (snap.exists()) {
        setQuestionsList(snap.data().questions || []);
      } else {
        setQuestionsList(DEFAULT_QUESTIONS);
      }
      setLoadingQuestions(false);
    }).catch(err => {
      console.error(err);
      setQuestionsList(DEFAULT_QUESTIONS);
      setLoadingQuestions(false);
    });
  }, [selectedPosition, showQuestionsModal]);

  const handleSaveQuestionBank = async () => {
    if (!selectedPosition) return;
    try {
      const docRef = doc(db, "operation_certification_questions", selectedPosition);
      await setDoc(docRef, {
        position: selectedPosition,
        questions: questionsList,
        updatedAt: new Date().toISOString()
      });
      alert("Đã lưu bộ câu hỏi cho vị trí: " + selectedPosition);
      setShowQuestionsModal(false);
    } catch (err) {
      console.error(err);
      alert("Lưu thất bại: " + err.message);
    }
  };

  // EHS Quiz Wizard
  const startEvaluation = async (candidate) => {
    setEvalCandidate(candidate);
    setCurrentQuestionIndex(0);
    setAnswersMap({});
    setEvalComment("");
    setTrainerName(user.name || "");
    setWorkingShift(candidate.role || "");
    setShowEvalWizard(true);

    const pos = candidate.position || candidate.role || "Vị trí chung";
    const docRef = doc(db, "operation_certification_questions", pos);
    try {
      const snap = await getDoc(docRef);
      if (snap.exists() && snap.data().questions?.length > 0) {
        setWizardQuestions(snap.data().questions);
      } else {
        setWizardQuestions(DEFAULT_QUESTIONS);
      }
    } catch (e) {
      console.error("Lỗi tải câu hỏi đánh giá:", e);
      setWizardQuestions(DEFAULT_QUESTIONS);
    }
  };

  const handleCompleteEvaluation = async () => {
    let overallPassed = true;
    wizardQuestions.forEach((q, idx) => {
      if (answersMap[idx] !== "Đạt") {
        overallPassed = false;
      }
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    const updatedStatus = overallPassed ? "Đủ điều kiện" : "Thiếu chứng nhận";
    const updatedReason = overallPassed ? "" : "CHƯA ĐÀO TẠO";
    
    const candidateId = `${evalCandidate.deptCode}_${evalCandidate.msnv}`;
    
    const updatedRecord = {
      ...evalCandidate,
      status: updatedStatus,
      reason: updatedReason,
      evalDate: todayStr,
      evalComment: evalComment || "Đã hoàn thành đánh giá.",
      trainerName: trainerName || user.name || "",
      workingShift: workingShift || evalCandidate.role || "",
      evalScores: wizardQuestions.map((q, idx) => ({
        question: q.question,
        result: answersMap[idx] || "Không đạt"
      })),
      evalRequestedNotifSent: false,
      reEvalRequestedNotifSent: false,
      updatedBy: user.name || user.email,
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "operation_certifications", candidateId), updatedRecord);
      alert(`Đánh giá hoàn tất! Kết quả: ${overallPassed ? "ĐẠT" : "KHÔNG ĐẠT"}`);
      
      if (window.confirm("Bạn có muốn xuất và tải biểu mẫu đánh giá (.doc) về máy ngay bây giờ không?")) {
        exportWordDoc(updatedRecord);
      }
      
      setShowEvalWizard(false);
    } catch (e) {
      console.error(e);
      alert("Lưu kết quả đánh giá thất bại.");
    }
  };

  const exportWordDoc = async (record) => {
    try {
      const response = await fetch("/templates/022-3 - Huấn luyện vận hành & đánh giá kết quả.doc", { cache: "no-store" });
      if (!response.ok) throw new Error("Không thể tải tệp mẫu .doc");
      
      const arrayBuffer = await response.arrayBuffer();
      const buf = new Uint8Array(arrayBuffer);

      const deptName = record.department || record.deptCode || "";
      const dateRaw = record.evalDate || new Date().toISOString().slice(0, 10);
      const parts = dateRaw.split("-");
      const dateStr = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateRaw;

      const empName = record.name || "";
      const msnv = record.msnv || "";
      const position = record.position || record.role || "";
      const shift = record.workingShift || record.role || "";
      const workingPosition = record.position || "";
      const trainer = record.trainerName || "";
      const passed = record.status === "Đủ điều kiện";

      const q1 = record.evalScores?.[0]?.question || "Sử dụng đúng các bảo hộ lao động yêu cầu.";
      const q2 = record.evalScores?.[1]?.question || "Thực hiện kiểm tra ngoại quan, các bất thường của máy...";
      const q3 = record.evalScores?.[2]?.question || "Kỹ năng thao tác máy theo đúng hướng dẫn trên SOP.";
      const q4 = record.evalScores?.[3]?.question || "Kỹ năng xử lý tình huống khi bất ngờ xảy ra sự cố...";
      const q5 = record.evalScores?.[4]?.question || "Biết cách xử lý sự cố, liên lạc khẩn cấp...";

      const commentText = record.evalComment || "Đã hoàn thành đánh giá.";

      const deptTarget = "BỘ PHẬN (DEPARTMENT): _____________________\r\u0007\u0007\t\t\t\t\t\t\t\t\rNgày (Date):    ";
      const deptPart = ("BỘ PHẬN (DEPARTMENT): " + deptName);
      const datePart = ("Ngày (Date): " + dateStr);
      const deptRepl = (deptPart.padEnd(43, " ") + "\r\u0007\u0007\t\t\t\t\t\t\t\t\r" + datePart).slice(0, deptTarget.length).padEnd(deptTarget.length, " ");

      const empTarget = "Nhân viên (Employee):" + " ".repeat(68) + "MSNV (Employee Code):" + " ".repeat(3);
      const empPart = ("Nhân viên (Employee): " + empName);
      const msnvPart = ("MSNV (Employee Code): " + msnv);
      const empRepl = (empPart.padEnd(80, " ") + msnvPart).slice(0, empTarget.length).padEnd(empTarget.length, " ");

      const posTarget = "Chức vụ (Position):" + " ".repeat(73) + "Ca làm việc (Working shift): \r";
      const posPart = ("Chức vụ (Position): " + position);
      const shiftPart = ("Ca làm việc (Working shift): " + shift);
      const posRepl = (posPart.padEnd(92, " ") + shiftPart).slice(0, posTarget.length - 1).padEnd(posTarget.length - 1, " ") + "\r";

      const wposTarget = "Vị trí làm việc (working position):" + " ".repeat(50) + "Người hướng dẫn (Trainer): \u0007\u0007  \r";
      const wposPart = ("Vị trí làm việc (working position): " + workingPosition);
      const trainerPart = ("Người hướng dẫn (Trainer): " + trainer);
      const wposRepl = (wposPart.padEnd(85, " ") + trainerPart).slice(0, wposTarget.length - 5).padEnd(wposTarget.length - 5, " ") + "\u0007\u0007  \r";

      const resultTarget = "\r\nKết quả\r\r\uF0A8Đạt (Passed)\r\uF0A8Không đạt (Failed)";
      const resultRepl = passed 
        ? "\r\nKết quả\r\r\uF0FEĐạt (Passed)\r\uF0A8Không đạt (Failed)"
        : "\r\nKết quả\r\r\uF0A8Đạt (Passed)\r\uF0FEKhông đạt (Failed)";
      
      const resultTarget2 = "\rKết quả\r\r\uF0A8Đạt (Passed)\r\uF0A8Không đạt (Failed)";
      const resultRepl2 = passed 
        ? "\rKết quả\r\r\uF0FEĐạt (Passed)\r\uF0A8Không đạt (Failed)"
        : "\rKết quả\r\r\uF0A8Đạt (Passed)\r\uF0FEKhông đạt (Failed)";

      const q1Target = "Sử dụng đúng các bảo hộ lao động yêu cầu.";
      const q1Repl = q1.slice(0, q1Target.length).padEnd(q1Target.length, " ");

      const q2Target = "Thực hiện kiểm tra ngoại quan, các bất thường của máy, nguồn điện, nguồn nhiệt, khí nén, dừng khẩn cấp, dây nối đất, sensor, cover, khóa Interlock (nếu có).";
      const q2Repl = q2.slice(0, q2Target.length).padEnd(q2Target.length, " ");

      const q3Target = "Kỹ năng thao tác máy theo đúng hướng dẫn trên SOP.";
      const q3Repl = q3.slice(0, q3Target.length).padEnd(q3Target.length, " ");

      const q4Target = "Kỹ năng xử lý tình huống khi bất ngờ xảy ra sự cố máy móc trong lúc vận hành.";
      const q4Repl = q4.slice(0, q4Target.length).padEnd(q4Target.length, " ");

      const q5Target = "Biết cách xử lý sự cố, liên lạc khẩn cấp khi không thông báo trực tiếp được với quản lý bộ phận.";
      const q5Repl = q5.slice(0, q5Target.length).padEnd(q5Target.length, " ");

      function stringToBytes(s) {
        const arr = new Uint8Array(s.length * 2);
        for (let i = 0; i < s.length; i++) {
          const code = s.charCodeAt(i);
          arr[i * 2] = code & 0xff;
          arr[i * 2 + 1] = (code >> 8) & 0xff;
        }
        return arr;
      }

      function performReplace(targetStr, replStr) {
        const targetB = stringToBytes(targetStr);
        const replB = stringToBytes(replStr);
        if (targetB.length !== replB.length) return 0;
        
        let count = 0;
        for (let i = 0; i <= buf.length - targetB.length; i++) {
          let match = true;
          for (let j = 0; j < targetB.length; j++) {
            if (buf[i + j] !== targetB[j]) {
              match = false;
              break;
            }
          }
          if (match) {
            buf.set(replB, i);
            count++;
            i += targetB.length - 1;
          }
        }
        return count;
      }

      performReplace(deptTarget, deptRepl);
      performReplace(empTarget, empRepl);
      performReplace(posTarget, posRepl);
      performReplace(wposTarget, wposRepl);
      performReplace(resultTarget, resultRepl);
      performReplace(resultTarget2, resultRepl2);
      performReplace(q1Target, q1Repl);
      performReplace(q2Target, q2Repl);
      performReplace(q3Target, q3Repl);
      performReplace(q4Target, q4Repl);
      performReplace(q5Target, q5Repl);

      let utf16Str = '';
      for (let i = 0; i < buf.length - 1; i += 2) {
        utf16Str += String.fromCharCode(buf[i] | (buf[i + 1] << 8));
      }
      
      const commentMarker = "Nhận xét của người đánh giá trực tiếp (Evaluator’s Comments):";
      const markerIdx = utf16Str.indexOf(commentMarker);
      if (markerIdx !== -1) {
        const dynamicCommentsTarget = utf16Str.slice(markerIdx + commentMarker.length, markerIdx + commentMarker.length + 103);
        const line1 = commentText.slice(0, 50);
        const line2 = commentText.slice(50, 100);
        const commentsRepl = ("\r" + line1.padEnd(50, " ") + "\r" + line2.padEnd(50, " ") + "\r").slice(0, 103);
        performReplace(dynamicCommentsTarget, commentsRepl);
      }

      const { saveAs } = await import("file-saver");
      const fileBlob = new Blob([buf], { type: "application/msword" });
      saveAs(fileBlob, `022-3_Danh_gia_CNVH_${msnv}_${empName.replace(/\s+/g, "_")}.doc`);
    } catch (e) {
      console.error(e);
      alert("Xuất biểu mẫu Word thất bại: " + e.message);
    }
  };

  // Change department in Modal -> Reset equipment list
  const handleModalDeptChange = (e) => {
    const code = e.target.value;
    setModalForm(prev => ({
      ...prev,
      deptCode: code,
      trainingItems: {}
    }));
  };

  // Switch training item check state
  const toggleTrainingItem = (item) => {
    setModalForm(prev => ({
      ...prev,
      trainingItems: {
        ...prev.trainingItems,
        [item]: !prev.trainingItems[item]
      }
    }));
  };

  // Upload image card
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setCompressing(true);
    try {
      const options = {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1200,
        useWebWorker: true
      };
      const compressed = await imageCompression(file, options);
      setCompressing(false);

      const fileName = `license_${modalForm.deptCode}_${modalForm.msnv || Date.now()}_card.jpg`;
      const formData = new FormData();
      formData.append("file", compressed, fileName);
      setUploadProgress(10);

      const res = await apiClient.post("/api/storage/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (evt) => {
          const progress = Math.round((evt.loaded * 100) / evt.total);
          setUploadProgress(progress);
        }
      });
      setTempFileUrl(res.data.url);
      setUploadProgress(0);
    } catch (err) {
      console.error(err);
      setCompressing(false);
      alert("Tải ảnh thất bại.");
      setUploadProgress(0);
    }
  };

  const deleteTempPhoto = async () => {
    if (!tempFileUrl) return;
    try {
      const filename = tempFileUrl.substring(tempFileUrl.lastIndexOf('/') + 1);
      await apiClient.delete(`/api/storage/${filename}`);
    } catch (e) {
      console.warn("Lỗi xóa ảnh cũ trên Storage:", e);
    }
    setTempFileUrl("");
  };

  // Save record
  const handleSave = async (e) => {
    e.preventDefault();
    if (!modalForm.msnv || !modalForm.name) {
      alert("Vui lòng điền mã nhân viên và họ tên!");
      return;
    }

    const docId = `${modalForm.deptCode}_${modalForm.msnv}`;
    const newRecord = {
      ...modalForm,
      certificateCardUrl: tempFileUrl,
      updatedBy: user.name || user.email,
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "operation_certifications", docId), newRecord);
      alert(t("license.alert.saveSuccess"));
      setShowModal(false);
    } catch (err) {
      console.error("Lỗi lưu:", err);
      alert("Lưu dữ liệu thất bại.");
    }
  };

  // Delete record
  const handleDelete = async (record) => {
    if (!(await askConfirm(
      t("license.alert.deleteConfirm").replace("{name}", record.name),
      "Xác nhận xóa hồ sơ"
    ))) return;

    try {
      if (record.certificateCardUrl) {
        try {
          const filename = record.certificateCardUrl.substring(record.certificateCardUrl.lastIndexOf('/') + 1);
          await apiClient.delete(`/api/storage/${filename}`);
        } catch (e) {
          console.warn("Lỗi xóa ảnh chứng chỉ:", e);
        }
      }
      const docId = `${record.deptCode}_${record.msnv}`;
      await deleteDoc(doc(null, "operation_certifications", docId));
      alert("Đã xóa chứng nhận thành công!");
    } catch (err) {
      console.error(err);
      alert("Xóa thất bại.");
    }
  };

  // Import from Excel
  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const detailSheets = [
          "G_Cutting", "G_Rolling", "G_Finishing", "G_Buffing", "G_Dipping", "G_Graphics",
          "A_Blank", "A_Graphics", "Kayak", "QC"
        ];

        const batch = writeBatch(db);
        let count = 0;

        for (const sheetName of detailSheets) {
          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) continue;

          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          if (rows.length <= 6) continue;

          const headerRow = rows[4] || [];
          const subHeaderRow = rows[5] || [];

          let msnvIndex = 1;
          let nameIndex = 2;
          let roleIndex = 3;
          let positionIndex = -1;
          let evalDateIndex = -1;

          for (let c = 0; c < headerRow.length; c++) {
            const val = String(headerRow[c] || "").toUpperCase().trim().replace(/\r?\n/g, " ");
            if (val === "MSNV") {
              msnvIndex = c;
            } else if (val === "HỌ TÊN" || val === "HO TEN") {
              nameIndex = c;
            } else if (val === "CHỨC VỤ" || val === "CHUC VU") {
              roleIndex = c;
            } else if (val.includes("VỊ TRÍ") && val.includes("CÔNG VIỆC")) {
              positionIndex = c;
            } else if (val.includes("NGÀY") && val.includes("ĐÁNH GIÁ")) {
              evalDateIndex = c;
            }
          }

          const statusColIndex = subHeaderRow.indexOf("HIỆN TRẠNG");
          const reasonColIndex = subHeaderRow.indexOf("LÝ DO");
          const targetDateColIndex = subHeaderRow.indexOf("NGÀY DỰ KIẾN \r\nHOÀN THÀNH") !== -1 
            ? subHeaderRow.indexOf("NGÀY DỰ KIẾN \r\nHOÀN THÀNH")
            : subHeaderRow.indexOf("NGÀY DỰ KIẾN HOÀN THÀNH");

          if (statusColIndex === -1 || evalDateIndex === -1) continue;

          const trainingStartCol = evalDateIndex + 1;
          const trainingItems = [];
          for (let c = trainingStartCol; c < statusColIndex; c++) {
            if (subHeaderRow[c]) {
              trainingItems.push({
                index: c,
                name: subHeaderRow[c].trim().replace(/\r?\n/g, " ")
              });
            }
          }

          for (let r = 6; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length === 0 || row[msnvIndex] === undefined || row[msnvIndex] === null || row[msnvIndex] === "") continue;

            const msnv = String(row[msnvIndex]).trim();
            const name = String(row[nameIndex] || "").trim();
            const role = (roleIndex !== -1 && row[roleIndex]) ? String(row[roleIndex]).trim() : "";
            const position = (positionIndex !== -1 && row[positionIndex]) ? String(row[positionIndex]).trim() : "";
            
            let evalDate = "";
            const rawEvalDate = row[evalDateIndex];
            if (typeof rawEvalDate === "number") {
              const dt = new Date((rawEvalDate - 25569) * 86400 * 1000);
              evalDate = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
            } else if (rawEvalDate !== undefined && rawEvalDate !== null) {
              evalDate = String(rawEvalDate).trim();
            }

            const status = (statusColIndex !== -1 && row[statusColIndex]) ? String(row[statusColIndex]).trim() : "Thiếu chứng nhận";
            const reason = (reasonColIndex !== -1 && row[reasonColIndex]) ? String(row[reasonColIndex]).trim() : "";

            let targetDate = "";
            if (targetDateColIndex !== -1 && row[targetDateColIndex]) {
              const td = row[targetDateColIndex];
              if (typeof td === "number") {
                const dt = new Date((td - 25569) * 86400 * 1000);
                targetDate = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
              } else {
                targetDate = String(td).trim();
              }
            }

            const itemStatus = {};
            trainingItems.forEach(item => {
              const val = row[item.index];
              itemStatus[item.name] = (val === true || val === 1 || String(val).toUpperCase() === "X" || String(val).toUpperCase() === "TRUE");
            });

            const docId = `${sheetName}_${msnv}`;
            const ref = doc(db, "operation_certifications", docId);
            batch.set(ref, {
              msnv,
              name,
              role,
              position,
              deptCode: sheetName,
              department: DEPARTMENTS.find(d => d.code === sheetName)?.name || sheetName,
              evalDate,
              status,
              reason,
              targetDate,
              trainingItems: itemStatus,
              updatedBy: user.name || user.email,
              updatedAt: new Date().toISOString()
            });
            count++;
          }
        }

        // Also check if Data sheet exists to load chart data
        const dataSheet = workbook.Sheets["Data"];
        if (dataSheet) {
          const chartRows = XLSX.utils.sheet_to_json(dataSheet, { header: 1 });
          for (let r = 1; r < chartRows.length; r++) {
            const row = chartRows[r];
            if (!row || row[12] === undefined || row[12] === null || row[12] === "") continue;

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

            const chartRef = doc(db, "operation_certifications_chart", week);
            batch.set(chartRef, dataObj);
          }
        }

        await batch.commit();
        alert(t("license.alert.importSuccess").replace("{count}", count));
      } catch (err) {
        console.error(err);
        alert(t("license.alert.importError").replace("{error}", err.message));
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  // Export report
  const handleExportExcel = async () => {
    try {
      const [{ default: ExcelJS }, { saveAs }] = await Promise.all([
        import("exceljs"),
        import("file-saver")
      ]);

      const response = await fetch("/templates/CNVH.xlsx", { cache: "no-store" });
      if (!response.ok) throw new Error("Không thể tải tệp mẫu CNVH.xlsx");
      const buffer = await response.arrayBuffer();

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);

      // Data sheet contains dynamic formulas that Excel computes automatically when opened.
      // Modifying these cells manually breaks shared formulas and corrupts the sheet.

      // 2. Write details sheets
      const detailSheets = [
        "G_Cutting", "G_Rolling", "G_Finishing", "G_Buffing", "G_Dipping", "G_Graphics",
        "A_Blank", "A_Graphics", "Kayak", "QC"
      ];

      for (const sheetName of detailSheets) {
        const ws = wb.getWorksheet(sheetName);
        if (!ws) continue;

        // Fetch records for this sheet
        const sheetRecords = records.filter(r => r.deptCode === sheetName);
        if (sheetRecords.length === 0) continue;

        const subHeaderRow = ws.getRow(6);
        const statusColIndex = subHeaderRow.values.indexOf("HIỆN TRẠNG");
        const reasonColIndex = subHeaderRow.values.indexOf("LÝ DO");
        const targetDateColIndex = subHeaderRow.values.indexOf("NGÀY DỰ KIẾN \r\nHOÀN THÀNH") !== -1 
          ? subHeaderRow.values.indexOf("NGÀY DỰ KIẾN \r\nHOÀN THÀNH")
          : subHeaderRow.values.indexOf("NGÀY DỰ KIẾN HOÀN THÀNH");

        // Determine dynamic columns
        let evalDateIndex = -1;
        const headerRow = ws.getRow(5);
        for (let c = 1; c <= headerRow.cellCount; c++) {
          const val = String(headerRow.getCell(c).value || "").toUpperCase();
          if (val.includes("NGÀY") && val.includes("ĐÁNH GIÁ")) {
            evalDateIndex = c;
            break;
          }
        }

        if (statusColIndex === -1 || evalDateIndex === -1) continue;

        const trainingStartCol = evalDateIndex + 1;
        const trainingItems = [];
        for (let c = trainingStartCol; c < statusColIndex; c++) {
          const val = subHeaderRow.getCell(c).value;
          if (val) {
            trainingItems.push({
              index: c,
              name: String(val).trim().replace(/\r?\n/g, " ")
            });
          }
        }

        // Clear default rows (from row 7 onwards) - only clear raw input cells to preserve formulas
        let rowCount = ws.actualRowCount;
        for (let r = 7; r <= rowCount + 10; r++) {
          const rowObj = ws.getRow(r);
          for (let c = 2; c < statusColIndex; c++) {
            rowObj.getCell(c).value = null;
          }
          if (reasonColIndex !== -1) rowObj.getCell(reasonColIndex).value = null;
          if (targetDateColIndex !== -1) rowObj.getCell(targetDateColIndex).value = null;
        }

        // Write rows
        sheetRecords.forEach((r, idx) => {
          const rowIdx = 7 + idx;
          const rowObj = ws.getRow(rowIdx);

          rowObj.getCell(2).value = r.msnv;
          rowObj.getCell(3).value = r.name;
          rowObj.getCell(4).value = r.role;
          if (sheetName !== "QC") {
            rowObj.getCell(5).value = r.position;
            rowObj.getCell(6).value = r.department;
            rowObj.getCell(7).value = r.evalDate ? new Date(r.evalDate) : "";
          } else {
            rowObj.getCell(5).value = r.department;
            rowObj.getCell(6).value = r.evalDate ? new Date(r.evalDate) : "";
          }

          trainingItems.forEach(item => {
            if (r.trainingItems && r.trainingItems[item.name]) {
              rowObj.getCell(item.index).value = "X";
            } else {
              rowObj.getCell(item.index).value = "";
            }
          });

          rowObj.getCell(reasonColIndex).value = r.reason || "";
          if (targetDateColIndex !== -1) {
            rowObj.getCell(targetDateColIndex).value = r.targetDate ? new Date(r.targetDate) : "";
          }

          // Apply standard borders (without breaking excel color encoding)
          for (let c = 1; c <= Math.max(statusColIndex, reasonColIndex, targetDateColIndex); c++) {
            rowObj.getCell(c).border = {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" }
            };
          }
        });
      }

      const outBuffer = await wb.xlsx.writeBuffer();
      const fileBlob = new Blob([outBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(fileBlob, `Bao_cao_CNVH_Update_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      console.error(e);
      alert("Xuất excel thất bại: " + e.message);
    }
  };

  return (
    <div className="license-container">
      <style dangerouslySetInnerHTML={{ __html: `
        .license-container {
          --cn-bg: #F4FAF9;
          --cn-surface: #ffffff;
          --cn-text-primary: #2B3A3C;
          --cn-text-secondary: #5A6F72;
          --cn-border: #D0E2E0;
          --cn-input-bg: #ffffff;
          --cn-input-text: #2B3A3C;
          --cn-input-border: #D0E2E0;
          --cn-table-header: #EBF5F4;
          --cn-modal-bg: #ffffff;
          --cn-modal-overlay: rgba(0, 0, 0, 0.45);
          --cn-card-hover: rgba(70, 110, 115, 0.05);
          display: flex;
          flex-direction: column;
          gap: 24px;
          width: 100%;
        }
        @media (prefers-color-scheme: dark) {
          .license-container {
            --cn-bg: #0b1329;
            --cn-surface: #111a2e;
            --cn-text-primary: #e8f0fe;
            --cn-text-secondary: #8a9fc8;
            --cn-border: rgba(255, 255, 255, 0.08);
            --cn-input-bg: #1a243d;
            --cn-input-text: #ffffff;
            --cn-input-border: rgba(255, 255, 255, 0.15);
            --cn-table-header: #1a2540;
            --cn-modal-bg: #1a2540;
            --cn-modal-overlay: rgba(8, 16, 36, 0.75);
            --cn-card-hover: rgba(255, 255, 255, 0.03);
          }
        }
        .license-title-main {
          font-size: 20px;
          font-weight: 800;
          color: ${colors.primary};
          letter-spacing: 0.5px;
          margin: 0;
        }
        .license-card {
          background: var(--cn-surface);
          border: 1px solid var(--cn-border);
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.02);
        }
        .license-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .license-table th {
          background: var(--cn-table-header);
          color: var(--cn-text-primary);
          font-weight: 700;
          padding: 10px 12px;
          text-align: left;
          border-bottom: 2px solid var(--cn-border);
        }
        .license-table td {
          padding: 10px 12px;
          color: var(--cn-text-secondary);
          border-bottom: 1px solid var(--cn-border);
        }
        .license-badge {
          display: inline-flex;
          align-items: center;
          padding: 3px 8px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
        }
        .license-badge.qualified {
          background: rgba(32, 115, 53, 0.12);
          color: ${colors.secondary};
        }
        .license-badge.lacking {
          background: rgba(217, 83, 79, 0.12);
          color: ${colors.error};
        }
        .license-badge.neutral {
          background: rgba(226, 158, 43, 0.12);
          color: ${colors.warning};
        }
        .license-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 8px;
          border: none;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .license-btn-primary {
          background: ${colors.primary};
          color: white;
        }
        .license-btn-primary:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }
        .license-btn-outline {
          background: transparent;
          border: 1px solid var(--cn-border);
          color: var(--cn-text-primary);
        }
        .license-btn-outline:hover {
          background: var(--cn-card-hover);
        }
        .license-input {
          background: var(--cn-input-bg);
          color: var(--cn-input-text);
          border: 1px solid var(--cn-input-border);
          padding: 8px 12px;
          border-radius: 8px;
          outline: none;
          font-size: 13px;
          transition: border-color 0.2s;
        }
        .license-input:focus {
          border-color: ${colors.primary};
        }
        .license-grid-dashboard {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .quiz-wizard-header {
          border-bottom: 1px solid var(--cn-border);
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .quiz-question-box {
          background: var(--cn-table-header);
          border: 1px solid var(--cn-border);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
        }
        .quiz-hint-box {
          background: rgba(32, 115, 53, 0.06);
          border-left: 4px solid ${colors.secondary};
          padding: 10px 14px;
          border-radius: 4px;
          font-size: 12.5px;
          color: var(--cn-text-secondary);
          margin-top: 12px;
        }
        .quiz-options-group {
          display: flex;
          gap: 20px;
          margin-top: 16px;
        }
        .quiz-option-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid var(--cn-border);
          background: var(--cn-surface);
          color: var(--cn-text-primary);
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
          outline: none;
        }
        .quiz-option-btn.selected-passed {
          background: ${colors.secondary};
          color: white;
          border-color: ${colors.secondary};
        }
        .quiz-option-btn.selected-failed {
          background: ${colors.error};
          color: white;
          border-color: ${colors.error};
        }
        .question-editor-row {
          border-bottom: 1px dashed var(--cn-border);
          padding-bottom: 16px;
          margin-bottom: 16px;
        }
        .question-editor-row:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }
        .license-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }
        .license-header-buttons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .license-filter-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
        }
        .license-chart-svg {
          display: block;
          background: rgba(255, 255, 255, 0.02);
          width: 100%;
          max-width: 900px;
          height: auto;
        }
        .license-stats-table {
          min-width: 650px;
        }
        .license-records-table {
          min-width: 950px;
        }
        .license-modal-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .license-modal-grid-3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
        }
        .license-modal-grid-upload {
          display: grid;
          grid-template-columns: 1.2fr 1.8fr;
          gap: 16px;
          align-items: center;
        }
        .license-checklist-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        @media (max-width: 768px) {
          .license-container {
            gap: 16px;
          }
          .license-card {
            padding: 12px;
            border-radius: 12px;
          }
          .license-header-row {
            flex-direction: column;
            align-items: stretch !important;
          }
          .license-header-buttons {
            width: 100%;
          }
          .license-header-buttons .license-btn {
            flex: 1;
            justify-content: center;
            font-size: 12px;
            padding: 8px 10px;
          }
          .license-filter-row {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
          }
          .license-filter-row > div,
          .license-filter-row > select {
            width: 100% !important;
            min-width: 0 !important;
          }
          .license-chart-svg {
            min-width: 600px;
          }
          .license-table th,
          .license-table td {
            padding: 8px 10px;
            font-size: 12px;
          }
        }
        @media (max-width: 600px) {
          .license-modal-grid-2 {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .license-modal-grid-3 {
            grid-template-columns: 1fr;
            gap: 10px;
          }
          .license-modal-grid-upload {
            grid-template-columns: 1fr;
            gap: 12px;
            align-items: flex-start;
          }
          .license-checklist-grid {
            grid-template-columns: 1fr;
            gap: 8px;
          }
        }
      `}} />

      {/* Top Header Row */}
      <div className="license-header-row">
        <div>
          <h2 className="license-title-main">{t("license.title")}</h2>
          <span style={{ fontSize: "12px", color: "var(--cn-text-secondary)" }}>
            {t("license.dateUpdate").replace("{date}", "06/10/2026")}
          </span>
        </div>
        
        <div className="license-header-buttons">
          <button className="license-btn license-btn-primary" onClick={() => openModal()}>
            <FaPlus /> {t("license.btn.add")}
          </button>
          {isAdmin && (
            <>
              <button className="license-btn license-btn-outline" onClick={openQuestionBankModal}>
                📋 Thiết lập Bộ câu hỏi
              </button>
              <label className="license-btn license-btn-outline" style={{ margin: 0 }}>
                <FaUpload /> {t("license.btn.import")}
                <input type="file" accept=".xlsx" onChange={handleImportExcel} style={{ display: "none" }} />
              </label>
              <button className="license-btn license-btn-outline" onClick={handleExportExcel}>
                <FaFileExcel /> {t("license.btn.export")}
              </button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "60px 0", textAlign: "center", color: "var(--cn-text-secondary)" }}>
          <div className="loading-spinner" style={{ margin: "0 auto 12px auto" }}></div>
          <div>Đang tải dữ liệu chứng nhận...</div>
        </div>
      ) : (
        <>
          {/* Dashboard stats & Chart */}
          <div className="license-grid-dashboard">
            {/* SVG Stacked Bar Chart */}
            <div className="license-card" style={{ display: "flex", flexDirection: "column", gap: "10px", overflowX: "auto" }}>
              <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: "700", color: "var(--cn-text-primary)", textAlign: "center" }}>
                {t("license.chart.title")}
              </h3>
              
              {chartData.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
                  <svg width="100%" height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="license-chart-svg">
                    {/* Y-axis gridlines & labels */}
                    {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(v => {
                      const gy = PAD_T + CHART_H - (v / Y_MAX) * CHART_H;
                      return (
                        <g key={v}>
                          <line
                            x1={PAD_L} y1={gy}
                            x2={SVG_W - PAD_R} y2={gy}
                            stroke={v === 0 ? "var(--cn-text-primary)" : "var(--cn-border)"}
                            strokeWidth={v === 0 ? 1.5 : 0.8}
                            strokeDasharray={v === 0 ? "" : "3 3"}
                          />
                          <text
                            x={PAD_L - 8} y={gy + 4}
                            textAnchor="end"
                            fill="var(--cn-text-secondary)"
                            fontSize="10"
                            fontWeight="600"
                          >{v}</text>
                        </g>
                      );
                    })}

                    {/* Bars */}
                    {chartData.map((d, idx) => {
                      const slotW = CHART_W / chartData.length;
                      const xCenter = PAD_L + (idx + 0.5) * slotW;
                      const barW = 22;
                      const x0 = xCenter - barW / 2;

                      // Stack heights
                      const keys = ["G_Cutting", "G_Rolling", "G_Finishing", "G_Buffing", "G_Dipping", "G_Graphics", "A_Blank", "A_Graphics", "Kayak"];
                      let currentY = PAD_T + CHART_H;

                      return (
                        <g key={d.week} 
                           onMouseEnter={() => setHoveredBar(d)} 
                           onMouseLeave={() => setHoveredBar(null)}
                           style={{ cursor: "pointer" }}
                        >
                          {keys.map(key => {
                            const val = d[key] || 0;
                            if (val <= 0) return null;
                            const h = (val / Y_MAX) * CHART_H;
                            const y = currentY - h;
                            currentY = y;
                            return (
                              <rect
                                key={key}
                                x={x0}
                                y={y}
                                width={barW}
                                height={h}
                                fill={CHART_COLORS[key]}
                              />
                            );
                          })}

                          {/* Total count on top */}
                          <text
                            x={xCenter}
                            y={currentY - 6}
                            textAnchor="middle"
                            fill="var(--cn-text-primary)"
                            fontSize="10"
                            fontWeight="800"
                          >
                            {d.total}
                          </text>

                          {/* X-axis label */}
                          <text
                            x={xCenter}
                            y={PAD_T + CHART_H + 16}
                            textAnchor="middle"
                            fill="var(--cn-text-secondary)"
                            fontSize="9"
                            fontWeight="600"
                          >
                            {d.week}
                          </text>
                        </g>
                      );
                    })}
                  </svg>

                  {/* Tooltip detail box */}
                  {hoveredBar && (
                    <div style={{ 
                      marginTop: "10px", 
                      padding: "8px 12px", 
                      background: "rgba(0,0,0,0.8)", 
                      color: "#fff", 
                      borderRadius: "6px", 
                      fontSize: "11px", 
                      display: "flex", 
                      gap: "12px", 
                      flexWrap: "wrap",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.25)"
                    }}>
                      <strong style={{ borderRight: "1px solid rgba(255,255,255,0.2)", paddingRight: "10px" }}>
                        Tuần: {hoveredBar.week}
                      </strong>
                      {Object.keys(CHART_COLORS).map(key => (
                        <span key={key} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: CHART_COLORS[key] }} />
                          {DEPARTMENTS.find(dep => dep.code === key)?.name}: {hoveredBar[key] || 0}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Simple Color Legend below Chart */}
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center", marginTop: "12px", fontSize: "11px" }}>
                    {DEPARTMENTS.filter(dep => dep.code !== "QC").map(dep => (
                      <div key={dep.code} style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--cn-text-secondary)" }}>
                        <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: CHART_COLORS[dep.code] }} />
                        {dep.name}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ padding: "40px 0", textAlign: "center", color: "var(--cn-text-secondary)" }}>
                  Không có dữ liệu biểu đồ.
                </div>
              )}
            </div>

            {/* Table Stats */}
            <div className="license-card" style={{ display: "flex", flexDirection: "column", gap: "16px", overflowX: "auto" }}>
              <table className="license-table license-stats-table">
                <thead>
                  <tr>
                    <th>{t("license.col.dept")}</th>
                    <th style={{ textAlign: "center" }}>{t("license.col.totalItems")}</th>
                    <th style={{ textAlign: "center" }}>{t("license.col.totalStaff")}</th>
                    <th style={{ textAlign: "center" }}>{t("license.col.qualified")}</th>
                    <th style={{ textAlign: "center" }}>{t("license.col.lacking")}</th>
                    <th style={{ textAlign: "center" }}>{t("license.col.compliance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {computedStats.filter(c => c.code !== "QC").map(c => (
                    <tr key={c.code}>
                      <td style={{ fontWeight: 600, color: "var(--cn-text-primary)" }}>{c.name}</td>
                      <td style={{ textAlign: "center" }}>{c.totalItems}</td>
                      <td style={{ textAlign: "center" }}>{c.totalStaff}</td>
                      <td style={{ textAlign: "center", fontWeight: 700, color: colors.secondary }}>{c.qualified}</td>
                      <td style={{ textAlign: "center", fontWeight: 700, color: c.lacking > 0 ? colors.error : "inherit" }}>{c.lacking}</td>
                      <td style={{ textAlign: "center" }}>
                        <span className={`license-badge ${c.complianceRate === 100 ? "qualified" : "lacking"}`}>
                          {c.complianceRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Table 2: Status Breakdown of Lacking Certificates */}
              <table className="license-table license-stats-table" style={{ marginTop: "8px" }}>
                <thead>
                  <tr>
                    <th>{t("license.col.dept")}</th>
                    <th style={{ textAlign: "center" }}>{t("license.col.notTrained")}</th>
                    <th style={{ textAlign: "center" }}>{t("license.col.inTraining")}</th>
                    <th style={{ textAlign: "center" }}>{t("license.col.waitingEval")}</th>
                    <th style={{ textAlign: "center" }}>{t("license.col.waitingCard")}</th>
                    <th style={{ textAlign: "center" }}>{t("license.col.reEval")}</th>
                  </tr>
                </thead>
                <tbody>
                  {computedStats.filter(c => c.code !== "QC").map(c => (
                    <tr key={c.code}>
                      <td style={{ fontWeight: 600, color: "var(--cn-text-primary)" }}>{c.name}</td>
                      <td style={{ textAlign: "center", color: c.notTrained > 0 ? colors.error : "inherit" }}>{c.notTrained}</td>
                      <td style={{ textAlign: "center", color: c.inTraining > 0 ? colors.warning : "inherit" }}>{c.inTraining}</td>
                      <td style={{ textAlign: "center", color: c.waitingEval > 0 ? colors.warning : "inherit" }}>{c.waitingEval}</td>
                      <td style={{ textAlign: "center", color: c.waitingCard > 0 ? colors.warning : "inherit" }}>{c.waitingCard}</td>
                      <td style={{ textAlign: "center", color: c.reEval > 0 ? colors.error : "inherit" }}>{c.reEval}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Records list card */}
          <div className="license-card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Filter section */}
            <div className="license-filter-row">
              <div style={{ position: "relative", flex: "1", minWidth: "220px" }}>
                <FaSearch style={{ position: "absolute", left: "12px", top: "11px", color: "var(--cn-text-secondary)" }} />
                <input
                  type="text"
                  className="license-input"
                  style={{ width: "100%", paddingLeft: "36px" }}
                  placeholder={t("license.search.placeholder")}
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                />
              </div>

              <select 
                className="license-input" 
                value={filterDept} 
                onChange={e => setFilterDept(e.target.value)}
              >
                <option value="all">{t("license.filter.dept")}</option>
                {DEPARTMENTS.map(d => (
                  <option key={d.code} value={d.code}>{d.name}</option>
                ))}
              </select>

              <select 
                className="license-input" 
                value={filterStatus} 
                onChange={e => setFilterStatus(e.target.value)}
              >
                <option value="all">{t("license.filter.status")}</option>
                <option value="Đủ điều kiện">Đủ điều kiện</option>
                <option value="Thiếu chứng nhận">Thiếu chứng nhận</option>
              </select>

              <select 
                className="license-input" 
                value={filterReason} 
                onChange={e => setFilterReason(e.target.value)}
              >
                <option value="all">{t("license.filter.reason")}</option>
                <option value="CHƯA ĐÀO TẠO">Chưa đào tạo</option>
                <option value="ĐANG ĐÀO TẠO">Đang đào tạo</option>
                <option value="CHỜ ĐÁNH GIÁ">Chờ đánh giá</option>
                <option value="CHỜ CẤP THẺ CNVH">Chờ cấp thẻ CNVH</option>
                <option value="ĐÁNH GIÁ LẠI">Đánh giá lại</option>
              </select>
            </div>

            {/* List Table */}
            <div style={{ overflowX: "auto" }}>
              <table className="license-table license-records-table">
                <thead>
                  <tr>
                    <th>{t("license.table.msnv")}</th>
                    <th>{t("license.table.name")}</th>
                    <th>{t("license.table.dept")}</th>
                    <th>{t("license.table.role")}</th>
                    <th>{t("license.table.evalDate")}</th>
                    <th>{t("license.table.status")}</th>
                    <th>{t("license.table.reason")}</th>
                    <th>{t("license.table.targetDate")}</th>
                    <th style={{ textAlign: "center" }}>Chứng chỉ</th>
                    {isPrivileged && <th style={{ textAlign: "center" }}>{t("license.table.actions")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecords.length > 0 ? (
                    paginatedRecords.map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: "bold" }}>{r.msnv}</td>
                        <td style={{ fontWeight: 600, color: "var(--cn-text-primary)" }}>{r.name}</td>
                        <td>{r.department}</td>
                        <td>{r.role || r.position || "—"}</td>
                        <td>{r.evalDate || "—"}</td>
                        <td>
                          <span className={`license-badge ${r.status === "Đủ điều kiện" ? "qualified" : "lacking"}`}>
                            {r.status}
                          </span>
                        </td>
                        <td>
                          {r.reason ? (
                            <span className="license-badge neutral">
                              {r.reason}
                            </span>
                          ) : "—"}
                        </td>
                        <td>{r.targetDate || "—"}</td>
                        <td style={{ textAlign: "center" }}>
                          {r.certificateCardUrl ? (
                            <a href={r.certificateCardUrl} target="_blank" rel="noreferrer" title={t("license.card.view")}>
                              <FaImage style={{ fontSize: "16px", color: colors.primary, cursor: "pointer" }} />
                            </a>
                          ) : (
                            <span style={{ color: "var(--cn-text-muted)", fontSize: "12px" }}>—</span>
                          )}
                        </td>
                        {isPrivileged && (
                          <td style={{ textAlign: "center" }}>
                            <div style={{ display: "flex", gap: "8px", justifyContent: "center", alignItems: "center" }}>
                              {isEvaluator && r.status === "Thiếu chứng nhận" && (
                                <button 
                                  onClick={() => startEvaluation(r)}
                                  className="license-btn license-btn-primary"
                                  style={{ padding: "4px 8px", fontSize: "11px", borderRadius: "6px" }}
                                  title="Bắt đầu đánh giá kiểm tra"
                                >
                                  Đánh giá
                                </button>
                              )}
                              {r.evalScores && (
                                <button 
                                  onClick={() => exportWordDoc(r)}
                                  style={{ background: "none", border: "none", color: colors.success, cursor: "pointer", padding: "4px" }}
                                  title="Xuất biểu mẫu Word (.doc)"
                                >
                                  <FaDownload size={14} />
                                </button>
                              )}
                              <button 
                                onClick={() => openModal(r)} 
                                style={{ background: "none", border: "none", color: colors.primary, cursor: "pointer", padding: "4px" }}
                                title="Sửa"
                              >
                                <FaEdit size={14} />
                              </button>
                              <button 
                                onClick={() => handleDelete(r)} 
                                style={{ background: "none", border: "none", color: colors.error, cursor: "pointer", padding: "4px" }}
                                title="Xóa"
                              >
                                <FaTrash size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} style={{ textAlign: "center", padding: "30px 10px" }}>
                        Không tìm thấy hồ sơ nào khớp với bộ lọc.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "12px" }}>
                <button 
                  className="license-btn license-btn-outline" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                >
                  &lt;
                </button>
                <span style={{ display: "flex", alignItems: "center", padding: "0 12px", fontSize: "13px", color: "var(--cn-text-secondary)" }}>
                  Trang {currentPage} / {totalPages} (Tổng: {filteredRecords.length})
                </span>
                <button 
                  className="license-btn license-btn-outline" 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                >
                  &gt;
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Edit/Add Record Modal */}
      {showModal && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "var(--cn-modal-overlay)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "16px"
        }}>
          <div style={{
            background: "var(--cn-modal-bg)",
            border: "1px solid var(--cn-border)",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "700px",
            maxHeight: "90vh",
            overflowY: "auto",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--cn-border)", paddingBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--cn-text-primary)" }}>
                {editingRecord ? t("license.modal.title.edit") : t("license.modal.title.add")}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "var(--cn-text-secondary)" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Profile fields */}
              <div className="license-modal-grid-2">
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--cn-text-secondary)" }}>{t("license.table.msnv")} *</label>
                  <input
                    type="text"
                    className="license-input"
                    required
                    disabled={!!editingRecord}
                    value={modalForm.msnv}
                    onChange={e => setModalForm(prev => ({ ...prev, msnv: e.target.value }))}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--cn-text-secondary)" }}>{t("license.table.name")} *</label>
                  <input
                    type="text"
                    className="license-input"
                    required
                    value={modalForm.name}
                    onChange={e => setModalForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--cn-text-secondary)" }}>{t("license.table.role")}</label>
                  <input
                    type="text"
                    className="license-input"
                    value={modalForm.role}
                    onChange={e => setModalForm(prev => ({ ...prev, role: e.target.value }))}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--cn-text-secondary)" }}>{t("license.table.dept")} *</label>
                  <select
                    className="license-input"
                    disabled={!!editingRecord}
                    value={modalForm.deptCode}
                    onChange={handleModalDeptChange}
                  >
                    {DEPARTMENTS.map(d => (
                      <option key={d.code} value={d.code}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status & Date fields */}
              <div className="license-modal-grid-3">
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--cn-text-secondary)" }}>{t("license.table.status")}</label>
                  <select
                    className="license-input"
                    disabled={!isPrivileged && !editingRecord}
                    value={modalForm.status}
                    onChange={e => setModalForm(prev => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="Đủ điều kiện">Đủ điều kiện</option>
                    <option value="Thiếu chứng nhận">Thiếu chứng nhận</option>
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--cn-text-secondary)" }}>{t("license.table.reason")}</label>
                  <select
                    className="license-input"
                    disabled={(!isPrivileged && !editingRecord) || modalForm.status === "Đủ điều kiện"}
                    value={modalForm.reason || ""}
                    onChange={e => setModalForm(prev => ({ ...prev, reason: e.target.value }))}
                  >
                    <option value="">Không có</option>
                    <option value="CHƯA ĐÀO TẠO">Chưa đào tạo</option>
                    <option value="ĐANG ĐÀO TẠO">Đang đào tạo</option>
                    <option value="CHỜ ĐÁNH GIÁ">Chờ đánh giá</option>
                    <option value="CHỜ CẤP THẺ CNVH">Chờ cấp thẻ CNVH</option>
                    <option value="ĐÁNH GIÁ LẠI">Đánh giá lại</option>
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--cn-text-secondary)" }}>
                    {!isPrivileged && !editingRecord ? "Ngày bắt đầu đào tạo" : t("license.table.evalDate")}
                  </label>
                  <input
                    type="date"
                    className="license-input"
                    value={modalForm.evalDate}
                    onChange={handleEvalDateChange}
                  />
                </div>
              </div>

              {!isPrivileged && !editingRecord && (
                <div style={{ color: "#eb4d4b", fontSize: "12px", fontWeight: "600", padding: "10px", background: "rgba(235, 77, 75, 0.08)", borderRadius: "8px", borderLeft: "4px solid #eb4d4b" }}>
                  ⚠️ Thời gian đào tạo tối đa 7 ngày, hệ thống sẽ tự động gửi yêu cầu đánh giá cho EHS khi hết thời gian đào tạo.
                </div>
              )}

              {/* Target date & Image Upload */}
              <div className="license-modal-grid-upload">
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--cn-text-secondary)" }}>{t("license.table.targetDate")}</label>
                  <input
                    type="date"
                    className="license-input"
                    disabled={(!isPrivileged && !editingRecord) || modalForm.status === "Đủ điều kiện"}
                    value={modalForm.targetDate}
                    onChange={e => setModalForm(prev => ({ ...prev, targetDate: e.target.value }))}
                  />
                </div>
                
                {/* Photo upload field */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--cn-text-secondary)" }}>{t("license.card.upload")}</label>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {tempFileUrl ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <a href={tempFileUrl} target="_blank" rel="noreferrer">
                          <img src={tempFileUrl} alt="Chứng chỉ" style={{ width: "38px", height: "38px", objectFit: "cover", borderRadius: "6px", border: "1px solid var(--cn-border)" }} />
                        </a>
                        <button type="button" onClick={deleteTempPhoto} style={{ background: "none", border: "none", color: colors.error, cursor: "pointer", fontSize: "12px" }}>
                          Xóa ảnh
                        </button>
                      </div>
                    ) : (
                      <label className="license-btn license-btn-outline" style={{ margin: 0, padding: "6px 12px", fontSize: "12px", display: "inline-flex", cursor: "pointer" }}>
                        <FaCamera /> {compressing ? "Đang xử lý..." : "Tải ảnh"}
                        <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={compressing} style={{ display: "none" }} />
                      </label>
                    )}
                    
                    {uploadProgress > 0 && (
                      <span style={{ fontSize: "12px", color: colors.primary }}>
                        Tải lên: {uploadProgress}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Machinery/Equipment checklist */}
              <div style={{ marginTop: "10px", borderTop: "1px solid var(--cn-border)", paddingTop: "16px" }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: "13px", fontWeight: 700, color: "var(--cn-text-primary)" }}>
                  {t("license.modal.detailItems")} ({TRAINING_ITEMS[modalForm.deptCode]?.length || 0})
                </h4>
                
                <div className="license-checklist-grid" style={{
                  maxHeight: "220px",
                  overflowY: "auto",
                  background: "var(--cn-card-hover)",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid var(--cn-border)"
                }}>
                  {TRAINING_ITEMS[modalForm.deptCode]?.map(item => (
                    <label key={item} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--cn-text-primary)", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={!!modalForm.trainingItems[item]}
                        onChange={() => toggleTrainingItem(item)}
                        style={{ width: "16px", height: "16px", accentColor: colors.primary }}
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px", borderTop: "1px solid var(--cn-border)", paddingTop: "12px" }}>
                <button type="button" className="license-btn license-btn-outline" onClick={() => setShowModal(false)}>
                  {t("license.btn.cancel")}
                </button>
                <button type="submit" className="license-btn license-btn-primary">
                  {t("license.btn.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Question Bank Modal */}
      {showQuestionsModal && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "var(--cn-modal-overlay)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "16px"
        }}>
          <div style={{
            background: "var(--cn-modal-bg)",
            border: "1px solid var(--cn-border)",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "700px",
            maxHeight: "90vh",
            overflowY: "auto",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--cn-border)", paddingBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--cn-text-primary)" }}>
                📋 Thiết lập Ngân hàng Câu hỏi Đánh giá
              </h3>
              <button 
                onClick={() => setShowQuestionsModal(false)}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "var(--cn-text-secondary)" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--cn-text-secondary)" }}>Vị trí công việc (Job Position):</label>
              <select
                className="license-input"
                value={selectedPosition}
                onChange={e => setSelectedPosition(e.target.value)}
              >
                {allPositions.map(pos => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </select>
            </div>

            {loadingQuestions ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "var(--cn-text-secondary)" }}>
                Đang tải bộ câu hỏi...
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {questionsList.map((q, idx) => (
                  <div key={idx} className="question-editor-row" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: colors.primary }}>
                        Câu {idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...questionsList];
                          updated.splice(idx, 1);
                          setQuestionsList(updated);
                        }}
                        style={{ background: "none", border: "none", color: colors.error, cursor: "pointer", fontSize: "12px" }}
                      >
                        Xóa câu hỏi
                      </button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--cn-text-secondary)" }}>Câu hỏi:</label>
                      <input
                        type="text"
                        className="license-input"
                        value={q.question || ""}
                        onChange={e => {
                          const updated = [...questionsList];
                          updated[idx] = { ...updated[idx], question: e.target.value };
                          setQuestionsList(updated);
                        }}
                        placeholder="Nhập nội dung câu hỏi..."
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--cn-text-secondary)" }}>Gợi ý trả lời (Hint):</label>
                      <textarea
                        className="license-input"
                        style={{ minHeight: "50px", resize: "vertical" }}
                        value={q.hint || ""}
                        onChange={e => {
                          const updated = [...questionsList];
                          updated[idx] = { ...updated[idx], hint: e.target.value };
                          setQuestionsList(updated);
                        }}
                        placeholder="Nhập gợi ý/hướng dẫn trả lời..."
                      />
                    </div>
                  </div>
                ))}
                
                <button
                  type="button"
                  className="license-btn license-btn-outline"
                  style={{ alignSelf: "flex-start", marginTop: "8px" }}
                  onClick={() => {
                    setQuestionsList([...questionsList, { question: "", hint: "" }]);
                  }}
                >
                  ➕ Thêm câu hỏi
                </button>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px", borderTop: "1px solid var(--cn-border)", paddingTop: "12px" }}>
              <button type="button" className="license-btn license-btn-outline" onClick={() => setShowQuestionsModal(false)}>
                Hủy
              </button>
              <button type="button" className="license-btn license-btn-primary" onClick={handleSaveQuestionBank}>
                Lưu lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quiz Evaluation Wizard Modal */}
      {showEvalWizard && evalCandidate && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "var(--cn-modal-overlay)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "16px"
        }}>
          <div style={{
            background: "var(--cn-modal-bg)",
            border: "1px solid var(--cn-border)",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "600px",
            maxHeight: "90vh",
            overflowY: "auto",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)"
          }}>
            <div className="quiz-wizard-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--cn-text-primary)" }}>
                  📋 Đánh giá Năng lực Vận hành
                </h3>
                <span style={{ fontSize: "12px", color: "var(--cn-text-secondary)" }}>
                  Nhân viên: <strong>{evalCandidate.name}</strong> ({evalCandidate.msnv}) | Vị trí: {evalCandidate.position || evalCandidate.role || "Chung"}
                </span>
              </div>
              <button 
                onClick={() => setShowEvalWizard(false)}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "var(--cn-text-secondary)" }}
              >
                ✕
              </button>
            </div>

            {wizardQuestions.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "var(--cn-text-secondary)" }}>
                Không tìm thấy câu hỏi đánh giá cho vị trí này.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                {/* Progress Bar */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--cn-text-secondary)" }}>
                    Câu hỏi {currentQuestionIndex + 1} / {wizardQuestions.length}
                  </span>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: colors.primary }}>
                    Tiến trình: {Math.round(((currentQuestionIndex) / wizardQuestions.length) * 100)}%
                  </span>
                </div>
                <div style={{ height: "6px", width: "100%", background: "var(--cn-border)", borderRadius: "3px", marginBottom: "20px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${((currentQuestionIndex + 1) / wizardQuestions.length) * 100}%`, background: colors.primary, transition: "width 0.3s ease" }}></div>
                </div>

                {/* Current Question */}
                <div className="quiz-question-box">
                  <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: "700", color: "var(--cn-text-primary)" }}>
                    {wizardQuestions[currentQuestionIndex]?.question}
                  </h4>
                  {wizardQuestions[currentQuestionIndex]?.hint && (
                    <div className="quiz-hint-box">
                      <strong>💡 Hướng dẫn đáp án:</strong><br />
                      {wizardQuestions[currentQuestionIndex].hint}
                    </div>
                  )}
                </div>

                {/* Options / Selection */}
                <div className="quiz-options-group">
                  <button 
                    type="button" 
                    className={`quiz-option-btn ${answersMap[currentQuestionIndex] === "Đạt" ? "selected-passed" : ""}`}
                    onClick={() => setAnswersMap(prev => ({ ...prev, [currentQuestionIndex]: "Đạt" }))}
                  >
                    <FaCheck /> ĐẠT
                  </button>
                  <button 
                    type="button" 
                    className={`quiz-option-btn ${answersMap[currentQuestionIndex] === "Không đạt" ? "selected-failed" : ""}`}
                    onClick={() => setAnswersMap(prev => ({ ...prev, [currentQuestionIndex]: "Không đạt" }))}
                  >
                    <FaTimes /> KHÔNG ĐẠT
                  </button>
                </div>

                {/* Navigation Buttons for Wizard */}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px", borderTop: "1px solid var(--cn-border)", paddingTop: "16px" }}>
                  <button 
                    type="button" 
                    className="license-btn license-btn-outline" 
                    disabled={currentQuestionIndex === 0}
                    onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                  >
                    Quay lại
                  </button>
                  
                  {currentQuestionIndex < wizardQuestions.length - 1 ? (
                    <button 
                      type="button" 
                      className="license-btn license-btn-primary" 
                      disabled={!answersMap[currentQuestionIndex]}
                      onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                    >
                      Câu tiếp theo
                    </button>
                  ) : (
                    <span style={{ color: "var(--cn-text-secondary)", fontSize: "12px", display: "flex", alignItems: "center" }}>
                      Đã đi tới câu cuối cùng
                    </span>
                  )}
                </div>

                {/* Metadata & Comments (Only shown on the final question or as a persistent sidebar/section) */}
                {currentQuestionIndex === wizardQuestions.length - 1 && (
                  <div style={{ marginTop: "20px", background: "var(--cn-card-hover)", padding: "16px", borderRadius: "12px", border: "1px solid var(--cn-border)", display: "flex", flexDirection: "column", gap: "12px" }}>
                    <h4 style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "var(--cn-text-primary)" }}>Thông tin bổ sung & Nhận xét</h4>
                    
                    <div className="license-modal-grid-2" style={{ gap: "12px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--cn-text-secondary)" }}>Người hướng dẫn (Trainer):</label>
                        <input
                          type="text"
                          className="license-input"
                          value={trainerName}
                          onChange={e => setTrainerName(e.target.value)}
                          placeholder="Tên người hướng dẫn..."
                        />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--cn-text-secondary)" }}>Ca làm việc (Working Shift):</label>
                        <input
                          type="text"
                          className="license-input"
                          value={workingShift}
                          onChange={e => setWorkingShift(e.target.value)}
                          placeholder="Ca làm việc (A/B/C...)..."
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--cn-text-secondary)" }}>Nhận xét chi tiết của người đánh giá:</label>
                      <textarea
                        className="license-input"
                        style={{ minHeight: "60px", resize: "vertical" }}
                        value={evalComment}
                        onChange={e => setEvalComment(e.target.value)}
                        placeholder="Nhập nhận xét của bạn về năng lực vận hành của nhân viên..."
                      />
                    </div>

                    <button 
                      type="button" 
                      className="license-btn license-btn-primary" 
                      style={{ width: "100%", marginTop: "8px", background: colors.secondary }}
                      disabled={Object.keys(answersMap).length < wizardQuestions.length}
                      onClick={handleCompleteEvaluation}
                    >
                      🏁 Hoàn thành Đánh giá
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
