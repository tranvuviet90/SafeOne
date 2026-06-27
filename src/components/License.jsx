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
      // Send in chunks so large imports never exceed the request body limit
      // (was causing 413 Payload Too Large when committing hundreds of records at once).
      const CHUNK_SIZE = 100;
      for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
        await dbService.commitBatch(operations.slice(i, i + CHUNK_SIZE));
      }
    }
  };
};
import { useI18n } from "../i18n/I18nProvider";
import { colors } from "../theme";
import { 
  FaSearch, FaPlus, FaFileExcel, FaDownload, FaUpload, 
  FaEdit, FaTrash, FaCheck, FaTimes, FaCamera, FaImage 
} from "react-icons/fa";
import { useToast, useConfirm } from "./LightboxSwipeOnly";
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
  const { pushToast } = useToast();

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
    trainerName: "",
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
  // EHS Committee / Trainer (and admin/ehs) may push a trainee straight to evaluation
  // without waiting out the full 7-day training window.
  const canManageTraining = userRolesList.some(r => ["admin", "ehs", "ehs committee", "ehscommittee", "trainer"].includes(r));

  // Quick-access management panel: 'training' (Đang đào tạo) | 'eval' (Chờ đánh giá) | null
  const [trainingPanel, setTrainingPanel] = useState(null);

  // State for Question Bank Modal
  const [showQuestionsModal, setShowQuestionsModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState("");
  const [questionsList, setQuestionsList] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // State for Evaluation Quiz Wizard.
  // Each selected training skill is evaluated with its own question set, one after
  // another (e.g. finish "Máy Sheet", then move on to "Máy Shear"...).
  const [showEvalWizard, setShowEvalWizard] = useState(false);
  const [evalCandidate, setEvalCandidate] = useState(null);
  const [evalSkills, setEvalSkills] = useState([]); // [{ name, questions: [...] }]
  const [currentSkillIndex, setCurrentSkillIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answersMap, setAnswersMap] = useState({}); // key `${skillIdx}_${qIdx}` -> "Đạt" | "Không đạt"
  const [evalComment, setEvalComment] = useState("");
  const [trainerName, setTrainerName] = useState("");
  const [trainingPosition, setTrainingPosition] = useState("");
  const [loadingEval, setLoadingEval] = useState(false);

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
    // Include every machine/skill so admins can author a question bank per skill
    // (the evaluation wizard loads questions keyed by skill name).
    Object.values(TRAINING_ITEMS).flat().forEach(item => set.add(item));
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

  // Only show departments that actually have certification records, so a fresh
  // database renders an empty tab instead of all departments at a fake 100%.
  const visibleStats = useMemo(
    () => computedStats.filter(c => c.code !== "QC" && c.totalStaff > 0),
    [computedStats]
  );

  // Chart only shows the 6 most recent periods so the monthly evaluation bar
  // chart stays readable as history grows. chartData is already sorted ascending.
  const displayedChartData = useMemo(() => chartData.slice(-6), [chartData]);

  // Top summary counts (distinct employees by MSNV), mirroring the locker tab cards.
  const summaryStats = useMemo(() => {
    const certified = new Set();
    const inTraining = new Set();
    const waitingEval = new Set();
    records.forEach(r => {
      if (!r.msnv) return;
      if (r.status === "Đủ điều kiện") certified.add(r.msnv);
      if (r.status === "Thiếu chứng nhận" && r.reason === "ĐANG ĐÀO TẠO") inTraining.add(r.msnv);
      if (r.status === "Thiếu chứng nhận" && r.reason === "CHỜ ĐÁNH GIÁ") waitingEval.add(r.msnv);
    });
    return { certified: certified.size, inTraining: inTraining.size, waitingEval: waitingEval.size };
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
        trainerName: record.trainerName || "",
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
        trainerName: "",
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
      pushToast("Đã lưu bộ câu hỏi cho: " + selectedPosition, "success");
      setShowQuestionsModal(false);
    } catch (err) {
      console.error(err);
      pushToast("Lưu thất bại: " + err.message, "error");
    }
  };

  // Load the question bank for a single skill/position (falls back to defaults).
  const loadQuestionsFor = async (key) => {
    try {
      const snap = await getDoc(doc(db, "operation_certification_questions", key));
      if (snap.exists() && snap.data().questions?.length > 0) {
        return snap.data().questions;
      }
    } catch (e) {
      console.error("Lỗi tải câu hỏi đánh giá:", e);
    }
    return DEFAULT_QUESTIONS;
  };

  // EHS Quiz Wizard. Builds one question set per skill that still needs evaluating.
  const startEvaluation = async (candidate) => {
    setEvalCandidate(candidate);
    setCurrentSkillIndex(0);
    setCurrentQuestionIndex(0);
    setAnswersMap({});
    setEvalComment("");
    setTrainerName(candidate.trainerName || user.name || "");
    setTrainingPosition(candidate.position || candidate.role || "");
    setEvalSkills([]);
    setShowEvalWizard(true);
    setLoadingEval(true);

    // Re-evaluate only the previously-failed skills if present; otherwise every
    // selected training skill. Fall back to the position when no skills are set.
    const selectedItems = Object.keys(candidate.trainingItems || {}).filter(k => candidate.trainingItems[k]);
    let skillKeys = (Array.isArray(candidate.failedItems) && candidate.failedItems.length > 0)
      ? candidate.failedItems
      : selectedItems;
    if (skillKeys.length === 0) {
      skillKeys = [candidate.position || candidate.role || "Vị trí chung"];
    }

    try {
      const skills = [];
      for (const key of skillKeys) {
        const questions = await loadQuestionsFor(key);
        skills.push({ name: key, questions });
      }
      setEvalSkills(skills);
    } finally {
      setLoadingEval(false);
    }
  };

  const handleCompleteEvaluation = async () => {
    // Per-skill pass/fail: a skill passes only if every one of its questions is "Đạt".
    const passedItems = [];
    const failedItems = [];
    const evalScores = [];
    evalSkills.forEach((skill, sIdx) => {
      let skillPassed = true;
      skill.questions.forEach((q, qIdx) => {
        const result = answersMap[`${sIdx}_${qIdx}`] || "Không đạt";
        if (result !== "Đạt") skillPassed = false;
        evalScores.push({ skill: skill.name, question: q.question, result });
      });
      if (skillPassed) passedItems.push(skill.name);
      else failedItems.push(skill.name);
    });

    const overallPassed = failedItems.length === 0;
    const todayStr = new Date().toISOString().slice(0, 10);

    const candidateId = `${evalCandidate.deptCode}_${evalCandidate.msnv}`;

    const updatedRecord = {
      ...evalCandidate,
      // Passed everything -> certified. Otherwise the failed skills go back to training.
      status: overallPassed ? "Đủ điều kiện" : "Thiếu chứng nhận",
      reason: overallPassed ? "" : "ĐANG ĐÀO TẠO",
      evalFailed: !overallPassed,
      failedItems: overallPassed ? [] : failedItems,
      passedItems,
      evalDate: todayStr,
      evalComment: evalComment || "Đã hoàn thành đánh giá.",
      trainerName: trainerName || evalCandidate.trainerName || user.name || "",
      trainingPosition: trainingPosition || evalCandidate.position || evalCandidate.role || "",
      evalScores,
      // Reset the 7-day training-timeout notification cycle (evalDate is "today"
      // again, so it won't fire until a fresh 7 days pass).
      evalRequestedNotifSent: false,
      reEvalRequestedNotifSent: false,
      updatedBy: user.name || user.email,
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "operation_certifications", candidateId), updatedRecord);
      if (overallPassed) {
        pushToast("Đánh giá hoàn tất! Kết quả: ĐẠT toàn bộ.", "success");
      } else {
        pushToast(`Đánh giá hoàn tất. ${failedItems.length} kỹ năng không đạt đã trả về "Đang đào tạo".`, "warning");
      }

      if (window.confirm("Bạn có muốn xuất và tải biểu mẫu đánh giá (.docx) về máy ngay bây giờ không?")) {
        exportWordDoc(updatedRecord);
      }

      setShowEvalWizard(false);
    } catch (e) {
      console.error(e);
      pushToast("Lưu kết quả đánh giá thất bại.", "error");
    }
  };

  // Fill the official .docx evaluation form (ADL/F/EHS/022-3) with this record's
  // data and download it. The template at /templates/022-3 Danh gia CNVH.docx ships
  // with {{token}} placeholders pre-inserted into single runs (see word/document.xml),
  // so we just unzip, substitute, and re-zip — far more robust than byte-patching the
  // legacy binary .doc, which broke whenever the layout shifted by a character.
  const exportWordDoc = async (record) => {
    try {
      const response = await fetch("/templates/022-3 Danh gia CNVH.docx", { cache: "no-store" });
      if (!response.ok) throw new Error("Không thể tải tệp mẫu .docx");
      const arrayBuffer = await response.arrayBuffer();

      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(arrayBuffer);
      const docXmlFile = zip.file("word/document.xml");
      if (!docXmlFile) throw new Error("Tệp mẫu .docx không hợp lệ (thiếu document.xml)");
      let xml = await docXmlFile.async("string");

      const deptName = record.department || record.deptCode || "";
      const dateRaw = record.evalDate || new Date().toISOString().slice(0, 10);
      const parts = dateRaw.split("-");
      const dateStr = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateRaw;
      const passed = record.status === "Đủ điều kiện";

      // Wingdings checkbox glyphs (Private-Use chars) matching the boxes already in
      // the template: U+F0FE = checked, U+F0A8 = empty.
      const CHECKED = String.fromCharCode(0xF0FE);
      const EMPTY = String.fromCharCode(0xF0A8);

      const escapeXml = (s) => String(s ?? "")
        .replace(/\s+/g, " ").trim()
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

      const values = {
        dept: " " + escapeXml(deptName),
        date: " " + escapeXml(dateStr),
        employee: " " + escapeXml(record.name || ""),
        msnv: " " + escapeXml(record.msnv || ""),
        position: " " + escapeXml(record.position || record.role || ""),
        shift: " " + escapeXml(record.workingShift || record.role || ""),
        workpos: " " + escapeXml(record.trainingPosition || record.position || ""),
        trainer: " " + escapeXml(record.trainerName || ""),
        comment: escapeXml(record.evalComment || "Đã hoàn thành đánh giá."),
        // rp/rf are raw checkbox glyphs (plain chars, not XML-escaped).
        rp: passed ? CHECKED : EMPTY,
        rf: passed ? EMPTY : CHECKED
      };

      xml = xml.replace(/\{\{(\w+)\}\}/g, (m, key) =>
        Object.prototype.hasOwnProperty.call(values, key) ? values[key] : "");

      zip.file("word/document.xml", xml);
      const blob = await zip.generateAsync({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      });

      const { saveAs } = await import("file-saver");
      const safeName = (record.name || "").replace(/\s+/g, "_");
      saveAs(blob, `022-3_Danh_gia_CNVH_${record.msnv || ""}_${safeName}.docx`);
    } catch (e) {
      console.error(e);
      pushToast("Xuất biểu mẫu Word thất bại: " + e.message, "error");
    }
  };

  // Change department in Modal. Keep already-ticked training items so the user can
  // accumulate skills across several departments in one go (the checklist below
  // just swaps to the new department's items; selections persist by item name).
  const handleModalDeptChange = (e) => {
    const code = e.target.value;
    setModalForm(prev => ({
      ...prev,
      deptCode: code
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
      pushToast("Tải ảnh thất bại.", "error");
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
      pushToast("Vui lòng điền mã nhân viên và họ tên!", "warning");
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
      pushToast(t("license.alert.saveSuccess"), "success");
      setShowModal(false);
    } catch (err) {
      console.error("Lỗi lưu:", err);
      pushToast("Lưu dữ liệu thất bại.", "error");
    }
  };

  // Manually move a trainee from "ĐANG ĐÀO TẠO" to "CHỜ ĐÁNH GIÁ" without waiting
  // the full 7 days. Allowed for EHS Committee / Trainer (and admin/ehs).
  const moveToWaitingEval = async (record) => {
    if (!canManageTraining) return;
    if (!(await askConfirm(
      `Chuyển nhân viên ${record.name} (${record.msnv}) sang trạng thái "Chờ đánh giá"?`,
      "Xác nhận chuyển trạng thái"
    ))) return;

    try {
      const docId = `${record.deptCode}_${record.msnv}`;
      await setDoc(doc(db, "operation_certifications", docId), {
        ...record,
        status: "Thiếu chứng nhận",
        reason: "CHỜ ĐÁNH GIÁ",
        evalRequestedNotifSent: true, // skip the automatic 7-day timeout notification
        updatedBy: user.name || user.email,
        updatedAt: new Date().toISOString()
      });
      pushToast(`Đã chuyển ${record.name} sang "Chờ đánh giá".`, "success");
    } catch (err) {
      console.error("Lỗi chuyển trạng thái:", err);
      pushToast("Chuyển trạng thái thất bại.", "error");
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
      pushToast("Đã xóa chứng nhận thành công!", "success");
    } catch (err) {
      console.error(err);
      pushToast("Xóa thất bại.", "error");
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
        pushToast(t("license.alert.importSuccess").replace("{count}", count), "success");
      } catch (err) {
        console.error(err);
        pushToast(t("license.alert.importError").replace("{error}", err.message), "error");
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
      pushToast("Xuất excel thất bại: " + e.message, "error");
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
          max-width: 100%;
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
            min-width: 0;
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
          {(canManageTraining || isPrivileged) && (
            <>
              <button className="license-btn license-btn-outline" onClick={() => setTrainingPanel("training")}>
                🎓 Đang đào tạo ({summaryStats.inTraining})
              </button>
              <button className="license-btn license-btn-outline" onClick={() => setTrainingPanel("eval")}>
                ⏳ Chờ đánh giá ({summaryStats.waitingEval})
              </button>
            </>
          )}
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
          {/* Top summary cards (distinct employees) */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 160px", background: "rgba(72, 187, 120, 0.12)", border: "1px solid rgba(72, 187, 120, 0.2)", padding: "12px 16px", borderRadius: 12, textAlign: "center" }}>
              <div style={{ fontSize: "11px", color: "rgba(72, 187, 120, 0.9)", fontWeight: "600" }}>ĐÃ CÓ CNVH</div>
              <div style={{ fontSize: "22px", fontWeight: "800", color: "#38a169" }}>{summaryStats.certified}</div>
            </div>
            <div style={{ flex: "1 1 160px", background: "rgba(237, 137, 54, 0.12)", border: "1px solid rgba(237, 137, 54, 0.2)", padding: "12px 16px", borderRadius: 12, textAlign: "center" }}>
              <div style={{ fontSize: "11px", color: "var(--cn-text-secondary)", fontWeight: "600" }}>ĐANG ĐÀO TẠO</div>
              <div style={{ fontSize: "22px", fontWeight: "800", color: colors.warning }}>{summaryStats.inTraining}</div>
            </div>
            <div style={{ flex: "1 1 160px", background: "rgba(70, 110, 115, 0.10)", border: "1px solid rgba(70, 110, 115, 0.2)", padding: "12px 16px", borderRadius: 12, textAlign: "center" }}>
              <div style={{ fontSize: "11px", color: "var(--cn-text-secondary)", fontWeight: "600" }}>CHỜ ĐÁNH GIÁ</div>
              <div style={{ fontSize: "22px", fontWeight: "800", color: colors.primary }}>{summaryStats.waitingEval}</div>
            </div>
          </div>

          {/* Dashboard stats & Chart */}
          <div className="license-grid-dashboard">
            {/* SVG Stacked Bar Chart */}
            <div className="license-card" style={{ display: "flex", flexDirection: "column", gap: "10px", overflowX: "auto" }}>
              <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: "700", color: "var(--cn-text-primary)", textAlign: "center" }}>
                {t("license.chart.title")}
              </h3>
              
              {displayedChartData.length > 0 ? (
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
                    {displayedChartData.map((d, idx) => {
                      const slotW = CHART_W / displayedChartData.length;
                      const xCenter = PAD_L + (idx + 0.5) * slotW;
                      // Bars fill ~62% of each slot (capped so 1-2 month views don't
                      // get absurdly wide). Because the SVG scales to 100% of the card
                      // via viewBox, a slot-relative width makes the bars "fatten up"
                      // and stretch together with the page instead of staying skinny.
                      const barW = Math.min(slotW * 0.62, 120);
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
                  {visibleStats.length > 0 ? (
                    visibleStats.map(c => (
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
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "24px 10px", color: "var(--cn-text-secondary)" }}>
                        Chưa có dữ liệu chứng nhận.
                      </td>
                    </tr>
                  )}
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
                  {visibleStats.length > 0 ? (
                    visibleStats.map(c => (
                      <tr key={c.code}>
                        <td style={{ fontWeight: 600, color: "var(--cn-text-primary)" }}>{c.name}</td>
                        <td style={{ textAlign: "center", color: c.notTrained > 0 ? colors.error : "inherit" }}>{c.notTrained}</td>
                        <td style={{ textAlign: "center", color: c.inTraining > 0 ? colors.warning : "inherit" }}>{c.inTraining}</td>
                        <td style={{ textAlign: "center", color: c.waitingEval > 0 ? colors.warning : "inherit" }}>{c.waitingEval}</td>
                        <td style={{ textAlign: "center", color: c.waitingCard > 0 ? colors.warning : "inherit" }}>{c.waitingCard}</td>
                        <td style={{ textAlign: "center", color: c.reEval > 0 ? colors.error : "inherit" }}>{c.reEval}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "24px 10px", color: "var(--cn-text-secondary)" }}>
                        Chưa có dữ liệu chứng nhận.
                      </td>
                    </tr>
                  )}
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

              {/* Trainer */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--cn-text-secondary)" }}>Người hướng dẫn (Trainer)</label>
                <input
                  type="text"
                  className="license-input"
                  value={modalForm.trainerName}
                  onChange={e => setModalForm(prev => ({ ...prev, trainerName: e.target.value }))}
                  placeholder="Tên người hướng dẫn đào tạo..."
                />
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

                {/* Selected skills across all departments */}
                {Object.keys(modalForm.trainingItems).filter(k => modalForm.trainingItems[k]).length > 0 && (
                  <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--cn-text-primary)" }}>
                    <strong>Đào tạo kỹ năng:</strong>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                      {Object.keys(modalForm.trainingItems).filter(k => modalForm.trainingItems[k]).map(k => (
                        <span
                          key={k}
                          style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: colors.primary, color: "white", padding: "3px 10px", borderRadius: "16px", fontSize: "11px", fontWeight: 600 }}
                        >
                          {k}
                          <span
                            onClick={() => toggleTrainingItem(k)}
                            title="Bỏ chọn"
                            style={{ cursor: "pointer", fontWeight: 800 }}
                          >
                            ✕
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
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

            {loadingEval ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "var(--cn-text-secondary)" }}>
                Đang tải bộ câu hỏi đánh giá...
              </div>
            ) : evalSkills.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "var(--cn-text-secondary)" }}>
                Không tìm thấy kỹ năng/câu hỏi đánh giá cho nhân viên này.
              </div>
            ) : (() => {
              // Flatten (skill, question) pairs to drive sequential navigation across skills.
              const flat = [];
              evalSkills.forEach((s, sIdx) => s.questions.forEach((q, qIdx) => flat.push({ sIdx, qIdx })));
              const totalQ = flat.length;
              const flatIndex = flat.findIndex(f => f.sIdx === currentSkillIndex && f.qIdx === currentQuestionIndex);
              const safeFlatIndex = flatIndex < 0 ? 0 : flatIndex;
              const isLast = safeFlatIndex === totalQ - 1;
              const isFirst = safeFlatIndex === 0;
              const currentSkill = evalSkills[currentSkillIndex];
              const currentQuestion = currentSkill?.questions[currentQuestionIndex];
              const answerKey = `${currentSkillIndex}_${currentQuestionIndex}`;
              const allAnswered = flat.every(f => answersMap[`${f.sIdx}_${f.qIdx}`]);

              const goPrev = () => {
                if (currentQuestionIndex > 0) {
                  setCurrentQuestionIndex(currentQuestionIndex - 1);
                } else if (currentSkillIndex > 0) {
                  const prevSkill = currentSkillIndex - 1;
                  setCurrentSkillIndex(prevSkill);
                  setCurrentQuestionIndex(evalSkills[prevSkill].questions.length - 1);
                }
              };
              const goNext = () => {
                if (currentQuestionIndex < currentSkill.questions.length - 1) {
                  setCurrentQuestionIndex(currentQuestionIndex + 1);
                } else if (currentSkillIndex < evalSkills.length - 1) {
                  setCurrentSkillIndex(currentSkillIndex + 1);
                  setCurrentQuestionIndex(0);
                }
              };

              return (
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                {/* Skill + progress */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                  <span className="license-badge neutral" style={{ fontSize: "12px" }}>
                    Kỹ năng {currentSkillIndex + 1}/{evalSkills.length}: {currentSkill?.name}
                  </span>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: colors.primary }}>
                    Câu {safeFlatIndex + 1} / {totalQ}
                  </span>
                </div>
                <div style={{ height: "6px", width: "100%", background: "var(--cn-border)", borderRadius: "3px", marginBottom: "20px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${((safeFlatIndex + 1) / totalQ) * 100}%`, background: colors.primary, transition: "width 0.3s ease" }}></div>
                </div>

                {/* Current Question */}
                <div className="quiz-question-box">
                  <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: "700", color: "var(--cn-text-primary)" }}>
                    {currentQuestion?.question}
                  </h4>
                  {currentQuestion?.hint && (
                    <div className="quiz-hint-box">
                      <strong>💡 Hướng dẫn đáp án:</strong><br />
                      {currentQuestion.hint}
                    </div>
                  )}
                </div>

                {/* Options / Selection */}
                <div className="quiz-options-group">
                  <button
                    type="button"
                    className={`quiz-option-btn ${answersMap[answerKey] === "Đạt" ? "selected-passed" : ""}`}
                    onClick={() => setAnswersMap(prev => ({ ...prev, [answerKey]: "Đạt" }))}
                  >
                    <FaCheck /> ĐẠT
                  </button>
                  <button
                    type="button"
                    className={`quiz-option-btn ${answersMap[answerKey] === "Không đạt" ? "selected-failed" : ""}`}
                    onClick={() => setAnswersMap(prev => ({ ...prev, [answerKey]: "Không đạt" }))}
                  >
                    <FaTimes /> KHÔNG ĐẠT
                  </button>
                </div>

                {/* Navigation */}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px", borderTop: "1px solid var(--cn-border)", paddingTop: "16px" }}>
                  <button type="button" className="license-btn license-btn-outline" disabled={isFirst} onClick={goPrev}>
                    Quay lại
                  </button>
                  {!isLast ? (
                    <button type="button" className="license-btn license-btn-primary" disabled={!answersMap[answerKey]} onClick={goNext}>
                      {currentQuestionIndex === currentSkill.questions.length - 1 ? "Kỹ năng tiếp theo →" : "Câu tiếp theo"}
                    </button>
                  ) : (
                    <span style={{ color: "var(--cn-text-secondary)", fontSize: "12px", display: "flex", alignItems: "center" }}>
                      Đã tới câu cuối cùng
                    </span>
                  )}
                </div>

                {/* Summary of all results, then evaluator's comment (final question only) */}
                {isLast && (
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
                        <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--cn-text-secondary)" }}>Đào tạo cho vị trí:</label>
                        <input
                          type="text"
                          className="license-input"
                          value={trainingPosition}
                          onChange={e => setTrainingPosition(e.target.value)}
                          placeholder="Vị trí được đào tạo..."
                        />
                      </div>
                    </div>

                    {/* Per-skill question results listed before the comment */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--cn-text-secondary)" }}>Tổng hợp kết quả đánh giá:</label>
                      {evalSkills.map((s, sIdx) => (
                        <div key={sIdx} style={{ border: "1px solid var(--cn-border)", borderRadius: "8px", padding: "8px 10px" }}>
                          <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--cn-text-primary)", marginBottom: "4px" }}>{s.name}</div>
                          {s.questions.map((q, qIdx) => {
                            const r = answersMap[`${sIdx}_${qIdx}`];
                            return (
                              <div key={qIdx} style={{ display: "flex", justifyContent: "space-between", gap: "10px", fontSize: "12px", padding: "2px 0" }}>
                                <span style={{ color: "var(--cn-text-secondary)" }}>{qIdx + 1}. {q.question}</span>
                                <span style={{ fontWeight: 700, whiteSpace: "nowrap", color: r === "Đạt" ? colors.secondary : (r === "Không đạt" ? colors.error : "var(--cn-text-secondary)") }}>
                                  {r || "—"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ))}
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
                      disabled={!allAnswered}
                      onClick={handleCompleteEvaluation}
                    >
                      🏁 Hoàn thành Đánh giá
                    </button>
                  </div>
                )}
              </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Training / Evaluation management panel */}
      {trainingPanel && (
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
            maxWidth: "760px",
            maxHeight: "90vh",
            overflowY: "auto",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--cn-border)", paddingBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--cn-text-primary)" }}>
                {trainingPanel === "training" ? "🎓 Nhân viên đang đào tạo" : "⏳ Nhân viên chờ đánh giá"}
              </h3>
              <button
                onClick={() => setTrainingPanel(null)}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "var(--cn-text-secondary)" }}
              >
                ✕
              </button>
            </div>

            {trainingPanel === "training" && canManageTraining && (
              <div style={{ fontSize: "12px", color: "var(--cn-text-secondary)" }}>
                Thời gian đào tạo tối đa 7 ngày sẽ tự động chuyển sang "Chờ đánh giá". Bạn có thể chuyển sớm bằng nút bên dưới.
              </div>
            )}

            {(() => {
              const list = records.filter(r =>
                r.status === "Thiếu chứng nhận" &&
                r.reason === (trainingPanel === "training" ? "ĐANG ĐÀO TẠO" : "CHỜ ĐÁNH GIÁ")
              );
              if (list.length === 0) {
                return (
                  <div style={{ padding: "30px 0", textAlign: "center", color: "var(--cn-text-secondary)" }}>
                    Không có nhân viên nào trong danh sách này.
                  </div>
                );
              }
              const todayMs = new Date(new Date().toISOString().slice(0, 10)).getTime();
              return (
                <div style={{ overflowX: "auto" }}>
                  <table className="license-table" style={{ minWidth: "640px" }}>
                    <thead>
                      <tr>
                        <th>{t("license.table.msnv")}</th>
                        <th>{t("license.table.name")}</th>
                        <th>{t("license.table.dept")}</th>
                        <th>{trainingPanel === "training" ? "Ngày bắt đầu" : t("license.table.evalDate")}</th>
                        {trainingPanel === "training" && <th style={{ textAlign: "center" }}>Số ngày</th>}
                        <th style={{ textAlign: "center" }}>{trainingPanel === "training" ? "Trạng thái" : "Thao tác"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map(r => {
                        const days = r.evalDate
                          ? Math.floor((todayMs - new Date(r.evalDate).getTime()) / (1000 * 60 * 60 * 24))
                          : null;
                        return (
                          <tr key={r.id}>
                            <td style={{ fontWeight: "bold" }}>{r.msnv}</td>
                            <td style={{ fontWeight: 600, color: "var(--cn-text-primary)" }}>{r.name}</td>
                            <td>{r.department || r.deptCode}</td>
                            <td>{r.evalDate || "—"}</td>
                            {trainingPanel === "training" && (
                              <td style={{ textAlign: "center", fontWeight: 700, color: days !== null && days >= 7 ? colors.error : "inherit" }}>
                                {days !== null ? `${days} ngày` : "—"}
                              </td>
                            )}
                            <td style={{ textAlign: "center" }}>
                              {trainingPanel === "training" ? (
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                                  {r.evalFailed && (
                                    <span style={{ color: colors.error, fontWeight: 700, fontSize: "11px" }}>Đánh giá không đạt</span>
                                  )}
                                  {canManageTraining ? (
                                    <button
                                      onClick={() => moveToWaitingEval(r)}
                                      className="license-btn license-btn-primary"
                                      style={{ padding: "4px 10px", fontSize: "11px", borderRadius: "6px" }}
                                    >
                                      Chờ đánh giá
                                    </button>
                                  ) : <span style={{ color: "var(--cn-text-secondary)", fontSize: "12px" }}>Chờ đánh giá</span>}
                                </div>
                              ) : (
                                isEvaluator ? (
                                  <button
                                    onClick={() => { setTrainingPanel(null); startEvaluation(r); }}
                                    className="license-btn license-btn-primary"
                                    style={{ padding: "4px 10px", fontSize: "11px", borderRadius: "6px" }}
                                  >
                                    Đánh giá
                                  </button>
                                ) : <span style={{ color: "var(--cn-text-secondary)", fontSize: "12px" }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
