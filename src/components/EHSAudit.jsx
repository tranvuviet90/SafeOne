// File: DailyAudit.jsx (Phiên bản đã sửa lỗi hoàn chỉnh)
// Đã có key={dep.name} và các sửa lỗi khác.

import React, { useState, useEffect, useRef } from "react";
import dbService from "../services/dbService";
import apiClient from "../services/apiClient";
import imageCompression from "browser-image-compression";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { colors } from "../theme";
import { useI18n } from "../i18n/I18nProvider";
import LightboxSwipeOnly, { useConfirm } from "./LightboxSwipeOnly";
import { callSpellCheckService } from "../utils/aiAdapter";
import realtimeService from "../services/realtimeService";

/* ====================== BIỂU TƯỢNG (ICON) ====================== */
// Hiển thị nhãn mức độ nghiêm trọng theo ngôn ngữ, nhưng GIỮ giá trị lưu trữ là tiếng Việt
// (giá trị này còn dùng làm khóa cho pointsMap nên không được đổi).
const severityLabel = (t, s) => {
  const map = { "Nhẹ": "ehs.severity.light", "Trung bình": "ehs.severity.medium", "Nặng": "ehs.severity.heavy", "Nghiêm trọng": "ehs.severity.critical" };
  return map[s] ? t(map[s]) : s;
};

function ImprovementIcon({ color = 'currentColor', size = 18 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
    </svg>
  );
}

import { GEMBA_DEPARTMENTS } from "../constants/roles";

/* ====================== CẤU HÌNH ====================== */
const departments = GEMBA_DEPARTMENTS;

function calcHeSo(people) {
  if (people < 20) return 5; if (people <= 50) return 4;
  if (people <= 70) return 3; if (people <= 100) return 2;
  return 1;
}

const errorGroups = [
  { group: "Bảo hộ lao động (PPE)", items: [ { code: "1.1", desc: "Không sử dụng hoặc sử dụng không đúng loại BHLĐ", point: 4 }, { code: "1.2", desc: "Sử dụng BHLĐ không đúng quy cách/ sai mục đích", point: 4 }, { code: "1.3", desc: "Không bảo quản BHLĐ/ Để không đúng vị trí", point: 2 }, { code: "1.4", desc: "BHLĐ không được vệ sinh định kỳ/ dơ bẩn", point: 2 }, { code: "1.5", desc: "BHLĐ không được thay mới khi đến kỳ/ không có thời gian theo dõi", point: 4 }, { code: "1.other", desc: "Lỗi khác (PPE)", point: 0 } ] },
  { group: "5S", items: [ { code: "2.1", desc: "Không sàng lọc, loại bỏ các vật dụng không cần thiết", point: 2 }, { code: "2.2", desc: "Không phân loại, sắp xếp, tổ chức các vật dụng, dụng cụ theo trật tự", point: 4 }, { code: "2.3", desc: "Không layout các vị trí quy định như tủ điện, bình chữa cháy, khu vực để dụng cụ làm việc,…", point: 2 }, { code: "2.4", desc: "Layout bị bong tróc", point: 2 }, { code: "2.5", desc: "Không định kỳ vệ sinh khu vực làm việc/ không có lịch vệ sinh", point: 4 }, { code: "2.6", desc: "Vệ Sinh", point: 2 }, { code: "2.7", desc: "Không kiểm tra Checklist 5S", point: 2 }, { code: "2.8", desc: "Dụng cụ vệ sinh để không đúng nơi quy định", point: 2 }, { code: "2.9", desc: "Bộ phận phát sinh bụi bẩn, rác", point: 2 }, { code: "2.other", desc: "Lỗi khác (5S)", point: 0 } ] },
  { group: "Hệ thống điện", items: [ { code: "3.1", desc: "Nguồn điện bị rò rỉ", point: 6 }, { code: "3.2", desc: "Ổ cắm điện bị chảy nhựa", point: 6 }, { code: "3.3", desc: "Tủ điện không được khóa", point: 4 }, { code: "3.4", desc: "Để dụng cụ, hàng hóa che chắn tủ điện", point: 4 }, { code: "3.5", desc: "Đèn báo nguồn của tủ điện không hoạt động", point: 2 }, { code: "3.6", desc: "Máy móc, thiết bị điện không được nối đất", point: 4 }, { code: "3.7", desc: "Dây nối đất không đúng quy cách", point: 2 }, { code: "3.8", desc: "Không có nút che chắn các ổ cắm trống", point: 2 }, { code: "3.9", desc: "Dây điện bị bong tróc", point: 6 }, { code: "3.10", desc: "Dây điện không gọn gàng", point: 4 }, { code: "3.11", desc: "Các vật liệu dễ cháy để gần tủ điện", point: 4 }, { code: "3.12", desc: "Không tắt điện máy móc, thiết bị khi không sử dụng", point: 2 }, { code: "3.13", desc: "Vị trí đấu nối dây không có ống bảo vệ", point: 4 }, { code: "3.14", desc: "Để dụng cụ, vật dụng đè lên dây dẫn điện", point: 4 }, { code: "3.15", desc: "Ổ cắm điện bị đóng bụi không được vệ sinh", point: 4 }, { code: "3.16", desc: "Không tắt đèn khu vực làm việc khi giải lao", point: 4 }, { code: "3.other", desc: "Lỗi khác (Điện)", point: 0 } ] },
  { group: "Dụng cụ", items: [ { code: "4.1", desc: "Dụng cụ làm việc sử dụng không đúng mục đích", point: 4 }, { code: "4.2", desc: "Dụng cụ làm việc để không đúng nơi quy định", point: 4 }, { code: "4.3", desc: "Dụng cụ làm việc có nguy cơ gây mất an toàn", point: 4 }, { code: "4.other", desc: "Lỗi khác (Dụng cụ)", point: 0 } ] },
  { group: "Hóa chất", items: [ { code: "5.1", desc: "Hóa chất không có tem nhãn", point: 4 }, { code: "5.2", desc: "Tem nhãn hóa chất phai mờ, không đọc được thông tin", point: 4 }, { code: "5.3", desc: "Hóa chất không để trong khay chống tràn", point: 4 }, { code: "5.4", desc: "Hóa chất sử dụng xong không đậy nắp", point: 4 }, { code: "5.5", desc: "Hóa chất để chung với các vật liệu, thiết bị dễ cháy nổ", point: 6 }, { code: "5.6", desc: "Hóa chất chất cao có nguy cơ ngã đổ", point: 4 }, { code: "5.7", desc: "Hóa chất lưu trữ không đúng nơi quy định", point: 4 }, { code: "5.8", desc: "Khi di chuyển hóa chất không sử dụng xe đẩy chống tràn", point: 4 }, { code: "5.9", desc: "Tủ lưu trữ hóa chất rách, bong tróc, không có danh sách lưu trữ", point: 2 }, { code: "5.10", desc: "Kệ/ phuy sang chiết hóa chất/ thùng khuấy sơn không có dây nối đất", point: 4 }, { code: "5.11", desc: "Để rò rỉ hóa chất ra ngoài không vệ sinh, môi trường", point: 4 }, { code: "5.12", desc: "Lưu trữ các thùng carton, vật liệu dễ cháy nổ trong kho hóa chất", point: 4 }, { code: "5.13", desc: "Sử dụng hóa chất cấm khi chưa được EHS kiểm tra", point: 4 }, { code: "5.14", desc: "Hóa chất không có MSDS", point: 6 }, { code: "5.15", desc: "Để nhiễu, chảy tràn hóa chất ra sàn, môi trường", point: 4 }, { code: "5.16", desc: "Hóa chất không được lưu trữ trong các dụng cụ chuyên dụng", point: 4 }, { code: "5.other", desc: "Lỗi khác (Hóa chất)", point: 0 } ] },
  { group: "Biển cảnh báo", items: [ { code: "6.1", desc: "Khu vực nguy hiểm không có cảnh báo", point: 4 }, { code: "6.2", desc: "Sử dụng không đúng cảnh báo", point: 2 }, { code: "6.3", desc: "Bảng/băng/dây cảnh báo bị mờ, bong tróc", point: 2 }, { code: "6.4", desc: "Cảnh báo dơ bẩn không được vệ sinh", point: 4 }, { code: "6.5", desc: "Để đồ che chắn cảnh báo", point: 4 }, { code: "6.6", desc: "Vị trí sửa chữa nguy hiểm không có cảnh báo", point: 6 }, { code: "6.7", desc: "Không LOTO trước khi sửa chữa", point: 4 }, { code: "6.8", desc: "Không thông báo làm việc tia lửa, trên cao…", point: 6 }, { code: "6.9", desc: "Không treo cảnh báo khi sạc xe nâng", point: 4 }, { code: "6.10", desc: "Nguồn điện cao không có cảnh báo", point: 4 }, { code: "6.11", desc: "Không treo cảnh báo khi dùng thang/ sai thời gian", point: 4 }, { code: "6.12", desc: "Không khóa cửa thang khi không dùng", point: 4 }, { code: "6.13", desc: "Vị trí có hố sâu không có rào/cảnh báo", point: 4 }, { code: "6.other", desc: "Lỗi khác (Cảnh báo)", point: 0 } ] },
  { group: "Phân loại rác", items: [ { code: "7.1", desc: "Không tiến hành phân loại rác", point: 6 }, { code: "7.2", desc: "Phân loại rác không đúng quy định", point: 4 }, { code: "7.other", desc: "Lỗi khác (Rác)", point: 0 } ] },
  { group: "Phòng cháy chữa cháy", items: [ { code: "8.1", desc: "Không trang bị bình chữa cháy", point: 6 }, { code: "8.2", desc: "Che chắn lối thoát hiểm", point: 6 }, { code: "8.3", desc: "Che chắn bình/tủ chữa cháy", point: 6 }, { code: "8.4", desc: "Che chắn nút kéo chuông báo cháy", point: 4 }, { code: "8.5", desc: "Dụng cụ chữa cháy dùng sai mục đích", point: 4 }, { code: "8.6", desc: "Vật liệu dễ cháy gần nguồn nhiệt", point: 4 }, { code: "8.7", desc: "Không kiểm tra PCCC định kỳ tháng", point: 4 }, { code: "8.8", desc: "Tự ý di dời/để bình sai nơi quy định", point: 4 }, { code: "8.other", desc: "Lỗi khác (PCCC)", point: 0 } ] },
  { group: "Máy móc", items: [ { code: "9.1", desc: "Máy không có SOP", point: 6 }, { code: "9.2", desc: "SOP không cập nhật mới", point: 4 }, { code: "9.3", desc: "Che chắn thông tin SOP", point: 4 }, { code: "9.4", desc: "Tem nhãn hướng dẫn rách/bong", point: 4 }, { code: "9.5", desc: "Nút điều khiển không có tiếng Việt", point: 4 }, { code: "9.6", desc: "Thiết bị chuyển động không có hộp bảo vệ", point: 6 }, { code: "9.7", desc: "Không tắt máy khi không sử dụng", point: 4 }, { code: "9.9", desc: "Không tắt điện/nước khi không làm việc", point: 4 }, { code: "9.10", desc: "Che chắn Sensor an toàn", point: 6 }, { code: "9.11", desc: "Không có DS nhân viên vận hành lò", point: 4 }, { code: "9.12", desc: "Thiết bị hư không báo sửa chữa", point: 4 }, { code: "9.14", desc: "Không kiểm tra quạt", point: 2 }, { code: "9.15", desc: "Không kiểm tra trước khi vận hành", point: 4 }, { code: "9.16", desc: "Không có thẻ CNVH khi dùng vật sắc", point: 4 }, { code: "9.17", desc: "Chưa đào tạo chứng nhận vận hành", point: 6 }, { code: "9.other", desc: "Lỗi khác (Máy móc)", point: 0 } ] },
  { group: "Nguyên vật liệu", items: [ { code: "10.1", desc: "Chất cao >1m5 không quấn PE", point: 4 }, { code: "10.2", desc: "Nguyên liệu không để trên pallet", point: 2 }, { code: "10.3", desc: "Khiêng vật liệu nặng 1 người", point: 4 }, { code: "10.4", desc: "Thùng móp bể không thay/ chất lẫn kích thước", point: 4 }, { code: "10.5", desc: "Không có dây đai chống ngã nguyên liệu", point: 4 }, { code: "10.6", desc: "Chất hàng không đúng quy định/không gọn", point: 2 }, { code: "10.7", desc: "Di chuyển VL không dùng dây đai cố định", point: 4 }, { code: "10.8", desc: "Không cố định cuộn nguyên liệu", point: 4 }, { code: "10.other", desc: "Lỗi khác (Nguyên vật liệu)", point: 0 } ] },
  { group: "Hành vi không an toàn", items: [ { code: "11.1", desc: "Cố ý làm hư máy móc thiết bị", point: 6 }, { code: "11.2", desc: "Cố ý làm hư phương tiện PCCC", point: 6 }, { code: "11.3", desc: "Leo cao không dùng dây đai", point: 6 }, { code: "11.4", desc: "Dụng cụ tự chế nguy hiểm", point: 4 }, { code: "11.5", desc: "Mang bật lửa/thuốc lá nơi dễ cháy", point: 6 }, { code: "11.6", desc: "Hút thuốc khu vực cấm", point: 6 }, { code: "11.7", desc: "Cố ý làm mất chức năng an toàn", point: 6 }, { code: "11.8", desc: "Tự ý đổi thao tác/quy trình/kết cấu", point: 6 }, { code: "11.9", desc: "Đưa tay vào thiết bị chuyển động", point: 6 }, { code: "11.10", desc: "Dùng ĐT cá nhân/đeo tai phone khi làm", point: 4 }, { code: "11.11", desc: "Không cuộn gọn tóc vào nón khi vận hành", point: 4 }, { code: "11.12", desc: "Phát hiện hư không báo sửa", point: 4 }, { code: "11.13", desc: "Tự ý tháo cover/che chắn sensor", point: 6 }, { code: "11.14", desc: "Không hướng dẫn NV mới theo AT", point: 6 }, { code: "11.15", desc: "Không hướng dẫn giám sát AT nhà thầu", point: 6 }, { code: "11.16", desc: "Lưu trữ vật nguy hiểm ở tủ cá nhân", point: 6 }, { code: "11.17", desc: "Vứt rác/khạc nhổ bừa bãi", point: 4 }, { code: "11.other", desc: "Lỗi khác (Hành vi)", point: 0 } ] },
  { group: "Thái độ hợp tác", items: [ { code: "12.1", desc: "Không hợp tác xử lý an toàn", point: 6 }, { code: "12.2", desc: "Thái độ đe dọa", point: 6 }, { code: "12.3", desc: "Đánh người", point: 6 }, { code: "12.4", desc: "QL không xử lý vi phạm của nhân viên", point: 6 }, { code: "12.other", desc: "Lỗi khác (Thái độ)", point: 0 } ] },
  { group: "Lỗi Khác", items: []},
];

const Timestamp = {
  fromDate(date) {
    return date.toISOString();
  },
  now() {
    return new Date().toISOString();
  }
};

/* =========================
   Hàm hỗ trợ ảnh và thời gian
   ========================= */
async function fetchAsDataURL(url) {
  try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
  } catch (e) {
      console.error("Error fetching data URL:", e);
      return null;
  }
}

async function makeThumbDataURL(url, maxW = 96, maxH = 96, quality = 0.55) {
  try {
    const dataUrl = await fetchAsDataURL(url);
    if (!dataUrl) return url;
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = dataUrl;
    });
    const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
    const w = Math.max(1, Math.round(img.width * ratio));
    const h = Math.max(1, Math.round(img.height * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return url;
  }
}

const safeTsToDate = (ts) => {
    if (!ts) return null;
    let result = null;
    if (ts.seconds) {
        result = new Date(ts.seconds * 1000);
    } else if (ts instanceof Date) {
        result = ts;
    } else if (typeof ts === 'string') {
        const d = new Date(ts);
        if (!isNaN(d.getTime())) {
            result = d;
        } else {
            const parts = ts.match(/(\d+)/g);
            if (parts && parts.length === 6) {
                const [h, m, s, day, month, year] = parts.map(Number);
                result = new Date(year, month - 1, day, h, m, s);
            }
        }
    } else {
        const n = Number(ts);
        if (!Number.isNaN(n)) result = new Date(n);
    }
    if (result && !isNaN(result.getTime())) return result;
    return null;
};

const parseDateStr = (s) => {
  if (!s) return null;
  const parts = s.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts.map(Number);
    return new Date(y, m - 1, d);
  }
  const dateObj = new Date(s);
  return isNaN(dateObj.getTime()) ? null : dateObj;
};

const formatDateStr = (d) => {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const toRelativeUploadUrl = (url) => {
  if (!url || typeof url !== "string") return url;
  const idx = url.indexOf("/uploads/");
  return idx >= 0 ? url.slice(idx) : url;
};

const normalizeEvent = (ev) => {
  if (!ev) return null;
  if (ev.error && typeof ev.error === 'object') {
    const { error: _error, ...top } = ev;
    return {
      ...ev.error,
      ...top,
      id: ev.id || ev.uid,
      timestamp: ev.timestamp || ev.error.timestamp,
    };
  }
  return { id: ev.id || ev.uid, ...ev };
};

/* =========================
   ExportModal
   ========================= */
function ExportModal({ onClose, departments }) {
  const { t } = useI18n();
  const [dateRange, setDateRange] = useState([null, null]);
  const [startDate, endDate] = dateRange;
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedDept, setSelectedDept] = useState("all");

  const getDateRange = () => {
    if (!startDate || !endDate) throw new Error("Vui lòng chọn ngày bắt đầu và kết thúc.");
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    const label = `${startDate.toISOString().slice(0, 10)}_to_${endDate.toISOString().slice(0, 10)}`;
    return { start, end, label };
  };

  const exportCAP = async (rows, label, department) => {
    const [{ default: ExcelJS }, { saveAs }] = await Promise.all([ import("exceljs"), import("file-saver") ]);
    const resp = await fetch("/templates/CAP.xlsx", { cache: "no-store" });
    if (!resp.ok) throw new Error("Không tìm thấy template CAP.xlsx");
    const buf = await resp.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.getWorksheet("Sheet1") || wb.worksheets[0];
    if (!ws) throw new Error("Template CAP.xlsx thiếu Sheet1.");
    
    const baseWidths = [6, 30, 15, 18, 22, 20, 35, 15, 18, 20, 31.29, 31.29, 22, 20];
    for (let idx = 0; idx < 20; idx++) {
      ws.getColumn(idx + 1).width = idx < baseWidths.length ? baseWidths[idx] : 31.29;
    }

    let rowIndex = 7;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const findings = r.note || r.desc;
      
      const borderThin = {
        left: { style: 'thin', color: { auto: true } },
        right: { style: 'thin', color: { auto: true } },
        top: { style: 'thin', color: { auto: true } },
        bottom: { style: 'thin', color: { auto: true } }
      };

      for (let c = 1; c <= 20; c++) {
        const cell = ws.getCell(rowIndex, c);
        cell.border = borderThin;
        cell.font = { name: 'Times New Roman', size: 11 };
        if (c === 2 || c === 7 || c === 13 || c === 14) {
          cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        } else {
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        }
      }

      let progressStatus = "Chưa tiến hành";
      let ehsComment = "";

      const hasImprovementInfo = r.pic || r.dueDate || r.progressNotes || r.afterUrl;

      if (r.ehsVerified) {
        progressStatus = "Đã hoàn thành";
      } else {
        if (r.dueDate) {
          const limitDate = parseDateStr(r.dueDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (limitDate) {
            limitDate.setHours(0, 0, 0, 0);
            if (today > limitDate) {
              progressStatus = "Trễ hạn hoàn thành";
            } else if (hasImprovementInfo) {
              progressStatus = "Đang tiến hành";
            }
          } else if (hasImprovementInfo) {
            progressStatus = "Đang tiến hành";
          }
        } else if (hasImprovementInfo) {
          progressStatus = "Đang tiến hành";
        }
      }

      if (r.dueDateHistory && r.dueDateHistory.length > 0) {
        const historyText = r.dueDateHistory.join('\n');
        ehsComment = ehsComment ? `${ehsComment}\n${historyText}` : historyText;
      }

      ws.getCell(rowIndex, 1).value = i + 1;
      ws.getCell(rowIndex, 2).value = findings;
      ws.getCell(rowIndex, 3).value = r.ca ? `${r.dateISO}\nCa: ${r.ca}` : r.dateISO;
      ws.getCell(rowIndex, 4).value = r.addedBy || "";
      ws.getCell(rowIndex, 5).value = r.department || "";
      ws.getCell(rowIndex, 6).value = r.responsiblePerson || "";
      ws.getCell(rowIndex, 7).value = r.progressNotes || "";
      ws.getCell(rowIndex, 8).value = r.pic || "";
      ws.getCell(rowIndex, 9).value = progressStatus;
      ws.getCell(rowIndex, 10).value = r.dueDate || "";
      ws.getCell(rowIndex, 13).value = "";
      ws.getCell(rowIndex, 14).value = ehsComment;

      let imageAdded = false;
      const processImage = async (url, col) => {
        if (!url) return;
        const b64 = await fetchAsDataURL(url);
        if (b64) {
          const imgId = wb.addImage({ base64: b64.split(',')[1], extension: "png" });
          const img = new Image();
          await new Promise(resolve => { 
            img.onload = resolve; 
            img.onerror = resolve;
            img.src = b64; 
          });
          if (img.width && img.height) {
            const maxWidth = 224, maxHeight = 167;
            const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
            const newWidth = img.width * ratio, newHeight = img.height * ratio;
            const xOffset = (maxWidth - newWidth) / 2, yOffset = (maxHeight - newHeight) / 2;
            ws.addImage(imgId, { tl: { col: col - 1 + (xOffset / maxWidth), row: rowIndex - 1 + (yOffset / maxHeight) }, ext: { width: newWidth, height: newHeight } });
            imageAdded = true;
          }
        }
      };

      const beforeImages = r.imageUrls && r.imageUrls.length > 0 ? r.imageUrls : (r.beforeUrl ? [r.beforeUrl] : []);
      for (let j = 0; j < beforeImages.length; j++) {
        const url = beforeImages[j];
        if (j === 0) {
          await processImage(url, 11);
        } else {
          const col = 15 + (j - 1);
          await processImage(url, col);
        }
      }
      
      if (r.afterUrl) {
        await processImage(r.afterUrl, 12);
      }

      if (imageAdded) ws.getRow(rowIndex).height = 125.25;
      rowIndex++;
    }
    const fileNameDept = department === 'all' ? 'ToanBo' : department;
    const out = await wb.xlsx.writeBuffer();
    saveAs(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `CAP_${fileNameDept}_${label}.xlsx`);
  };
  
  const exportBangChamDiem = async (rows, label, allDeptData) => {
    const [{ default: ExcelJS }, { saveAs }] = await Promise.all([ import("exceljs"), import("file-saver"), ]);
    const resp = await fetch("/templates/BangChamDiem.xlsx", { cache: "no-store" });
    if (!resp.ok) throw new Error("Không tìm thấy template BangChamDiem.xlsx");
    const buf = await resp.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);

    const groupLayout = [
      { group: "Bảo hộ lao động (PPE)", startRow: 5,  defaultRows: 4 },
      { group: "5S",                     startRow: 9,  defaultRows: 3 },
      { group: "Hệ thống điện",          startRow: 12, defaultRows: 3 },
      { group: "Dụng cụ",                startRow: 15, defaultRows: 3 },
      { group: "Hóa chất",               startRow: 18, defaultRows: 3 },
      { group: "Biển cảnh báo",          startRow: 21, defaultRows: 3 },
      { group: "Phân loại rác",          startRow: 24, defaultRows: 3 },
      { group: "Phòng cháy chữa cháy",   startRow: 27, defaultRows: 3 },
      { group: "Máy móc",                startRow: 30, defaultRows: 3 },
      { group: "Nguyên vật liệu",        startRow: 33, defaultRows: 2 },
      { group: "Hành vi không an toàn",  startRow: 35, defaultRows: 3 },
      { group: "Thái độ hợp tác",        startRow: 38, defaultRows: 1 },
      { group: "__KHAC__",               startRow: 39, defaultRows: 1 },
    ];
    const ORIGINAL_TOTAL_ROW = 40;

    const byDeptWithErrors = new Map();
    rows.forEach(r => {
      if (!byDeptWithErrors.has(r.department)) byDeptWithErrors.set(r.department, []);
      byDeptWithErrors.get(r.department).push(r);
    });

    for (const dept of departments) {
      const depName = dept.name;
      const ws = wb.getWorksheet(depName);
      if (!ws) continue;
      const currentDeptData = allDeptData.get(depName);
      const peopleCount = currentDeptData?.people !== undefined ? currentDeptData.people : dept.defaultPeople;
      const heSo = calcHeSo(peopleCount);
      ws.getCell('C3').value = depName;
      ws.getCell('E3').value = peopleCount;
      ws.getCell('G3').value = heSo;

      const deptRows = byDeptWithErrors.get(depName) || [];

      const violationsByGroup = new Map();
      deptRows.forEach(r => {
        const grp = r.group || "Khác";
        if (!violationsByGroup.has(grp)) violationsByGroup.set(grp, new Map());
        const codeMap = violationsByGroup.get(grp);
        const key = r.code || `custom-${r.desc}`;
        if (!codeMap.has(key)) {
          codeMap.set(key, { count: 0, desc: r.desc, basePoint: r.basePoint, adjusted: r.adjusted, notes: [] });
        }
        const entry = codeMap.get(key);
        entry.count += 1;
        entry.adjusted = r.adjusted;
        if (r.note) entry.notes.push(r.note);
      });

      const violationsListByGroup = new Map();
      violationsByGroup.forEach((codeMap, grp) => {
        violationsListByGroup.set(grp, Array.from(codeMap.values()));
      });
      const khacList = [
        ...(violationsListByGroup.get("Khác") || []),
        ...(violationsListByGroup.get("Lỗi Khác") || []),
      ];
      if (khacList.length > 0) violationsListByGroup.set("__KHAC__", khacList);

      let rowOffset = 0;
      let lastDataRow = ORIGINAL_TOTAL_ROW - 1;

      for (const layout of groupLayout) {
        const actualStartRow = layout.startRow + rowOffset;
        const violations = violationsListByGroup.get(layout.group) || [];
        const extraRows = Math.max(0, violations.length - layout.defaultRows);

        if (extraRows > 0) {
          const insertAt = actualStartRow + layout.defaultRows;
          for (let i = 0; i < extraRows; i++) {
            ws.spliceRows(insertAt + i, 0, []);
          }
          rowOffset += extraRows;
          lastDataRow += extraRows;
        }

        violations.forEach((v, idx) => {
          const targetRow = actualStartRow + idx;
          ws.getCell(`C${targetRow}`).value = v.count;
          ws.getCell(`D${targetRow}`).value = v.desc;
          ws.getCell(`E${targetRow}`).value = v.basePoint;
          ws.getCell(`F${targetRow}`).value = v.adjusted;
          ws.getCell(`G${targetRow}`).value = { formula: `C${targetRow}*F${targetRow}` };
          if (v.notes.length > 0) {
            ws.getCell(`H${targetRow}`).value = v.notes.join('\n');
            ws.getCell(`H${targetRow}`).alignment = { wrapText: true, vertical: 'top' };
          }
        });
      }

      const totalRow = lastDataRow + 1;
      const scoreRow = lastDataRow + 2;
      ws.getCell(`G${totalRow}`).value = { formula: `SUM(G5:G${lastDataRow})` };
      ws.getCell(`G${scoreRow}`).value = { formula: `100-G${totalRow}` };
    }

    const out = await wb.xlsx.writeBuffer();
    saveAs(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `BangChamDiem_${label}.xlsx`);
  };

  const handleExport = async (mode) => {
    if (!startDate || !endDate) {
      alert(t("ehs.export.selectDateFirst"));
      return;
    }
    setIsGenerating(true);
    try {
      const { start, end, label } = getDateRange();

      const allEvents = await dbService.getDocs("gemba_events");
      const filteredEvents = allEvents.filter(ev => {
        if (ev.is_deleted) return false;
        const ts = safeTsToDate(ev.timestamp);
        if (!ts) return false;
        const matchesDate = ts >= start && ts <= end;
        const matchesDept = selectedDept === 'all' || ev.department === selectedDept;
        return matchesDate && matchesDept;
      });

      if (filteredEvents.length === 0) {
        alert(t("ehs.export.noData"));
        setIsGenerating(false); return;
      }

      const allScoresDocs = await dbService.getDocs("gemba_scores");

      const rows = [];
      filteredEvents.forEach((ev) => {
        const normalized = normalizeEvent(ev);
        if (!normalized) return;
        const ts = safeTsToDate(normalized.timestamp);
        const dateISO = ts ? ts.toISOString().slice(0, 10) : "";
        const deptDoc = allScoresDocs.find(d => (d.id || d.uid) === normalized.department);
        const deptPeople = deptDoc?.people !== undefined
          ? deptDoc.people
          : (departments.find(d => d.name === normalized.department)?.defaultPeople ?? 0);
        const eventHeSo = Number.isFinite(normalized.heSo) ? normalized.heSo : calcHeSo(deptPeople);

        rows.push({
          dateISO,
          department: normalized.department || "",
          ...normalized,
          ca: normalized.ca || "",
          basePoint: Number.isFinite(normalized.point) ? normalized.point : 0,
          heSo: eventHeSo,
          adjusted: Number(((normalized.point + eventHeSo) / 2).toFixed(2)),
          addedBy: normalized.addedBy || "",
          beforeUrl: (normalized.imageUrls && normalized.imageUrls[0]) || normalized.imageUrl || "",
          imageUrls: normalized.imageUrls || [],
          afterUrl: normalized.improvementImageUrl || "",
        });
      });

      if (mode === "cap") {
        rows.sort((a, b) => {
          const deptA = (a.department || "").toLowerCase();
          const deptB = (b.department || "").toLowerCase();
          return deptA.localeCompare(deptB, 'vi');
        });
        await exportCAP(rows, label, selectedDept);
      } else {
        const allDeptData = new Map();
        departments.forEach(dept => {
          const deptDoc = allScoresDocs.find(d => (d.id || d.uid) === dept.name);
          const people = deptDoc?.people !== undefined ? deptDoc.people : dept.defaultPeople;
          allDeptData.set(dept.name, { people });
        });
        await exportBangChamDiem(rows.filter(r => !r.isReminder), label, allDeptData);
      }
    } catch (err) {
      console.error("Có lỗi khi xuất báo cáo:", err);
      alert(`${t("gemba.alert.exportFail")} ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1200 }}>
      <div style={{ background: colors.surface, padding: 22, borderRadius: 12, width: 520, boxShadow: "0 4px 15px rgba(0,0,0,.2)" }}>
        <h3 style={{ marginTop: 0, color: colors.primary }}>{t("ehs.export.title")}</h3>
        <div style={{ display: 'grid', gap: '15px' }}>
          <div>
            <label style={{ fontWeight: 700, color: colors.textPrimary, display: 'block', marginBottom: 5 }}>{t("ehs.export.dateRange")}</label>
            <DatePicker
              selectsRange={true}
              startDate={startDate}
              endDate={endDate}
              onChange={(update) => setDateRange(update)}
              isClearable={true}
              dateFormat="dd/MM/yyyy"
              placeholderText={t("ehs.required")}
              className="date-picker-input"
              wrapperClassName="date-picker-wrapper"
            />
          </div>
          <div>
            <label style={{ fontWeight: 700, color: colors.textPrimary, display: 'block', marginBottom: 5 }}>{t("ehs.export.selectDeptCap")}</label>
            <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)} className="date-picker-input">
              <option value="all">{t("ehs.export.allDepts")}</option>
              {departments.map(dept => <option key={dept.name} value={dept.name}>{dept.name}</option>)}
            </select>
          </div>
        </div>
        <style>{`.date-picker-wrapper{width:100%}.date-picker-input{width:100%;padding:8px;border-radius:6px;border:1px solid ${colors.border};box-sizing:border-box}`}</style>
        <div style={{ display: "flex", gap: 12, marginTop: 20, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button onClick={onClose} disabled={isGenerating} style={{ padding: "8px 16px", borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.background, cursor: "pointer" }}>{t("common.cancel")}</button>
          <button onClick={() => handleExport("bang")} disabled={isGenerating} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: colors.success, color: colors.white, fontWeight: 700, cursor: "pointer" }}>{isGenerating ? t("ehs.processing") : t("ehs.export.btnScoreSheet")}</button>
          <button onClick={() => handleExport("cap")} disabled={isGenerating} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#1f80e0", color: colors.white, fontWeight: 700, cursor: "pointer" }}>{isGenerating ? t("ehs.processing") : t("ehs.export.btnCap")}</button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   CỬA SỔ (MODAL) CẢI THIỆN
   ========================= */
function ImprovementModal({ modalData, onClose, onSave, canConfirm, onViewImage }) {
  const { t } = useI18n();
  const [pic, setPic] = useState(modalData.error?.pic || "");
  const [dueDate, setDueDate] = useState(modalData.error?.dueDate || "");
  const [progressNotes, setProgressNotes] = useState(modalData.error?.progressNotes || "");
  const [ehsVerified, setEhsVerified] = useState(modalData.error?.ehsVerified || false);
  const [improvementImageFile, setImprovementImageFile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const savedImageUrl = toRelativeUploadUrl(modalData.error?.improvementImageUrl);

  const handleImageChange = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const opt = { maxSizeMB: 2, maxWidthOrHeight: 1920, useWebWorker: true };
      try {
        const processed = file.size > opt.maxSizeMB * 1024 * 1024 ? await imageCompression(file, opt) : file;
        setImprovementImageFile(processed);
      } catch (err) {
        console.error("Lỗi nén ảnh cải thiện:", err);
        alert(t("ehs.improve.imageProcessError"));
        setImprovementImageFile(null);
      }
    } else {
      setImprovementImageFile(null);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    let imageUrl = toRelativeUploadUrl(modalData.error?.improvementImageUrl) || null;
    if (improvementImageFile) {
      try {
        const formData = new FormData();
        formData.append("file", improvementImageFile);
        formData.append("path", `gemba_improvement_images/${Date.now()}_${improvementImageFile.name}`);
        const res = await apiClient.post("/api/storage/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        imageUrl = res.data.url;
      } catch (error) {
        console.error("Lỗi tải ảnh cải thiện: ", error);
        alert(t("ehs.improve.uploadFail"));
        setIsSaving(false);
        return;
      }
    }
    const improvementData = { pic, dueDate, progressNotes, ehsVerified, improvementImageUrl: imageUrl };
    await onSave(modalData.logId, improvementData);
    setIsSaving(false);
    onClose();
  };

  const inputStyle = { width: '100%', padding: 8, borderRadius: 6, border: `1px solid ${colors.border}`, marginTop: 5, boxSizing: 'border-box' };
  const labelStyle = { fontWeight: 600, color: '#333' };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1001 }}>
      <div style={{ background: colors.surface, padding: 22, borderRadius: 12, width: '90%', maxWidth: 550, boxShadow: "0 4px 15px rgba(0,0,0,.2)" }}>
        <h3 style={{ marginTop: 0, color: colors.primary, borderBottom: `2px solid ${colors.primaryLight}`, paddingBottom: 10 }}>{t("ehs.improve.title")}</h3>
        <p><b>{t("ehs.errorColon")}</b> {modalData.error.desc}</p>
        <div style={{ display: 'grid', gap: 12 }}>
          <div> <label style={labelStyle}>P.I.C</label> <input type="text" value={pic} onChange={e => setPic(e.target.value)} style={inputStyle} placeholder={t("ehs.improve.picPlaceholder")} /> </div>
          <div>
            <label style={labelStyle}>{t("ehs.improve.dueDate")}</label>
            <DatePicker
              selected={dueDate ? parseDateStr(dueDate) : null}
              onChange={(date) => setDueDate(formatDateStr(date))}
              dateFormat="dd/MM/yyyy"
              placeholderText="dd/mm/yyyy"
              className="date-picker-input"
              customInput={<input style={inputStyle} />}
            />
          </div>
          <div> <label style={labelStyle}>{t("ehs.improve.measure")}</label> <textarea value={progressNotes} onChange={e => setProgressNotes(e.target.value)} style={{...inputStyle, minHeight: 70}} /> </div>
          <div style={{ marginTop: 4 }}>
            {canConfirm ? (
              <button
                type="button"
                onClick={() => setEhsVerified(v => !v)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                  fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 8,
                  border: ehsVerified ? '1px solid #388e3c' : `1px solid ${colors.border}`,
                  background: ehsVerified ? '#4caf50' : colors.background,
                  color: ehsVerified ? colors.white : colors.textPrimary,
                }}
              >
                {ehsVerified ? `✓ ${t("ehs.improve.confirmedDone")}` : t("ehs.improve.confirmDone")}
              </button>
            ) : (
              <div style={{
                padding: '10px 14px', borderRadius: 8, fontWeight: 700, fontSize: 14,
                textAlign: 'center',
                background: ehsVerified ? '#e8f5e9' : colors.background,
                color: ehsVerified ? '#2e7d32' : colors.textSecondary,
                border: `1px solid ${ehsVerified ? '#a5d6a7' : colors.border}`,
              }}>
                {ehsVerified ? `✓ ${t("ehs.improve.statusConfirmed")}` : t("ehs.improve.statusPending")}
              </div>
            )}
          </div>
          <div>
            <label style={labelStyle}>{t("ehs.improve.photo")}</label>
            <input type="file" accept="image/*" onChange={handleImageChange} style={{...inputStyle, padding: 5}} />
            {savedImageUrl && !improvementImageFile && (
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 12, color: colors.textSecondary, display: 'block', marginBottom: 4 }}>{t("ehs.improve.photoSaved")}</span>
                <img
                  src={savedImageUrl}
                  alt={t("ehs.improve.photo")}
                  onClick={() => onViewImage?.(savedImageUrl)}
                  style={{ maxWidth: '100%', maxHeight: 150, borderRadius: 6, border: `1px solid ${colors.border}`, display: 'block', objectFit: 'contain', cursor: 'zoom-in' }}
                />
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 20, justifyContent: "flex-end" }}>
          <button onClick={onClose} disabled={isSaving} style={{ padding: "8px 16px", borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.background, cursor: "pointer" }}>{t("common.cancel")}</button>
          <button onClick={handleSave} disabled={isSaving} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: colors.primary, color: colors.white, fontWeight: 700, cursor: "pointer" }}> {isSaving ? t("ehs.saving") : t("ehs.improve.saveChanges")} </button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   GembaReportDashboard
   ========================= */
function GembaReportDashboard({ onClose, onExport, departments, allDeptScores, selectedMonth: initialMonth, calcHeSo, isMobile }) {
  const { t } = useI18n();
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, dept: null, side: 'top' });
  const [activeMonth, setActiveMonth] = useState(initialMonth);
  const [animated, setAnimated] = useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 60);
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => {
    setAnimated(false);
    const t = setTimeout(() => setAnimated(true), 60);
    return () => clearTimeout(t);
  }, [activeMonth]);

  const calcStats = (month) => departments.map((dept) => {
    const data = allDeptScores[dept.name] || {};
    const scores = data.scores || [];
    const people = data.people !== undefined ? data.people : dept.defaultPeople;
    const heSo = calcHeSo(people);
    const monthScores = scores.filter((s) => {
      const d = safeTsToDate(s.timestamp);
      return d && !isNaN(d.getTime()) && d.toISOString().slice(0, 7) === month;
    });
    const totalDeduction = monthScores.reduce((sum, e) => sum + (e.isReminder ? 0 : (e.point + heSo) / 2), 0);
    const remaining = Math.max(0, 100 - totalDeduction);
    const errorCount = monthScores.filter(e => !e.isReminder).length;
    const reminderCount = monthScores.filter(e => e.isReminder).length;
    const groupCounts = {};
    monthScores.filter(e => !e.isReminder).forEach(e => { groupCounts[e.group] = (groupCounts[e.group] || 0) + 1; });
    const topGroups = Object.entries(groupCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { name: dept.name, remaining, errorCount, reminderCount, heSo, people, topGroups, totalDeduction };
  });

  const deptStats = calcStats(activeMonth).sort((a, b) => b.remaining - a.remaining);

  const averageEntry = (() => {
    const cnt = deptStats.length;
    const avgRemaining = cnt ? deptStats.reduce((s, d) => s + d.remaining, 0) / cnt : 0;
    const aggGroupCounts = {};
    deptStats.forEach(d => d.topGroups.forEach(([g, c]) => { aggGroupCounts[g] = (aggGroupCounts[g] || 0) + c; }));
    const avgTopGroups = Object.entries(aggGroupCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return {
      name: 'TB',
      remaining: avgRemaining,
      errorCount: deptStats.reduce((s, d) => s + d.errorCount, 0),
      reminderCount: deptStats.reduce((s, d) => s + d.reminderCount, 0),
      heSo: '-',
      people: deptStats.reduce((s, d) => s + d.people, 0),
      topGroups: avgTopGroups,
      totalDeduction: deptStats.reduce((s, d) => s + d.totalDeduction, 0),
      isAverage: true,
    };
  })();
  const chartStats = deptStats.length ? [...deptStats, averageEntry] : deptStats;

  const AVG_COLORS = { main: '#90a4ae', top: '#b0bec5', side: '#607d8b', light: '#eceff1', score: '#ffffff' };

  const getColors = (score) => {
    if (score >= 90) return { main: '#1565c0', top: '#5b9bd5', side: '#0d47a1', light: '#e3f0ff', score: '#7ec8ff' };
    if (score >= 70) return { main: '#f9a825', top: '#fdd835', side: '#e65100', light: '#fff8e1', score: '#ffe082' };
    return { main: '#c62828', top: '#ef5350', side: '#7f0000', light: '#ffebee', score: '#ff8a80' };
  };

  const monthLabel = t("ehs.report.monthLabel").replace("{month}", activeMonth.slice(5, 7)).replace("{year}", activeMonth.slice(0, 4));

  const handleBarEnter = (e, dept) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const spaceAbove = rect.top;
    const side = spaceAbove < 220 ? 'bottom' : 'top';
    setTooltip({ visible: true, x: rect.left + rect.width / 2, y: side === 'top' ? rect.top : rect.bottom, dept, side });
  };

  const n = chartStats.length;
  const SVG_W = isMobile ? Math.max(320, n * 46) : Math.max(560, n * 72);
  const SVG_H = isMobile ? 260 : 340;
  const PAD_L = isMobile ? 30 : 38;   
  const PAD_R = isMobile ? 10 : 14;
  const PAD_T = isMobile ? 16 : 20;   
  const PAD_B = isMobile ? 44 : 52;   
  const RPT_CHART_H = SVG_H - PAD_T - PAD_B;
  const RPT_BAR_MAX = 100;
  const DX = isMobile ? 6 : 10;
  const DY = isMobile ? 6 : 10;
  const CHART_W = SVG_W - PAD_L - PAD_R;
  const slotW = CHART_W / n;
  const barW = Math.min(isMobile ? 26 : 40, slotW * 0.62);

  const Bar3D = ({ x0, yBase, barH, c, score, deptName, idx, onEnter, onLeave, isAverage }) => {
    const animDelay = idx * 55;
    const animId = `gemba-clip-${idx}`;
    const fx0 = x0, fy0 = yBase - barH, fx1 = x0 + barW;
    const tx0 = fx0,       ty0 = fy0;
    const tx1 = fx1,       ty1 = fy0;
    const tx2 = fx1 + DX,  ty2 = fy0 - DY;
    const tx3 = fx0 + DX,  ty3 = fy0 - DY;
    const rx0 = fx1,       ry0 = fy0;
    const rx1 = fx1 + DX,  ry1 = fy0 - DY;
    const rx2 = fx1 + DX,  ry2 = yBase - DY;
    const rx3 = fx1,       ry3 = yBase;
    const labelY = fy0 + barH / 2;

    return (
      <g
        key={deptName}
        style={{ cursor: 'pointer' }}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        <defs>
          <linearGradient id={`gf${idx}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.top} />
            <stop offset="45%" stopColor={c.main} />
            <stop offset="100%" stopColor={c.main} />
          </linearGradient>
          <clipPath id={animId}>
            <rect x={fx0 - 1} y={yBase - RPT_CHART_H - DY - 2} width={barW + DX + 4} height={RPT_CHART_H + DY + 4}>
              {animated && (
                <animate
                  attributeName="y"
                  from={yBase}
                  to={yBase - RPT_CHART_H - DY - 2}
                  dur="0.55s"
                  body={null}
                  begin={`${animDelay}ms`}
                  fill="freeze"
                  calcMode="spline"
                  keySplines="0.4 0 0.2 1"
                />
              )}
              {animated && (
                <animate
                  attributeName="height"
                  from="0"
                  to={RPT_CHART_H + DY + 4}
                  dur="0.55s"
                  begin={`${animDelay}ms`}
                  fill="freeze"
                  calcMode="spline"
                  keySplines="0.4 0 0.2 1"
                />
              )}
            </rect>
          </clipPath>
        </defs>

        <g clipPath={`url(#${animId})`}>
          <polygon points={`${rx0},${ry0} ${rx1},${ry1} ${rx2},${ry2} ${rx3},${ry3}`} fill={c.side} />
          <polygon points={`${tx0},${ty0} ${tx1},${ty1} ${tx2},${ty2} ${tx3},${ty3}`} fill={c.top} />
          <rect x={fx0} y={fy0} width={barW} height={barH} fill={`url(#gf${idx})`} stroke={isAverage ? '#ffffff' : 'none'} strokeWidth={isAverage ? 1.5 : 0} strokeDasharray={isAverage ? '4 3' : '0'} />
        </g>

        {barH >= 22 && (
          <text
            x={fx0 + barW / 2}
            y={labelY + (isMobile ? 4 : 5)}
            textAnchor="middle"
            fill="#fff"
            fontWeight="800"
            fontSize={isMobile ? 9 : 12}
            fontFamily="sans-serif"
            style={{ pointerEvents: 'none', userSelect: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}
          >
            {score}
          </text>
        )}
        {barH < 22 && (
          <text
            x={fx0 + barW / 2}
            y={fy0 - DY - 4}
            textAnchor="middle"
            fill={c.top}
            fontWeight="800"
            fontSize={isMobile ? 9 : 11}
            fontFamily="sans-serif"
            style={{ pointerEvents: 'none' }}
          >
            {score}
          </text>
        )}

        <text
          x={fx0 + barW / 2 + DX / 2}
          y={yBase + (isMobile ? 13 : 16)}
          textAnchor="middle"
          fill={isAverage ? '#cfd8e3' : '#7a9ac8'}
          fontWeight="700"
          fontSize={isMobile ? 8 : 10}
          fontFamily="sans-serif"
          fontStyle={isAverage ? 'italic' : 'normal'}
          style={{ pointerEvents: 'none' }}
        >
          {deptName.length > 8 ? deptName.slice(0, 7) + '…' : deptName}
        </text>
      </g>
    );
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(8,16,36,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 8 : 24, backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'linear-gradient(160deg,#1a2540 0%,#0f1c38 100%)', borderRadius: 22, width: '100%', maxWidth: 1040, maxHeight: '94vh', overflowY: 'auto', overflowX: 'hidden', boxShadow: '0 16px 64px rgba(0,0,0,0.55)', padding: isMobile ? '16px 10px 20px' : '28px 36px 32px', position: 'relative' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: isMobile ? 16 : 21, color: '#e8f0fe', letterSpacing: '-0.3px' }}>
              {t("ehs.report.title")}{monthLabel}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="month"
              value={activeMonth}
              onChange={e => setActiveMonth(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid #2e4070', background: '#1e2e54', color: '#c8d8f8', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            />
            <button
              onClick={onExport}
              style={{ background: colors.success, color: colors.white, border: "none", padding: "6px 15px", borderRadius: 8, fontWeight: "bold", cursor: "pointer", fontSize: 14, display: 'flex', alignItems: 'center', gap: 5 }}
            >
              📥 {t("common.export")}
            </button>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', fontSize: 18, cursor: 'pointer', color: '#8a9fc8', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 18, marginBottom: 20, flexWrap: 'wrap' }}>
          {[['#1565c0','#5b9bd5',t("ehs.report.legendHigh")], ['#f9a825','#fdd835',t("ehs.report.legendMid")], ['#c62828','#ef5350',t("ehs.report.legendLow")]].map(([c1, c2, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#8a9fc8' }}>
              <div style={{ width: 18, height: 13, background: `linear-gradient(135deg,${c2},${c1})`, borderRadius: 3, boxShadow: `2px 2px 0 ${c1}88` }} />
              {label}
            </div>
          ))}
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: '8px 4px 4px', overflowX: 'auto' }}>
          <svg
            width={SVG_W}
            height={SVG_H}
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            style={{ display: 'block', minWidth: SVG_W }}
          >
            {[0, 25, 50, 75, 100].map(v => {
              const gy = PAD_T + RPT_CHART_H - (v / RPT_BAR_MAX) * RPT_CHART_H;
              return (
                <g key={v}>
                  <line
                    x1={PAD_L} y1={gy}
                    x2={SVG_W - PAD_R} y2={gy}
                    stroke={v === 0 ? '#3a4e78' : '#2a3a60'}
                    strokeWidth={v === 0 ? 1.5 : 1}
                    strokeDasharray={v === 0 ? '' : '4 4'}
                  />
                  <text
                    x={PAD_L - 5} y={gy + 4}
                    textAnchor="end"
                    fill="#4a5e88"
                    fontSize={isMobile ? 9 : 11}
                    fontFamily="sans-serif"
                    fontWeight="600"
                  >{v}</text>
                </g>
              );
            })}

            {chartStats.map((stat, i) => {
              const c = stat.isAverage ? AVG_COLORS : getColors(stat.remaining);
              const barH = Math.max(4, (stat.remaining / RPT_BAR_MAX) * RPT_CHART_H);
              const yBase = PAD_T + RPT_CHART_H;
              const xCenter = PAD_L + (i + 0.5) * slotW;
              const x0 = xCenter - barW / 2;
              return (
                <Bar3D
                  key={stat.name}
                  x0={x0}
                  yBase={yBase}
                  barH={barH}
                  c={c}
                  score={stat.remaining.toFixed(1)}
                  deptName={stat.name}
                  idx={i}
                  isAverage={stat.isAverage}
                  onEnter={(e) => handleBarEnter(e, stat)}
                  onLeave={() => setTooltip(t => ({ ...t, visible: false }))}
                />
              );
            })}
          </svg>
        </div>

          <div style={{ marginTop: 24 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 800, color: '#e8f0fe', fontSize: 16 }}>{t("ehs.report.detailTable")}</div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
              {deptStats.map((stat) => {
                const c = getColors(stat.remaining);
                return (
                  <div key={stat.name} style={{ border: `1.5px solid ${colors.border}`, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, background: colors.surface }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: colors.textPrimary }}>{stat.name}</span>
                      <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 800, color: c.main, background: c.light }}>
                        {stat.remaining.toFixed(2)}đ
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#666' }}>
                      <div>{t("ehs.report.staff")}: <b>{stat.people}</b> ({t("ehs.report.factor")} {stat.heSo})</div>
                      <div>{t("ehs.report.errorCount")}: <b style={{ color: '#d32f2f' }}>{stat.errorCount}</b></div>
                      <div>{t("ehs.report.reminderCount")}: <b style={{ color: '#ff9800' }}>{stat.reminderCount}</b></div>
                    </div>

                    {stat.topGroups.length > 0 && (
                      <div style={{ marginTop: 4, borderTop: '1px solid #f1f3f4', paddingTop: 8 }}>
                        <div style={{ fontSize: 11, color: '#999', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{t("ehs.report.commonErrors")}</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {stat.topGroups.map(([group, count]) => (
                            <span key={group} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#f5f5f5', color: '#555', fontWeight: 600 }}>
                              {group} ({count})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        {tooltip.visible && tooltip.dept && (() => {
          const d = tooltip.dept;
          const c = d.isAverage ? AVG_COLORS : getColors(d.remaining);
          const tipW = 220;
          const rawLeft = Math.max(tipW / 2 + 8, Math.min(tooltip.x, window.innerWidth - tipW / 2 - 8));
          return (
            <div style={{
              position: 'fixed',
              left: rawLeft,
              top: tooltip.side === 'top' ? tooltip.y - 8 : tooltip.y + 8,
              transform: tooltip.side === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
              background: 'linear-gradient(160deg,#1e2e58,#152040)',
              color: '#fff',
              borderRadius: 14,
              padding: '14px 18px',
              width: tipW,
              zIndex: 9999,
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
              pointerEvents: 'none',
              fontSize: 13,
              lineHeight: 1.65,
              border: `1.5px solid ${c.main}55`,
            }}>
              <div style={{ height: 4, background: `linear-gradient(90deg,${c.top},${c.main})`, margin: '-14px -18px 10px', borderRadius: '12px 12px 0 0' }} />
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8, color: '#e8f0fe' }}>
                {d.isAverage ? t("ehs.report.factoryAvg") : d.name}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#7b9bd4' }}>{t("ehs.report.remainingScore")}</span>
                <span style={{ fontWeight: 900, fontSize: 16, color: c.score }}>{d.remaining.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#7b9bd4' }}>{t("ehs.report.deduction")}</span>
                <span style={{ fontWeight: 700, color: '#ff8a80' }}>−{d.totalDeduction.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#7b9bd4' }}>{t("ehs.report.peopleCount")}</span>
                <span style={{ fontWeight: 600, color: '#c8d8f8' }}>{d.people} <span style={{ color: '#4a6098', fontWeight: 400 }}>({t("ehs.report.factorAbbr")} {d.heSo})</span></span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#7b9bd4' }}>{t("ehs.report.errorsLabel")}</span>
                <span style={{ fontWeight: 700, color: d.errorCount > 0 ? '#ff8a80' : '#a5d6a7' }}>{d.errorCount > 0 ? `${d.errorCount} ${t("ehs.report.errorsSuffix")}` : t("ehs.report.noError")}</span>
              </div>
              {d.reminderCount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#7b9bd4' }}>{t("ehs.report.reminderCount")}</span>
                  <span style={{ fontWeight: 600, color: '#ffe082' }}>{d.reminderCount}</span>
                </div>
              )}
              {d.topGroups && d.topGroups.length > 0 && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: 11, color: '#4a6098', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {d.isAverage ? t("ehs.report.mostErrors") : t("ehs.report.topViolations")}
                  </div>
                  {d.topGroups.map(([group, count]) => (
                    <div key={group} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: '#9ab0d8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 155 }}>• {group}</span>
                      <span style={{ fontWeight: 700, color: '#fdd835', marginLeft: 4 }}>{count}</span>
                    </div>
                  ))}
                </div>
              )}
              {!d.isAverage && d.errorCount === 0 && (
                <div style={{ marginTop: 8, color: '#a5d6a7', fontWeight: 700, fontSize: 13, textAlign: 'center' }}>{t("ehs.report.perfect")}</div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

/* =========================
   Component chính DailyAudit
   ========================= */
function EditErrorModal({ modalData, onClose, onSave }) {
  const { t } = useI18n();
  const err = modalData.error || {};
  const [group, setGroup] = useState(err.group || "");
  const [code, setCode] = useState(err.code || "");
  const [desc, setDesc] = useState(err.desc || "");
  const [note, setNote] = useState(err.note || "");
  const [point, setPoint] = useState(err.point ?? 0);
  const [ca, setCa] = useState(err.ca || "S1");
  const [responsiblePerson, setResponsiblePerson] = useState(err.responsiblePerson || "");
  const [severity, setSeverity] = useState(err.severity || "Nhẹ");
  const initDate = err.timestamp ? safeTsToDate(err.timestamp) : new Date();
  const [editDate, setEditDate] = useState(initDate || new Date());
  const [editTime, setEditTime] = useState(
    initDate ? `${String(initDate.getHours()).padStart(2, '0')}:${String(initDate.getMinutes()).padStart(2, '0')}` : "08:00"
  );
  const [saving, setSaving] = useState(false);

  const isOther = group === "Lỗi Khác";
  const codeItems = (errorGroups.find(g => g.group === group)?.items) || [];

  const handleGroupChange = (g) => {
    setGroup(g);
    if (g === "Lỗi Khác") {
      setCode(err.code && String(err.code).startsWith("custom-") ? err.code : `custom-${Date.now()}`);
      setDesc(err.code && String(err.code).startsWith("custom-") ? (err.desc || "Lỗi khác") : "Lỗi khác");
    } else {
      setCode("");
    }
  };

  const handleCodeChange = (c) => {
    setCode(c);
    const item = codeItems.find(it => it.code === c);
    if (item) {
      setDesc(item.desc);
      if (Number.isFinite(item.point)) setPoint(item.point);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const [hh, mm] = editTime.split(':').map(Number);
      const newDate = new Date(editDate);
      newDate.setHours(hh || 0, mm || 0, 0, 0);
      await onSave(modalData.logId, {
        group,
        code,
        desc,
        note,
        point: Number(point) || 0,
        ca,
        responsiblePerson,
        severity,
        timestamp: newDate.toISOString(),
      });
    } finally {
      setSaving(false);
    }
  };

  const labelStyle = { fontSize: 14, fontWeight: 600, marginBottom: 5, color: colors.textPrimary };
  const fieldStyle = { width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${colors.primaryLight}`, fontSize: 15, fontFamily: 'sans-serif' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1300 }}>
      <div style={{ background: '#fff', padding: 26, borderRadius: 16, width: '92%', maxWidth: 520, boxShadow: '0 6px 32px rgba(0,0,0,.25)', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ marginTop: 0, color: colors.primary, display: 'flex', alignItems: 'center', gap: 8 }}>{t("ehs.edit.title")}</h3>

        <div style={{ fontSize: 12, color: '#888', marginBottom: 16, lineHeight: 1.6 }}>
          {t("ehs.edit.dept")}: <b>{modalData.department || ''}</b> · {t("ehs.edit.recorder")}: <b>{err.addedBy || ''}</b>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>{t("ehs.edit.dateDetected")}</div>
            <DatePicker
              selected={editDate}
              onChange={(date) => setEditDate(date)}
              dateFormat="dd/MM/yyyy"
              className="date-picker-input"
              customInput={<input style={fieldStyle} />}
            />
          </div>
          <div style={{ width: 120 }}>
            <div style={labelStyle}>{t("ehs.edit.time")}</div>
            <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} style={fieldStyle} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>{t("ehs.recipientShort")}</div>
            <input type="text" value={responsiblePerson} onChange={e => setResponsiblePerson(e.target.value)} style={fieldStyle} />
          </div>
          <div style={{ width: 120 }}>
            <div style={labelStyle}>{t("ehs.shift")}</div>
            <select value={ca} onChange={e => setCa(e.target.value)} style={fieldStyle}>
              {["S1", "S2", "S3", "S8"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>{t("gemba.table.group")}</div>
          <select value={group} onChange={e => handleGroupChange(e.target.value)} style={fieldStyle}>
            {errorGroups.map(g => <option key={g.group} value={g.group}>{g.group}</option>)}
            {group && !errorGroups.some(g => g.group === group) && <option value={group}>{group}</option>}
          </select>
        </div>

        {!isOther && (
          <div style={{ marginBottom: 14 }}>
            <div style={labelStyle}>{t("ehs.edit.errorDetail")}</div>
            <select value={code} onChange={e => handleCodeChange(e.target.value)} style={fieldStyle}>
              <option value="">{t("ehs.edit.selectDetail")}</option>
              {codeItems.map(it => <option key={it.code} value={it.code}>{it.code} - {it.desc}</option>)}
              {code && !codeItems.some(it => it.code === code) && <option value={code}>{code} - {desc}</option>}
            </select>
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>{t("ehs.edit.severity")}</div>
          <select value={severity} onChange={e => setSeverity(e.target.value)} style={{ ...fieldStyle, width: 200 }}>
            {["Nhẹ", "Trung bình", "Nặng"].map(s => <option key={s} value={s}>{severityLabel(t, s)}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>{t("ehs.edit.errorDesc")}</div>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} style={{ ...fieldStyle, minHeight: 60 }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>{t("gemba.table.note")}</div>
          <textarea value={note} onChange={e => setNote(e.target.value)} style={{ ...fieldStyle, minHeight: 50 }} />
        </div>

        <div style={{ marginBottom: 22 }}>
          <div style={labelStyle}>{t("ehs.edit.basePoint")}</div>
          <input type="number" value={point} min={0} onChange={e => setPoint(e.target.value)} style={{ ...fieldStyle, width: 120 }} />
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, border: `1px solid ${colors.border}`, background: '#f5f5f5', cursor: 'pointer', fontWeight: 600 }}>{t("common.cancel")}</button>
          <button onClick={handleSubmit} disabled={saving} style={{ padding: '8px 22px', borderRadius: 8, border: 'none', background: colors.primary, color: '#fff', cursor: 'pointer', fontWeight: 700 }}>{saving ? t("ehs.saving") : `✓ ${t("common.save")}`}</button>
        </div>
      </div>
    </div>
  );
}

function DailyAudit({ user, isMobile, newErrorCounts, setGembaNotifCounts }) {
  const { t } = useI18n();
  const { askConfirm } = useConfirm();
  const [depIndex, setDepIndex] = useState(0);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedError, setSelectedError] = useState("");
  const [allScores, setAllScores] = useState([]);
  const [peopleCount, setPeopleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showReportDashboard, setShowReportDashboard] = useState(false);
  const [allDeptScores, setAllDeptScores] = useState({});
  
  const [imageFiles, setImageFiles] = useState([]);
  const [imageFileNames, setImageFileNames] = useState([]);

  const [isUploading, setIsUploading] = useState(false);
  const [viewer, setViewer] = useState({ open: false, list: [], index: 0 });
  const [isReminder, setIsReminder] = useState(false);
  const [otherErrorSeverity, setOtherErrorSeverity] = useState("Nhẹ");
  const [note, setNote] = useState("");
  const [responsiblePerson, setResponsiblePerson] = useState("");
  const [ca, setCa] = useState("");
  const fileRef = useRef();
  const [thumbMap, setThumbMap] = useState({});
  const [improvementModal, setImprovementModal] = useState({ isOpen: false, error: null, logId: "" });
  const [editModal, setEditModal] = useState({ isOpen: false, error: null, logId: "", department: "" });
  const [commentModal, setCommentModal] = useState({ isOpen: false, eventId: "", error: null });
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  
  const dep = departments[depIndex];
  const isCustomError = selectedGroup === "Lỗi Khác" || (selectedError && selectedError.endsWith(".other"));
  const userRolesList = user?.role ? (Array.isArray(user.role) ? user.role.map(r => String(r).toLowerCase()) : String(user.role).split(',').map(r => r.trim().toLowerCase())) : [];
  const isAdminOrEhs = userRolesList.some(r => r === 'admin' || r === 'ehs');
  const isEhsCommittee = userRolesList.includes("ehs committee");
  const isEhsCommitteeOnly = isEhsCommittee && !isAdminOrEhs;
  const userRole = isAdminOrEhs ? 'admin' : (userRolesList[0] || "");

  const [autoCorrect, setAutoCorrect] = useState(true);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [showCorrectModal, setShowCorrectModal] = useState(false);
  const [correctedNote, setCorrectedNote] = useState("");

  const heSo = calcHeSo(peopleCount);

  const scoreList = allScores
    .filter(score => {
        const scoreDate = safeTsToDate(score.timestamp);
        if (!scoreDate) return false;
        return scoreDate.toISOString().slice(0, 7) === selectedMonth;
    })
    .sort((a, b) => {
        const dateA = safeTsToDate(a.timestamp);
        const dateB = safeTsToDate(b.timestamp);
        if (!dateA) return 1; if (!dateB) return -1;
        return dateB - dateA;
    });

  const sum = scoreList.reduce((total, error) => total + (error.isReminder ? 0 : (error.point + heSo) / 2), 0);
  const remainingScore = 100 - sum;

  const fetchScores = async () => {
    if (!dep) return;
    try {
      const defaultPeople = dep.defaultPeople || 0;
      const scoreDoc = await dbService.getDoc("gemba_scores", dep.name).catch(() => null);
      const people = (scoreDoc && scoreDoc.people !== undefined) ? scoreDoc.people : defaultPeople;
      setPeopleCount(people);

      const allEvents = await dbService.getDocs("gemba_events");
      const deptEvents = allEvents
        .filter(ev => ev.department === dep.name && !ev.is_deleted)
        .map(normalizeEvent)
        .filter(Boolean);

      if (scoreDoc && Array.isArray(scoreDoc.scores) && scoreDoc.scores.length > 0) {
        const existingTs = new Set(deptEvents.map(e => safeTsToDate(e.timestamp)?.getTime()).filter(Boolean));
        const legacyScores = scoreDoc.scores
          .filter(s => !s.is_deleted && !existingTs.has(safeTsToDate(s.timestamp)?.getTime()))
          .map(s => ({
            id: `legacy-${dep.name}-${safeTsToDate(s.timestamp)?.getTime() || Date.now()}`,
            department: dep.name,
            ...s
          }));
        setAllScores([...deptEvents, ...legacyScores]);
      } else {
        setAllScores(deptEvents);
      }
    } catch (error) {
      console.warn("Lỗi fetch gemba_events:", error);
      setAllScores([]);
      setPeopleCount(dep.defaultPeople || 0);
    }
  };

  useEffect(() => {
    if (!dep) return;
    setLoading(true);
    fetchScores().finally(() => setLoading(false));

    const unsub = realtimeService.subscribeToPath("gemba_events", () => {
      fetchScores();
    });

    const interval = setInterval(fetchScores, 30000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [dep]);

  useEffect(() => {
    runCleanup();
  }, []);

  useEffect(() => {
    if (!showReportDashboard) return;
    const fetchAllDeptScores = async () => {
      try {
        const [allEventsDocs, allScoresDocs] = await Promise.all([
          dbService.getDocs("gemba_events"),
          dbService.getDocs("gemba_scores"),
        ]);

        const nextScores = {};
        departments.forEach((dept) => {
          const deptName = dept.name;
          const deptDoc = allScoresDocs.find(d => (d.id || d.uid) === deptName);
          const people = deptDoc?.people !== undefined ? deptDoc.people : dept.defaultPeople;

          const flatEvents = allEventsDocs
            .filter(ev => ev.department === deptName && !ev.is_deleted)
            .map(normalizeEvent)
            .filter(Boolean);

          const scores = [...flatEvents];
          if (deptDoc && Array.isArray(deptDoc.scores)) {
            const existingTs = new Set(flatEvents.map(e => safeTsToDate(e.timestamp)?.getTime()).filter(Boolean));
            deptDoc.scores
              .filter(s => !s.is_deleted && !existingTs.has(safeTsToDate(s.timestamp)?.getTime()))
              .forEach(s => scores.push({
                id: `legacy-${deptName}-${safeTsToDate(s.timestamp)?.getTime()}`,
                department: deptName,
                ...s
              }));
          }

          nextScores[deptName] = { scores, people };
        });
        setAllDeptScores(nextScores);
      } catch (err) {
        console.error("Lỗi fetch all dept scores:", err);
      }
    };
    fetchAllDeptScores();

    const unsub = realtimeService.subscribeToPath("gemba_events", () => {
      fetchAllDeptScores();
    });

    const interval = setInterval(fetchAllDeptScores, 30000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [showReportDashboard]);

  useEffect(() => {
    const run = async () => {
      const urls = (allScores || []).flatMap(e => e.imageUrls || (e.imageUrl ? [e.imageUrl] : [])).filter(Boolean);
      const tasks = urls.filter(u => !thumbMap[u]).map(async (u) => {
        const t = await makeThumbDataURL(u, 96, 96, 0.55);
        return [u, t];
      });
      if (tasks.length) {
        const pairs = await Promise.all(tasks);
        const next = { ...thumbMap };
        pairs.forEach(([u, t]) => { next[u] = t; });
        setThumbMap(next);
      }
    };
    run();
  }, [allScores]);
  
  const handleSelectDepartment = (index) => {
    setDepIndex(index);
    const departmentName = departments[index].name;
    if (newErrorCounts && newErrorCounts[departmentName] > 0) {
      try {
        const now = new Date().toISOString();
        const storageKey = "gembaLastSeenTimestamps";
        const timestamps = JSON.parse(localStorage.getItem(storageKey) || "{}");
        timestamps[departmentName] = now;
        localStorage.setItem(storageKey, JSON.stringify(timestamps));
        if (user && user.uid) {
          dbService.updateDoc("user_prefs", user.uid, { [storageKey]: timestamps }).catch(e => console.warn("Lưu prefs lỗi:", e));
        }
        const updatedCounts = { ...newErrorCounts, [departmentName]: 0 };
        setGembaNotifCounts(updatedCounts);
      } catch (e) { console.error("Lỗi khi cập nhật localStorage:", e); }
    }
  };

  async function handleSavePeople() {
    try {
      await dbService.updateDoc("gemba_scores", dep.name, { people: peopleCount });
      await fetchScores();
    } catch (error) {
      console.error("Lỗi cập nhật số người: ", error);
      alert(t("ehs.alert.updateError"));
    }
  }

  const handleImageChange = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      if (files.length > 5) {
        alert(t("gemba.alert.maxPhoto"));
        if (fileRef.current) fileRef.current.value = "";
        return;
      }
      const opt = { maxSizeMB: 2, maxWidthOrHeight: 1920, useWebWorker: true };
      try {
        const processedFiles = await Promise.all(files.map(async (file) => {
          if (file.size <= opt.maxSizeMB * 1024 * 1024) return file;
          try {
            return await imageCompression(file, opt);
          } catch (err) {
            // Nén lỗi (hay gặp trên mobile / trình duyệt in-app do web worker) -> dùng ảnh gốc
            // thay vì bỏ, để vẫn gửi được lỗi. Firebase Storage nhận ảnh gốc bình thường.
            console.warn("Nén ảnh thất bại, dùng ảnh gốc:", err?.message || err);
            return file;
          }
        }));
        setImageFiles(processedFiles);
        setImageFileNames(processedFiles.map(f => f.name));
      } catch (err) {
        // Không xóa sạch ảnh khi lỗi -> giữ ảnh gốc để không chặn việc gửi trên mobile.
        console.error("Lỗi xử lý ảnh, dùng ảnh gốc:", err);
        setImageFiles(files);
        setImageFileNames(files.map(f => f.name));
      }
    } else { 
      setImageFiles([]); 
      setImageFileNames([]);
    }
  };

  async function handleAddError() {
    if (!selectedGroup) { alert(t("gemba.alert.selectGroup")); return; }
    if (!isCustomError && !selectedError) { alert(t("gemba.alert.selectError")); return; }
    if (!note.trim()) { alert(t("gemba.alert.requireNote")); return; }
    if (imageFiles.length === 0) { alert(t("gemba.alert.requirePhoto")); return; }
    if (!ca) { alert(t("gemba.alert.requireShift")); return; }
    if (!responsiblePerson.trim()) { alert(t("gemba.alert.requireRecipient")); return; }

    if (autoCorrect && note.trim()) {
      setIsCorrecting(true);
      try {
        // Giới hạn thời gian sửa chính tả: trên mobile mạng yếu, gọi AI trực tiếp có thể
        // treo vô hạn (không có timeout) -> nút kẹt "Đang sửa..." và KHÔNG bao giờ gửi được lỗi.
        // Quá 6s thì bỏ qua bước sửa và lưu luôn.
        const spellResult = await Promise.race([
          callSpellCheckService(note.trim()),
          new Promise((resolve) => setTimeout(() => resolve(null), 6000)),
        ]);
        // callSpellCheckService trả về { response } (object), không phải string.
        const corrected = typeof spellResult === "string"
          ? spellResult
          : (spellResult && spellResult.response ? String(spellResult.response) : "");
        if (corrected && corrected.trim() && corrected.trim().toLowerCase() !== note.trim().toLowerCase()) {
          setCorrectedNote(corrected.trim());
          setShowCorrectModal(true);
          setIsCorrecting(false);
          return;
        }
      } catch (e) {
        console.error("Lỗi khi gọi AI sửa chính tả:", e);
      }
      setIsCorrecting(false);
    }
    await doSaveError(note);
  }

  async function doSaveError(noteToUse) {
    setIsUploading(true);
    let urls = [];
    if (imageFiles.length > 0) {
      try {
        const uploadPromises = imageFiles.map(async file => {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("path", `gemba_images/${Date.now()}_${file.name}`);
          const res = await apiClient.post("/api/storage/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" }
          });
          return res.data.url;
        });
        urls = await Promise.all(uploadPromises);
      } catch (error) {
        console.error("Lỗi tải ảnh: ", error);
        alert(t("gemba.alert.uploadFail"));
        setIsUploading(false);
        return;
      }
    }

    const pointsMap = { Nhẹ: 2, Nặng: 4, "Nghiêm trọng": 6 };
    const nowStr = new Date().toISOString();
    let newErrorObject;
    if (selectedGroup === "Lỗi Khác") {
      newErrorObject = {
        department: dep.name,
        group: selectedGroup,
        code: `custom-${Date.now()}`,
        desc: "Lỗi khác",
        point: pointsMap[otherErrorSeverity],
        timestamp: nowStr,
        imageUrls: urls,
        note: noteToUse,
        addedBy: user.name,
        addedByUid: user.uid,
        isReminder,
        responsiblePerson,
        ca,
        heSo,
        peopleCount
      };
    } else {
      const errors = (errorGroups.find((g) => g.group === selectedGroup) || { items: [] }).items;
      const err = errors.find((e) => e.code === selectedError);
      let finalPoint = err?.point || 0;
      if (selectedError && selectedError.endsWith(".other")) {
        finalPoint = pointsMap[otherErrorSeverity];
      }
      newErrorObject = { group: selectedGroup, ...err, point: finalPoint, timestamp: nowStr, imageUrls: urls, note: noteToUse, addedBy: user.name, addedByUid: user.uid, isReminder, responsiblePerson, ca };
    }
    
    try {
      const docSnap = await dbService.getDoc("gemba_scores", dep.name).catch(() => null);
      if (docSnap) {
        const updatedScores = [...(docSnap.scores || []), newErrorObject];
        await dbService.updateDoc("gemba_scores", dep.name, { scores: updatedScores });
      } else {
        await dbService.createDoc("gemba_scores", { id: dep.name, scores: [newErrorObject], people: peopleCount });
      }
    } catch (err) {
      console.error("Lỗi ghi gemba_scores:", err);
    }
    
    const eventData = { department: dep.name, error: { ...newErrorObject, timestamp: new Date().toLocaleString("vi-VN") }, peopleCount: peopleCount, heSo: heSo, addedBy: user.name, timestamp: nowStr };
    await dbService.createDoc("gemba_events", eventData);
    await fetchScores();

    const errorTimeSec = Math.floor(Date.now() / 1000);
    const notificationRelatedId = `gemba-${dep.name}-${newErrorObject.code || 'nocode'}-${errorTimeSec}`;
    try {
      await dbService.createDoc("notifications", {
        type: "new_gemba_error",
        message: `${user.name} đã thêm lỗi mới tại ${dep.name} - Người nhận: ${responsiblePerson || "Chưa xác định"} - ${newErrorObject.desc}`,
        targetRoles: ["ehs", "admin", "ehs committee"],
        createdBy: user.uid,
        readBy: [],
        relatedId: notificationRelatedId,
        timestamp: nowStr
      });
    } catch (e) {
      console.error("Lỗi gửi thông báo:", e);
    }

    setSelectedError(""); 
    setImageFiles([]);
    setImageFileNames([]);
    if (fileRef.current) fileRef.current.value = "";
    setOtherErrorSeverity("Nhẹ"); setNote(""); setIsUploading(false); setIsReminder(false);
    setResponsiblePerson("");
    setCa("");
  }

  async function handleDelete(logId) {
    const errorToDelete = allScores.find(s => s.id === logId);
    if (!errorToDelete) return;
    if (await askConfirm(t("gemba.delete.confirm").replace("{desc}", errorToDelete.desc), t("ehs.confirm.deleteTitle"))) {
        if (!String(logId).startsWith("legacy-")) {
          try {
            await dbService.updateDoc("gemba_events", logId, { is_deleted: true });
            // Dual-write compat: gỡ luôn bản sao trong gemba_scores.scores[] để lỗi đã
            // xóa không tái xuất hiện dưới dạng "legacy" và không còn tính vào điểm/báo cáo.
            const scoreDoc = await dbService.getDoc("gemba_scores", dep.name).catch(() => null);
            if (scoreDoc && Array.isArray(scoreDoc.scores)) {
              const targetTs = safeTsToDate(errorToDelete.timestamp)?.getTime();
              const newScores = scoreDoc.scores.filter(s => !(s.timestamp === errorToDelete.timestamp || (targetTs && safeTsToDate(s.timestamp)?.getTime() === targetTs)));
              if (newScores.length !== scoreDoc.scores.length) {
                await dbService.updateDoc("gemba_scores", dep.name, { scores: newScores });
              }
            }
          } catch (err) {
            console.error("Lỗi đánh dấu gemba_events:", err);
            alert(t("ehs.alert.deleteViolationFail"));
            return;
          }
        } else {
          try {
            const docSnap = await dbService.getDoc("gemba_scores", dep.name).catch(() => null);
            if (docSnap && Array.isArray(docSnap.scores)) {
              const newScores = docSnap.scores.filter(s => s.timestamp !== errorToDelete.timestamp);
              await dbService.updateDoc("gemba_scores", dep.name, { scores: newScores });
            }
          } catch (err) {
            console.error("Lỗi xóa bản ghi cũ khỏi gemba_scores:", err);
            alert(t("ehs.alert.deleteViolationFail"));
            return;
          }
        }

        const oldSyntheticId = `${dep.name}_${errorToDelete.code || 'custom'}_${safeTsToDate(errorToDelete.timestamp)?.getTime() || 'notime'}`;
        try {
          const allComments = await dbService.getDocs("audit_comments");
          const relatedComments = allComments.filter(c => c.eventId === logId || c.eventId === oldSyntheticId);
          if (relatedComments.length > 0) {
            const batchOps = relatedComments.map(c => ({
              type: "delete",
              collection: "audit_comments",
              id: c.id || c.uid
            }));
            await dbService.commitBatch(batchOps);
          }
        } catch (err) {
          console.error("Lỗi khi xóa bình luận liên quan:", err);
        }

        const images = errorToDelete.imageUrls || (errorToDelete.imageUrl ? [errorToDelete.imageUrl] : []);
        for (const url of images) {
          try {
            const filename = url.substring(url.lastIndexOf('/') + 1);
            await apiClient.delete(`/api/storage/${filename}`);
          } catch (e) {
            console.error("Lỗi xóa ảnh gốc:", e);
          }
        }
        if (errorToDelete.improvementImageUrl) {
          try {
            const url = errorToDelete.improvementImageUrl;
            const filename = url.substring(url.lastIndexOf('/') + 1);
            await apiClient.delete(`/api/storage/${filename}`);
          } catch(e) {
            console.error("Lỗi xóa ảnh cải thiện:", e);
          }
        }

        let errorSec = 0;
        if (errorToDelete.timestamp) {
          const dt = safeTsToDate(errorToDelete.timestamp);
          if (dt) errorSec = Math.floor(dt.getTime() / 1000);
        }
        const deleteRelatedId = `gemba-${dep.name}-${errorToDelete.code || 'nocode'}-${errorSec}`;
        try {
          const allNotifs = await dbService.getDocs("notifications");
          const prefix = `gemba-${dep.name}-${errorToDelete.code || 'nocode'}-`;
          const relatedNotifs = allNotifs.filter(n => {
            if (n.relatedId === deleteRelatedId) return true;
            if (n.relatedId && n.relatedId.startsWith(prefix)) {
              const parts = n.relatedId.split("-");
              const notifSec = Number(parts[parts.length - 1]);
              if (!isNaN(notifSec) && Math.abs(notifSec - errorSec) < 60) return true;
              if (errorToDelete.code?.startsWith("custom-")) return true;
            }
            return false;
          });
          if (relatedNotifs.length > 0) {
            const batchOps = relatedNotifs.map(n => ({
              type: "delete",
              collection: "notifications",
              id: n.id || n.uid
            }));
            await dbService.commitBatch(batchOps);
          }
        } catch (err) {
          console.error("Lỗi khi xóa thông báo liên quan:", err);
        }
        await fetchScores();
    }
  }

  async function handleDeleteRequest(logId) {
    const errorToDelete = allScores.find(s => s.id === logId);
    if (!errorToDelete) return;
    if (await askConfirm(t("ehs.confirm.requestDelete").replace("{desc}", errorToDelete.desc), t("ehs.title.requestDelete"))) {
      try {
        if (!String(logId).startsWith("legacy-")) {
          await dbService.updateDoc("gemba_events", logId, {
            deleteRequested: true,
            deleteRequestedBy: user.name,
            deleteRequestedAt: new Date().toLocaleString("vi-VN")
          });
        } else {
          const docSnap = await dbService.getDoc("gemba_scores", dep.name).catch(() => null);
          if (docSnap && Array.isArray(docSnap.scores)) {
            const idx = docSnap.scores.findIndex(s => s.timestamp === errorToDelete.timestamp);
            if (idx !== -1) {
              const newScores = [...docSnap.scores];
              newScores[idx] = { ...newScores[idx], deleteRequested: true, deleteRequestedBy: user.name, deleteRequestedAt: new Date().toLocaleString("vi-VN") };
              await dbService.updateDoc("gemba_scores", dep.name, { scores: newScores });
            }
          }
        }
        await fetchScores();
        alert(t("ehs.alert.requestDeleteSent"));
      } catch (err) {
        console.error("Lỗi gửi yêu cầu xóa:", err);
        alert(t("ehs.alert.requestDeleteFail"));
      }
    }
  }

  async function handleCancelDeleteRequest(logId) {
    const errorToUpdate = allScores.find(s => s.id === logId);
    try {
      if (!String(logId).startsWith("legacy-")) {
        await dbService.updateDoc("gemba_events", logId, {
          deleteRequested: null,
          deleteRequestedBy: null,
          deleteRequestedAt: null
        });
      } else if (errorToUpdate) {
        const docSnap = await dbService.getDoc("gemba_scores", dep.name).catch(() => null);
        if (docSnap && Array.isArray(docSnap.scores)) {
          // So khớp theo GIÁ TRỊ thời gian: Firestore Timestamp là object nên `===`
          // giữa hai instance (dữ liệu vừa fetch vs record đang hiển thị) luôn false.
          const targetTs = safeTsToDate(errorToUpdate.timestamp)?.getTime();
          const idx = docSnap.scores.findIndex(s => s.timestamp === errorToUpdate.timestamp || (targetTs && safeTsToDate(s.timestamp)?.getTime() === targetTs));
          if (idx !== -1) {
            const newScores = [...docSnap.scores];
            delete newScores[idx].deleteRequested;
            delete newScores[idx].deleteRequestedBy;
            delete newScores[idx].deleteRequestedAt;
            await dbService.updateDoc("gemba_scores", dep.name, { scores: newScores });
          }
        }
      }
      await fetchScores();
      alert(t("ehs.alert.rejectDeleteDone"));
    } catch (err) {
      console.error("Lỗi từ chối xóa:", err);
      alert(t("ehs.alert.actionFail"));
    }
  }
  
  const handleSaveImprovement = async (logId, improvementData) => {
    const errorToUpdate = allScores.find(s => s.id === logId);
    if (!errorToUpdate) return;

    const oldDueDate = errorToUpdate.dueDate || "";
    let newDueDateHistory = errorToUpdate.dueDateHistory || [];
    if (improvementData.dueDate && oldDueDate && improvementData.dueDate !== oldDueDate) {
      const todayStr = new Date().toLocaleDateString("vi-VN");
      const changeMsg = `Gia hạn lần ${newDueDateHistory.length + 1}: ${oldDueDate.split('-').reverse().join('/')} -> ${improvementData.dueDate.split('-').reverse().join('/')} vào ngày ${todayStr}`;
      newDueDateHistory.push(changeMsg);
    }

    try {
      if (!String(logId).startsWith("legacy-")) {
        await dbService.updateDoc("gemba_events", logId, {
          ...improvementData,
          dueDateHistory: newDueDateHistory
        });
      } else {
        const docSnap = await dbService.getDoc("gemba_scores", dep.name).catch(() => null);
        if (docSnap && Array.isArray(docSnap.scores)) {
          // So khớp theo GIÁ TRỊ thời gian: Firestore Timestamp là object nên `===`
          // giữa hai instance (dữ liệu vừa fetch vs record đang hiển thị) luôn false.
          const targetTs = safeTsToDate(errorToUpdate.timestamp)?.getTime();
          const idx = docSnap.scores.findIndex(s => s.timestamp === errorToUpdate.timestamp || (targetTs && safeTsToDate(s.timestamp)?.getTime() === targetTs));
          if (idx !== -1) {
            const newScores = [...docSnap.scores];
            newScores[idx] = { ...newScores[idx], ...improvementData, dueDateHistory: newDueDateHistory };
            await dbService.updateDoc("gemba_scores", dep.name, { scores: newScores });
          }
        }
      }
      await fetchScores();
    } catch (err) {
      console.error("Lỗi cập nhật cải thiện:", err);
      alert(t("ehs.alert.saveImproveFail"));
    }
  };
  
  const handleSaveEdit = async (logId, updated) => {
    try {
      if (!String(logId).startsWith("legacy-")) {
        await dbService.updateDoc("gemba_events", logId, {
          group: updated.group,
          code: updated.code,
          desc: updated.desc,
          note: updated.note,
          point: updated.point,
          ca: updated.ca,
          responsiblePerson: updated.responsiblePerson,
          severity: updated.severity,
          timestamp: updated.timestamp,
        });
        // Dual-write compat: ghi đè thông tin mới lên bản sao trong gemba_scores.scores[]
        const errorToEdit = allScores.find(s => s.id === logId);
        const scoreDoc = await dbService.getDoc("gemba_scores", dep.name).catch(() => null);
        if (errorToEdit && scoreDoc && Array.isArray(scoreDoc.scores)) {
          const targetTs = safeTsToDate(errorToEdit.timestamp)?.getTime();
          const idx = scoreDoc.scores.findIndex(s => s.timestamp === errorToEdit.timestamp || (targetTs && safeTsToDate(s.timestamp)?.getTime() === targetTs));
          if (idx !== -1) {
            const newScores = [...scoreDoc.scores];
            newScores[idx] = { ...newScores[idx], ...updated };
            await dbService.updateDoc("gemba_scores", dep.name, { scores: newScores });
          }
        }
      } else {
        const errorToEdit = allScores.find(s => s.id === logId);
        if (!errorToEdit) return;
        const docSnap = await dbService.getDoc("gemba_scores", dep.name).catch(() => null);
        if (docSnap && Array.isArray(docSnap.scores)) {
          const idx = docSnap.scores.findIndex(s => s.timestamp === errorToEdit.timestamp);
          if (idx !== -1) {
            const newScores = [...docSnap.scores];
            newScores[idx] = { ...newScores[idx], ...updated };
            await dbService.updateDoc("gemba_scores", dep.name, { scores: newScores });
          }
        }
      }
    } catch (err) {
      console.error("Lỗi sửa lỗi:", err);
      alert(t("ehs.alert.editFail"));
    }

    await fetchScores();
    setEditModal({ isOpen: false, error: null, logId: "", department: "" });
  };

  const numberInputStyle = { width: 60, fontSize: 16, padding: "2px 5px", border: `1px solid ${colors.primaryLight}`, borderRadius: 4, MozAppearance: "textfield" };
  const numberInputWebkitStyle = `input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }`;
  const ActionButton = ({ onClick, title, children, color = "#555", bg = "#f0f0f0" }) => (
    <button onClick={onClick} title={title} style={{ border: `1px solid ${color === colors.white ? 'transparent' : color}`, background: bg, color: color, borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontWeight: 800, fontSize: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '0 2px', lineHeight: 1, padding: 0 }}>
      {children}
    </button>
  );

  const openViewer = (list, index = 0) => setViewer({ open: true, list, index });
  const closeViewer = () => setViewer({ open: false, list: [], index: 0 });
  const goPrev = () => setViewer(v => ({ ...v, index: (v.index - 1 + v.list.length) % v.list.length }));
  const goNext = () => setViewer(v => ({ ...v, index: (v.index + 1) % v.list.length }));

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: isMobile ? '10px' : '30px' }}>
      <div style={{ width: '100%', maxWidth: '1600px' }}>
        {showExportModal && <ExportModal onClose={() => setShowExportModal(false)} departments={departments} />}
        {showReportDashboard && (
          <GembaReportDashboard
            onClose={() => setShowReportDashboard(false)}
            onExport={() => setShowExportModal(true)}
            departments={departments}
            allDeptScores={allDeptScores}
            selectedMonth={selectedMonth}
            calcHeSo={calcHeSo}
            isMobile={isMobile}
          />
        )}
        {improvementModal.isOpen && <ImprovementModal modalData={improvementModal} onClose={() => setImprovementModal({ isOpen: false, error: null, logId: "" })} onSave={handleSaveImprovement} canConfirm={isAdminOrEhs} onViewImage={(url) => openViewer([url], 0)} />}
        {editModal.isOpen && <EditErrorModal modalData={editModal} onClose={() => setEditModal({ isOpen: false, error: null, logId: "", department: "" })} onSave={handleSaveEdit} />}

        {showCorrectModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1002 }}>
            <div style={{ background: '#fff', padding: 26, borderRadius: 16, width: '92%', maxWidth: 540, boxShadow: '0 6px 32px rgba(0,0,0,.25)' }}>
              <h3 style={{ marginTop: 0, color: colors.primary, display: 'flex', alignItems: 'center', gap: 8 }}>
                {t("gemba.correct.title")}
              </h3>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 600, color: '#888', marginBottom: 6, fontSize: 13 }}>{t("gemba.correct.original")}</div>
                <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 8, padding: '10px 14px', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{note}</div>
              </div>
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontWeight: 600, color: '#2e7d32', marginBottom: 6, fontSize: 13 }}>{t("gemba.correct.corrected")}</div>
                <div style={{ background: '#f1f8e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: '10px 14px', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{correctedNote}</div>
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  onClick={async () => { setShowCorrectModal(false); await doSaveError(note); }}
                  style={{ padding: '8px 18px', borderRadius: 8, border: `1px solid ${colors.border}`, background: '#f5f5f5', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
                >
                  {t("gemba.correct.useOriginal")}
                </button>
                <button
                  onClick={async () => { setShowCorrectModal(false); await doSaveError(correctedNote); }}
                  style={{ padding: '8px 22px', borderRadius: 8, border: 'none', background: '#2e7d32', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}
                >
                  {t("gemba.correct.useCorrected")}
                </button>
              </div>
            </div>
          </div>
        )}
        
        <LightboxSwipeOnly
          open={viewer.open}
          list={viewer.list}
          index={viewer.index}
          onClose={closeViewer}
          onPrev={goPrev}
          onNext={goNext}
        />

        <div style={{ display: "flex", flexDirection: isMobile ? 'column' : 'row', alignItems: "flex-start", gap: 32, width: "100%" }}>
          <style>{numberInputWebkitStyle}</style>
          <div style={{ flex: "1 1 auto", minWidth: 270, order: isMobile ? 2 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 700, fontSize: isMobile ? 16 : 18, color: colors.primary, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span>{t("gemba.dept")} {departments[depIndex].name} |</span>
                <span>{t("gemba.people")}</span>
                {(userRole === "admin" || userRole === "ehs") ? (<input type="number" value={peopleCount} onChange={(e) => setPeopleCount(parseInt(e.target.value, 10) || 0)} onBlur={handleSavePeople} style={numberInputStyle} />) : ( <span>{peopleCount}</span> )}
                <span>| {t("gemba.factor")} {heSo}</span>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                  <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{ padding: 8, borderRadius: 6, border: `1px solid ${colors.border}` }} />
                  <button onClick={() => setShowReportDashboard(true)} style={{ background: '#1565c0', color: colors.white, border: "none", padding: "8px 15px", borderRadius: 6, fontWeight: "bold", cursor: isMobile ? "pointer" : "pointer", marginTop: isMobile ? 0 : 0 }}>
                    {t("ehs.report.btn")}
                  </button>
              </div>
            </div>
            <div style={{ marginBottom: 15 }}>
                <div style={{ fontSize: 15, color: colors.textPrimary, marginBottom: 5 }}>{t("gemba.group.label")}</div>
                <select value={selectedGroup} onChange={(e) => { setSelectedGroup(e.target.value); setSelectedError(""); }} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${colors.primaryLight}`, fontSize: 15 }}>
                <option value="">{t("gemba.group.placeholder")}</option>
                {errorGroups.map((g) => <option key={g.group} value={g.group}>{g.group}</option>)}
                </select>
            </div>
            {selectedGroup && selectedGroup !== "Lỗi Khác" && (
              <div style={{ marginBottom: 15 }}>
                  <div style={{ fontSize: 15, color: colors.textPrimary, marginBottom: 5 }}>{t("gemba.error.label")}</div>
                  <select value={selectedError} onChange={(e) => setSelectedError(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${colors.primaryLight}`, fontSize: 15 }}>
                  <option value="">{t("gemba.error.placeholder")}</option>
                  {(errorGroups.find(g => g.group === selectedGroup)?.items || []).map(e => <option key={e.code} value={e.code}>{e.code} - {e.desc} ({e.point > 0 ? `${e.point}đ` : t("ehs.customLabel")})</option>)}
                  </select>
              </div>
            )}
            {isCustomError && (
                <div style={{ border: `1.5px solid ${colors.primaryLight}`, borderRadius: 8, padding: 15, marginBottom: 15 }}>
                    <div style={{ fontSize: 15, color: colors.textPrimary, fontWeight: 700, marginBottom: 10 }}>{t("gemba.custom.detail")}</div>
                    <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 15, color: colors.textPrimary, marginBottom: 5 }}>{t("gemba.custom.severity")}</div>
                        <div style={{ display: "flex", gap: 15, flexWrap: "wrap" }}>
                        {["Nhẹ", "Nặng", "Nghiêm trọng"].map(level => ( <label key={level}> <input type="radio" name="severity" value={level} checked={otherErrorSeverity === level} onChange={(e) => setOtherErrorSeverity(e.target.value)} style={{ marginRight: 4, accentColor: colors.primary }} /> {severityLabel(t, level)} ({level === "Nhẹ" ? 2 : level === "Nặng" ? 4 : 6}đ) </label> ))}
                        </div>
                    </div>
                </div>
            )}
            <div style={{ display: 'flex', gap: 12, marginBottom: 15 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, color: colors.textPrimary, marginBottom: 5 }}>{t("gemba.recipient")}</div>
                  <input
                    type="text"
                    value={responsiblePerson}
                    onChange={(e) => setResponsiblePerson(e.target.value)}
                    placeholder={t("gemba.recipient.placeholder")}
                    style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${colors.primaryLight}`, fontSize: 15 }}
                  />
                </div>
                <div style={{ width: 120 }}>
                  <div style={{ fontSize: 15, color: colors.textPrimary, marginBottom: 5 }}>Ca</div>
                  <select
                    value={ca}
                    onChange={(e) => setCa(e.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${colors.primaryLight}`, fontSize: 15 }}
                  >
                    <option value="">{t("gemba.shift.placeholder")}</option>
                    {["S1", "S2", "S3", "S8"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
            </div>
            <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 15, color: colors.textPrimary, marginBottom: 5 }}>{t("gemba.note.label")}</div>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={isCustomError ? t("gemba.note.custom.placeholder") : t("gemba.note.placeholder")} style={{ width: "100%", minHeight: 60, boxSizing: "border-box", padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${colors.primaryLight}`, fontSize: 15, fontFamily: "sans-serif" }} />
            </div>
            <div style={{ display: 'flex', gap: 20, marginBottom: 18, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={autoCorrect}
                  onChange={e => setAutoCorrect(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: colors.primary, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 14, color: colors.textPrimary, fontWeight: 500 }}>
                  {t("gemba.autoCorrect")}
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={isReminder}
                  onChange={e => setIsReminder(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: colors.primary, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 14, color: colors.textPrimary, fontWeight: 500 }}>
                  {t("ehs.reminder")}
                </span>
              </label>
            </div>

            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10, flexWrap: "wrap" }}>
                <input id="imageUploadGemba" type="file" accept="image/*" onChange={handleImageChange} ref={fileRef} style={{ display: 'none' }} multiple />
                <label htmlFor="imageUploadGemba" style={{background: 'white', color: colors.primary, border: `1.2px solid ${colors.primaryLight}`, borderRadius: 8, padding: '8px 15px', cursor: 'pointer', fontWeight: 600}}>
                    {t("gemba.attach", { count: imageFiles.length }).replace("{count}", imageFiles.length)}
                </label>
                <span style={{fontStyle: 'italic', fontSize: 14, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                    {imageFileNames.length > 0 ? imageFileNames.join(', ') : t("common.noImage")}
                </span>
                <button onClick={handleAddError} disabled={isUploading || isCorrecting} style={{ marginLeft: 'auto', height: 38, background: isCorrecting ? '#888' : colors.primary, color: colors.white, borderRadius: 9, border: "none", padding: "0 26px", fontWeight: 700, fontSize: 16, cursor: "pointer", opacity: (isUploading || isCorrecting) ? 0.7 : 1 }}>
                    {isCorrecting ? t("gemba.correcting") : isUploading ? t("gemba.uploading") : t("gemba.add")}
                </button>
            </div>
            
            {loading ? <div>{t("gemba.loading")}</div> : (
              isMobile ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  {scoreList.length > 0 ? scoreList.map((e, i) => {
                    const images = e.imageUrls || (e.imageUrl ? [e.imageUrl] : []);
                    const isImproved = e.ehsVerified === true;
                    const dateForkey = safeTsToDate(e.timestamp);
                    return (
                      <div key={`${e.code}-${dateForkey ? dateForkey.getTime() : i}`} style={{ border: '1.2px solid ' + colors.primaryLight, borderRadius: 12, padding: 12, background: colors.surface, boxShadow: `0 1.5px 10px ${colors.primary}11` }}>
                        <div style={{ display:'flex', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
                          <div style={{ fontSize: 12, color: colors.textSecondary }}>{safeTsToDate(e.timestamp)?.toLocaleString('vi-VN')}{e.ca ? ` | ${t("ehs.shift")}: ${e.ca}` : ''}</div>
                          <div style={{ fontWeight: 700, color: colors.primary }}>{e.group}</div>
                        </div>
                        <div style={{ marginTop: 6, overflowWrap:'anywhere' }}>
                           <div>{e.group === 'Lỗi Khác' ? t("ehs.otherError") : e.desc}</div>
                           {e.responsiblePerson && (
                             <div style={{ fontSize: '12px', color: '#b94a48', fontWeight: 600, marginTop: 4 }}>
                             {t("ehs.recipientShort")}: {e.responsiblePerson}
                             </div>
                           )}
                           {e.addedBy && <div style={{fontSize: 11, color: colors.textSecondary, fontStyle:'italic', marginTop: 2}}>{t("gemba.by")} {e.addedBy}</div>}
                           {e.ehsVerified && (
                             <div style={{ fontSize: '12px', color: '#2e7d32', fontWeight: 700, background: '#e8f5e9', padding: '2px 8px', borderRadius: 6, marginTop: 4, display: 'inline-block' }}>
                               {t("ehs.confirmedDone")}
                             </div>
                           )}
                           {e.deleteRequested && (
                             <div style={{ fontSize: '12px', color: '#c62828', fontWeight: 'bold', background: '#ffebee', padding: '4px 8px', borderRadius: 6, marginTop: 6, display: 'inline-block' }}>
                               {t("ehs.pendingDeleteBy").replace("{by}", e.deleteRequestedBy)}
                             </div>
                           )}
                        </div>
                        {images.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ position:'relative', display:'inline-block', cursor:'pointer' }} onClick={() => openViewer(images, 0)}>
                              <img src={thumbMap[images[0]] || images[0]} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ width: 56, height: 56, borderRadius: 6, objectFit:'cover' }}/>
                              {images.length > 1 && (
                                <span style={{ position:'absolute', top:-6, right:-6, background:'rgba(0,0,0,0.7)', color:'#fff', borderRadius:'50%', width:20, height:20, fontSize:12, display:'flex', alignItems:'center', justifyContent:'center' }}>+{images.length-1}</span>
                              )}
                            </div>
                          </div>
                        )}
                        <div style={{ marginTop: 10, fontWeight: 700, color: colors.primary }}>
                          {e.isReminder ? t("ehs.reminder") : `${t("gemba.table.deduction")}: ${((e.point + heSo) / 2).toFixed(2)}`}
                        </div>
                        <div style={{ marginTop: 8, display:'flex', justifyContent:'flex-end', gap:6, alignItems:'center' }}>
                          <ActionButton 
                            onClick={() => {
                              setCommentModal({ isOpen: true, eventId: e.id, error: e });
                            }} 
                            title={t("ehs.title.discuss")}
                            color={colors.white} 
                            bg={colors.primary}
                          >
                            💬
                          </ActionButton>
                          <ActionButton onClick={() => setImprovementModal({ isOpen: true, error: e, logId: e.id })} title={t("gemba.improve.action")} color={colors.white} bg={isImproved ? '#4caf50' : '#f44336'}><ImprovementIcon /></ActionButton>
                          {isEhsCommitteeOnly && (e.addedByUid === user.uid || e.addedBy === user.name) && !e.deleteRequested && (
                            <ActionButton onClick={() => handleDeleteRequest(e.id)} title={t("ehs.title.requestDelete")} color="#d32f2f" bg="transparent">x</ActionButton>
                          )}
                          {isAdminOrEhs && e.deleteRequested && (
                            <>
                              <ActionButton onClick={() => handleDelete(e.id)} title={t("ehs.title.approveDelete")} color="#fff" bg="#2e7d32">✅</ActionButton>
                              <ActionButton onClick={() => handleCancelDeleteRequest(e.id)} title={t("ehs.title.rejectDelete")} color="#fff" bg="#e65100">❌</ActionButton>
                            </>
                          )}
                          {(userRole === 'admin' || userRole === 'ehs') && !e.deleteRequested && (
                            <ActionButton onClick={() => setEditModal({ isOpen: true, error: e, logId: e.id, department: dep.name })} title={t("ehs.title.editError")} color="#1565c0" bg="transparent">✏️</ActionButton>
                          )}
                          {(userRole === 'admin' || userRole === 'ehs') && !e.deleteRequested && (
                            <ActionButton onClick={() => handleDelete(e.id)} title={t("gemba.delete.action")} color="#d32f2f" bg="transparent">x</ActionButton>
                          )}
                        </div>
                      </div>
                    );
                  }) : (
                    <div style={{textAlign:'center', padding:20}}>{t("gemba.empty")}</div>
                  )}
                </div>
              ) : (
                <table style={{ marginTop: 10, width: "100%", borderCollapse: "separate", borderSpacing: 0, boxShadow: `0 1.5px 10px ${colors.primary}11`, border: `1.2px solid ${colors.primaryLight}`, background: colors.surface, borderRadius: 12, overflow: "hidden" }}>
                  <thead>
                    <tr style={{ background: colors.primaryLight }}>
                        <th style={{ padding: "10px 14px", color: colors.textPrimary }}>{t("gemba.table.time")}</th>
                        <th style={{ padding: "10px 8px", color: colors.textPrimary }}>{t("ehs.shift")}</th>
                        <th style={{ padding: "10px 14px", color: colors.textPrimary }}>{t("gemba.table.group")}</th>
                        <th style={{ padding: "10px 14px", color: colors.textPrimary, width: "40%" }}>{t("gemba.table.desc")}</th>
                        <th style={{ padding: "10px 8px", color: colors.textPrimary }}>{t("gemba.table.photo")}</th>
                        <th style={{ padding: "10px 8px", color: colors.textPrimary }}>{t("gemba.table.note")}</th>
                        <th style={{ padding: "10px 8px", color: colors.textPrimary }}>{t("gemba.table.deduction")}</th>
                        <th style={{ padding: "10px 8px", color: colors.textPrimary, minWidth: 120 }}>{t("gemba.table.action")}</th>
                    </tr>
                  </thead>
                  <tbody key={dep.name}>
                  {scoreList.length > 0 ? scoreList.map((e, i) => {
                     const isImproved = e.ehsVerified === true;
                     const images = e.imageUrls || (e.imageUrl ? [e.imageUrl] : []);
                     const dateForkey = safeTsToDate(e.timestamp);
                     return (
                      <tr key={`${e.code}-${dateForkey ? dateForkey.getTime() : i}`}>
                      <td style={{ padding: "10px 14px", fontSize: 12 }}>{safeTsToDate(e.timestamp)?.toLocaleString("vi-VN")}</td>
                      <td style={{ padding: "10px 8px", textAlign: "center", fontWeight: 600, color: '#666' }}>{e.ca || ""}</td>
                      <td style={{ padding: "10px 14px" }}>{e.group}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <div>{e.group === 'Lỗi Khác' ? t("ehs.otherError") : e.desc}</div>
                        {e.responsiblePerson && (
                          <div style={{ fontSize: '12px', color: '#b94a48', fontWeight: 600, marginTop: 4 }}>
                            {t("ehs.recipientShort")}: {e.responsiblePerson}
                          </div>
                        )}
                        {e.addedBy && (
                          <div style={{ fontSize: '11px', color: colors.textSecondary, fontStyle: 'italic', marginTop: 2 }}>
                            {t("gemba.by")} {e.addedBy}
                          </div>
                        )}
                        {e.ehsVerified && (
                          <div style={{ fontSize: '11px', color: '#2e7d32', fontWeight: 700, background: '#e8f5e9', padding: '2px 6px', borderRadius: 4, marginTop: 4, display: 'inline-block' }}>
                            {t("ehs.confirmedDone")}
                          </div>
                        )}
                        {e.deleteRequested && (
                          <div style={{ fontSize: '11px', color: '#c62828', fontWeight: 'bold', background: '#ffebee', padding: '2px 6px', borderRadius: 4, marginTop: 4, display: 'inline-block' }}>
                            {t("ehs.pendingDeleteBy").replace("{by}", e.deleteRequestedBy)}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "center" }}>
                        {images.length > 0 && (
                          <div style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }} onClick={() => openViewer(images, 0)}>
                            <img src={thumbMap[images[0]] || images[0]} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ width: 40, height: 40, borderRadius: 4, objectFit: "cover" }}/>
                            {images.length > 1 && (
                              <span style={{ position: 'absolute', top: -5, right: -5, background: 'rgba(0,0,0,0.7)', color: 'white', borderRadius: '50%', width: 18, height: 18, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                +{images.length - 1}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "center" }}>{(e.note || (e.group === 'Lỗi Khác' && e.desc !== 'Lỗi khác' ? e.desc : null)) && <button onClick={() => alert(`${t("ehs.noteAlertPrefix")}\n\n${e.note || e.desc}`)} style={{ border: "none", background: "transparent", fontSize: 24, cursor: "pointer" }} title={t("gemba.note.view")}>🗒️</button>}</td>
                      <td style={{ padding: "10px 8px", fontWeight: 700, color: colors.primary, textAlign: "center", fontSize: e.isReminder ? 12 : 14 }}>{e.isReminder ? t("ehs.reminderShort") : ((e.point + heSo) / 2).toFixed(2)}</td>
                      <td style={{ textAlign: "center" }}>
                          <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4}}>
                            <button 
                              onClick={() => {
                                setCommentModal({ isOpen: true, eventId: e.id, error: e });
                              }} 
                              title={t("ehs.title.discussShort")}
                              style={{ border: "none", background: colors.primary, color: colors.white, borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontWeight: 800, fontSize: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '0 2px', padding: 0 }}
                            >
                              💬
                            </button>
                            <ActionButton onClick={() => setImprovementModal({ isOpen: true, error: e, logId: e.id })} title={t("gemba.improve.action")} color={colors.white} bg={isImproved ? "#4caf50" : "#f44336"}> <ImprovementIcon /> </ActionButton>
                            {isEhsCommitteeOnly && (e.addedByUid === user.uid || e.addedBy === user.name) && !e.deleteRequested && (
                              <ActionButton onClick={() => handleDeleteRequest(e.id)} title={t("ehs.title.requestDelete")} color="#d32f2f" bg="transparent">x</ActionButton>
                            )}
                            {isAdminOrEhs && e.deleteRequested && (
                              <>
                                <ActionButton onClick={() => handleDelete(e.id)} title={t("ehs.title.approveDelete")} color="#fff" bg="#2e7d32">✅</ActionButton>
                                <ActionButton onClick={() => handleCancelDeleteRequest(e.id)} title={t("ehs.title.rejectDelete")} color="#fff" bg="#e65100">❌</ActionButton>
                              </>
                            )}
                            {(userRole === "admin" || userRole === "ehs") && !e.deleteRequested && (
                              <ActionButton onClick={() => setEditModal({ isOpen: true, error: e, logId: e.id, department: dep.name })} title={t("ehs.title.editError")} color="#1565c0" bg="transparent">✏️</ActionButton>
                            )}
                            {(userRole === "admin" || userRole === "ehs") && !e.deleteRequested && (
                              <ActionButton onClick={() => handleDelete(e.id)} title={t("gemba.delete.action")} color="#d32f2f" bg="transparent">x</ActionButton>
                            )}
                          </div>
                      </td>
                      </tr>
                  )}) : ( <tr><td colSpan="8" style={{textAlign: 'center', padding: '20px'}}>{t("gemba.empty")}</td></tr> )}
                  </tbody>
              </table>
              ))}
            <div style={{ color: colors.textPrimary, fontWeight: 700, fontSize: 22, marginTop: 28, background: remainingScore < 80 ? "#ffe3e3" : "#e3fff1", borderRadius: 10, padding: "14px 18px", boxShadow: "0 1.5px 7px #00000011", width: "fit-content" }}>
              {t("ehs.report.remainingMonth").replace("{month}", selectedMonth.slice(5,7))} <span style={{ color: remainingScore < 80 ? colors.error : colors.success }}>{remainingScore.toFixed(2)}</span>
            </div>
          </div>
          <div style={{ width: '100%', order: isMobile ? 1 : 2, flexShrink: 0, [isMobile ? 'width' : 'maxWidth']: isMobile ? '100%' : 220 }}>
              {isMobile ? (
              <div style={{ marginBottom: 20 }}>
                  <label htmlFor="dept-select" style={{ fontWeight: 700, color: colors.primary, display: 'block', marginBottom: 8 }}>{t("ehs.report.selectDept")}</label>
                  <select id="dept-select" value={depIndex} onChange={(e) => handleSelectDepartment(parseInt(e.target.value, 10))} style={{ width: "100%", padding: "12px 15px", borderRadius: 8, border: `1.5px solid ${colors.primaryLight}`, fontSize: 16, background: colors.surface, fontWeight: 'bold', color: colors.textPrimary }}>
                  {departments.map((d, i) => (<option key={d.name} value={i}>{d.name}</option>))}
                  </select>
              </div>
              ) : (
              <div style={{ padding: 18, background: colors.primaryLight, borderRadius: 14, boxShadow: `0 1.5px 10px ${colors.primary}11` }}>
                  <div style={{ fontWeight: 700, color: colors.primary, marginBottom: 14, fontSize: 17 }}>{t("ehs.edit.dept")}</div>
                  <div>
                  {departments.map((d, i) => (
                      <button key={d.name} style={{ display: "block", width: "100%", marginBottom: 10, padding: "10px 15px", borderRadius: 8, border: "none", fontWeight: 600, fontSize: 15, background: depIndex === i ? colors.primary : colors.backgroundLight, color: depIndex === i ? colors.white : colors.primary, boxShadow: depIndex === i ? `0 1.5px 7px ${colors.primary}33` : "none", cursor: "pointer", transition: "all .13s", position: 'relative' }} onClick={() => handleSelectDepartment(i)}>
                      {d.name}
                      {newErrorCounts && newErrorCounts[d.name] > 0 && (
                        <span style={{ position: 'absolute', top: 5, right: 8, background: 'red', color: 'white', borderRadius: '50%', width: 20, height: 20, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                          {newErrorCounts[d.name]}
                        </span>
                      )}
                      </button>
                  ))}
                  </div>
              </div>
              )}
          </div>
        </div>
      </div>
      
      <CommentModal 
        isOpen={commentModal.isOpen} 
        onClose={() => setCommentModal({ isOpen: false, eventId: "", error: null })} 
        eventId={commentModal.eventId} 
        user={user} 
        error={commentModal.error}
      />
    </div>
  );
}

function CommentModal({ isOpen, onClose, eventId, user, error }) {
  const { t } = useI18n();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const scrollRef = useRef();

  const fetchComments = async () => {
    try {
      const allComments = await dbService.getDocs("audit_comments");
      const filtered = allComments.filter(c => c.eventId === eventId);
      filtered.sort((a, b) => {
        const timeA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (typeof a.timestamp === "string" ? new Date(a.timestamp).getTime() : 0);
        const timeB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (typeof b.timestamp === "string" ? new Date(b.timestamp).getTime() : 0);
        return timeA - timeB;
      });
      setComments(filtered);
    } catch (err) {
      console.error("Lỗi lấy bình luận:", err);
    }
  };

  useEffect(() => {
    if (!isOpen || !eventId) return;
    setLoadingComments(true);
    fetchComments().finally(() => setLoadingComments(false));
    const interval = setInterval(fetchComments, 10000);
    return () => clearInterval(interval);
  }, [isOpen, eventId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  const handleSend = async () => {
    if (!newComment.trim()) return;
    const txt = newComment.trim();
    setNewComment("");
    try {
      const nowStr = new Date().toISOString();
      await dbService.createDoc("audit_comments", {
        eventId,
        userId: user.uid,
        userName: user.name,
        text: txt,
        timestamp: nowStr
      });

      const creatorUid = error?.addedByUid;
      if (creatorUid && creatorUid !== user.uid) {
        const errorDesc = error?.desc || "Lỗi vi phạm";
        await dbService.createDoc("notifications", {
          type: "new_ehs_audit_comment",
          message: `${user.name} đã bình luận về lỗi EHS Audit của bạn ("${errorDesc}")`,
          targetUserId: creatorUid,
          createdBy: user.uid,
          readBy: [],
          timestamp: nowStr
        });
      }
      await fetchComments();
    } catch (err) {
      console.error("Lỗi gửi bình luận:", err);
      alert(t("ehs.comment.sendFail"));
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1002 }}>
      <div style={{ background: colors.surface, padding: 22, borderRadius: 12, width: '90%', maxWidth: 500, height: 500, display: 'flex', flexDirection: 'column', boxShadow: "0 4px 15px rgba(0,0,0,.2)" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `2.5px solid ${colors.primaryLight}`, paddingBottom: 10, marginBottom: 12 }}>
          <h3 style={{ margin: 0, color: colors.primary }}>{t("ehs.comment.title")}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888' }}>✕</button>
        </div>
        
        <div ref={scrollRef} style={{ flexGrow: 1, overflowY: 'auto', marginBottom: 15, paddingRight: 5 }}>
          {loadingComments ? (
            <div style={{ textAlign: 'center', color: '#888', marginTop: 20 }}>{t("ehs.comment.loading")}</div>
          ) : comments.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#888', marginTop: 20 }}>{t("ehs.comment.empty")}</div>
          ) : (
            comments.map(c => {
              const isMe = c.userId === user.uid;
              const date = c.timestamp ? (c.timestamp.toDate ? c.timestamp.toDate() : new Date(c.timestamp)) : null;
              const dateStr = date ? date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString('vi-VN') : '';
              return (
                <div key={c.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 2 }}>{c.userName} • {dateStr}</div>
                  <div style={{
                    background: isMe ? colors.primary : '#f1f1f1',
                    color: isMe ? colors.white : colors.textPrimary,
                    padding: '8px 14px',
                    borderRadius: 14,
                    borderTopRightRadius: isMe ? 2 : 14,
                    borderTopLeftRadius: isMe ? 14 : 2,
                    maxWidth: '85%',
                    fontSize: 14,
                    wordBreak: 'break-word',
                    lineHeight: '1.4'
                  }}>
                    {c.text}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
            placeholder={t("ehs.comment.placeholder")}
            style={{ flexGrow: 1, padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${colors.primaryLight}`, fontSize: 14, outline: 'none' }}
          />
          <button
            onClick={handleSend}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: colors.primary, color: colors.white, fontWeight: 700, cursor: 'pointer' }}
          >
            {t("common.send")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ====================== CLEANUP FUNCTION ======================
async function runCleanup() {
    const oneYearAgo = new Date();
    oneYearAgo.setMonth(oneYearAgo.getMonth() - 12);
    try {
        const allEvents = await dbService.getDocs("gemba_events");
        const toDeleteEvents = allEvents.filter(ev => {
          const ts = safeTsToDate(ev.timestamp);
          return ts && ts <= oneYearAgo;
        });
        if (toDeleteEvents.length > 0) {
          let batchOps = toDeleteEvents.map(ev => ({
            type: "delete",
            collection: "gemba_events",
            id: ev.id || ev.uid
          }));
          for (let i = 0; i < batchOps.length; i += 400) {
            await dbService.commitBatch(batchOps.slice(i, i + 400));
          }
        }
        
        const allScoresDocs = await dbService.getDocs("gemba_scores");
        for (const docData of allScoresDocs) {
            const scores = docData.scores || [];
            const imagesToDelete = [];
            const recentScores = scores.filter(score => {
                const scoreDate = safeTsToDate(score.timestamp);
                if (scoreDate && scoreDate < oneYearAgo) {
                    const allImages = [...(score.imageUrls || []), ...(score.imageUrl ? [score.imageUrl] : []), ...(score.improvementImageUrl ? [score.improvementImageUrl] : [])];
                    imagesToDelete.push(...allImages);
                    return false;
                }
                return true;
            });
            if (recentScores.length < scores.length) {
                const docId = docData.id || docData.uid;
                await dbService.updateDoc("gemba_scores", docId, { scores: recentScores });
                for (const url of imagesToDelete) {
                    try {
                        const filename = url.substring(url.lastIndexOf('/') + 1);
                        await apiClient.delete(`/api/storage/${filename}`);
                    } catch (error) {
                        console.error("Lỗi xóa ảnh cũ từ Storage:", error);
                    }
                }
            }
        }
    } catch (error) { console.error("Lỗi trong quá trình cleanup Gemba:", error); }
}

export default DailyAudit;