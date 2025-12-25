import { db } from '../config-firesbase/firebase-config.js';
import { ref, set, get } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

// ====================================
// DOM Elements
// ====================================
const jobNumberInput = document.getElementById("jobNumberInput");
const startDateInput = document.getElementById("startDateInput");
const endDateInput = document.getElementById("endDateInput");
const statusMsg = document.getElementById("statusMsg");

// Time inputs
const time1 = document.getElementById("time1");
const time2 = document.getElementById("time2");
const time3 = document.getElementById("time3");
const time4 = document.getElementById("time4");

// Date inputs
const date2 = document.getElementById("date2");
const date3 = document.getElementById("date3");

// Equipment inputs
const PLC1 = document.getElementById("PLC1");
const ver = document.getElementById("ver");
const BOT = document.getElementById("BOT");
const ver2 = document.getElementById("ver2");
const tableSize = document.getElementById("tableSize");
const otherEquip = document.getElementById("otherEquip");
const roomInfo = document.getElementById("roomInfo");

// Carry items
const carry1 = document.getElementById("carry1");
const carryQty1 = document.getElementById("carryQty1");
const carry2 = document.getElementById("carry2");
const carryQty2 = document.getElementById("carryQty2");
const carry3 = document.getElementById("carry3");
const carryQty3 = document.getElementById("carryQty3");

// Checkbox IDs
const CHECKBOX_IDS = [
  "car_company", "car_sales", "bus", "plane",
  "sales_no", "sales_yes", "sales_together", "sales_separate",
  "company_have", "company_not_have",
  "schedule_have", "schedule_not_have",
  "map_have", "map_not_have",
  "plug_have", "plug_not_have",
  "air_have", "air_not_have",
  "MPUA", "MPUB", "MPUC", "MPUD",
  "MC_01", "MC_02", "MC_03",
  "move_all_top", "move_all_bottom", "move_partial"
];

// ====================================
// Utility Functions
// ====================================

/**
 * ดึงค่าจาก query string
 */
function getParamsFromURL() {
  const params = new URLSearchParams(window.location.search);
  return {
    jobNumber: params.get("job") || "",
    start: params.get("start") || "",
    end: params.get("end") || ""
  };
}

/**
 * ฟังก์ชันแปลงวันที่เป็น DD/MM/YYYY (พ.ศ.)
 */
function formatDateThai(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear() + 543;
  return `${day}/${month}/${year}`;
}

/**
 * ฟังก์ชันแปลงจาก ISO date (YYYY-MM-DD) กลับไปเป็นวันที่ไทย
 */
function isoToThai(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  return `${parseInt(day)}/${parseInt(month)}/${parseInt(year) + 543}`;
}

/**
 * ฟังก์ชันแปลงจากวันที่ไทย (DD/MM/YYYY พ.ศ.) เป็น ISO (YYYY-MM-DD)
 */
function thaiToIso(thaiDate) {
  if (!thaiDate || !thaiDate.includes("/")) return "";
  const parts = thaiDate.split("/");
  if (parts.length !== 3) return "";
  const day = parts[0].padStart(2, "0");
  const month = parts[1].padStart(2, "0");
  const year = parseInt(parts[2]) - 543;
  return `${year}-${month}-${day}`;
}

/**
 * ฟังก์ชันแสดงวันที่เป็นภาษาไทยบนช่อง input
 */
function updateThaiDateDisplay(fieldId, isoDate) {
  if (!isoDate) return;
  const thaiDate = isoToThai(isoDate);
  const field = document.getElementById(fieldId);
  field.setAttribute("data-thai-date", thaiDate);
}

/**
 * แสดงสถานะข้อความ
 */
function showStatus(message, color = "green") {
  statusMsg.textContent = message;
  statusMsg.style.color = color;
}

// ====================================
// Data Functions
// ====================================

/**
 * ฟังก์ชันโหลดข้อมูลจาก Realtime Database ตาม jobNumber
 */
async function loadData(jobNumber) {
  if (!jobNumber) return;

  try {
    const dataRef = ref(db, `report2/${jobNumber}`);
    const snap = await get(dataRef);

    if (snap.exists()) {
      const d = snap.val();

      // ใส่ค่าเวลา
      time1.value = d.time1 || "";
      time2.value = d.time2 || "";
      time3.value = d.time3 || "";
      time4.value = d.time4 || "";

      // แสดงวันที่ใน input type="date" (ISO format)
      if (d.date2) {
        if (d.date2.includes("-") && d.date2.length === 10) {
          date2.value = d.date2;
          updateThaiDateDisplay("date2", d.date2);
        } else if (d.date2.includes("/")) {
          const iso = thaiToIso(d.date2);
          date2.value = iso;
          updateThaiDateDisplay("date2", iso);
        }
      }

      if (d.date3) {
        if (d.date3.includes("-") && d.date3.length === 10) {
          date3.value = d.date3;
          updateThaiDateDisplay("date3", d.date3);
        } else if (d.date3.includes("/")) {
          const iso = thaiToIso(d.date3);
          date3.value = iso;
          updateThaiDateDisplay("date3", iso);
        }
      }

      // checkbox
      for (const key of CHECKBOX_IDS) {
        const element = document.getElementById(key);
        if (element) {
          element.checked = !!d[key];
        }
      }

      // text fields
      PLC1.value = d.PLC1 || "";
      ver.value = d.ver || "";
      BOT.value = d.BOT || "";
      ver2.value = d.ver2 || "";
      tableSize.value = d.tableSize || "";
      otherEquip.value = d.otherEquip || "";
      roomInfo.value = d.roomInfo || "";

      // carry items
      if (d.carry && d.carry.length) {
        carry1.value = d.carry[0]?.item || "";
        carryQty1.value = d.carry[0]?.qty || "";
        carry2.value = d.carry[1]?.item || "";
        carryQty2.value = d.carry[1]?.qty || "";
        carry3.value = d.carry[2]?.item || "";
        carryQty3.value = d.carry[2]?.qty || "";
      }

      showStatus("📄 โหลดข้อมูลสำเร็จ!", "blue");
    }
  } catch (error) {
    console.error("Error loading data:", error);
    showStatus("❌ เกิดข้อผิดพลาดในการโหลดข้อมูล", "red");
  }
}

/**
 * รวบรวมข้อมูล checkbox
 */
function getCheckboxData() {
  const data = {};
  for (const key of CHECKBOX_IDS) {
    const element = document.getElementById(key);
    if (element) {
      data[key] = element.checked;
    }
  }
  return data;
}

/**
 * ฟังก์ชันบันทึกข้อมูล
 */
async function saveData() {
  const jobNum = jobNumberInput.value.trim();
  
  if (!jobNum) {
    alert("⚠️ กรุณากรอกเลขที่งานก่อนบันทึก");
    return;
  }

  // รวบรวมข้อมูล checkbox
  const checkboxData = getCheckboxData();

  // สร้าง object ข้อมูล
  const data = {
    jobNumber: jobNum,
    date1: startDateInput.value,
    time1: time1.value,
    date2: date2.value, // บันทึกเป็น ISO format
    time2: time2.value,
    date3: date3.value, // บันทึกเป็น ISO format
    time3: time3.value,
    date4: endDateInput.value,
    time4: time4.value,

    // รวมข้อมูล checkbox ทั้งหมด
    ...checkboxData,

    // ข้อมูลอุปกรณ์
    PLC1: PLC1.value,
    ver: ver.value,
    BOT: BOT.value,
    ver2: ver2.value,
    tableSize: tableSize.value,
    otherEquip: otherEquip.value,

    // รายการขนย้าย
    carry: [
      { item: carry1.value, qty: carryQty1.value },
      { item: carry2.value, qty: carryQty2.value },
      { item: carry3.value, qty: carryQty3.value }
    ],

    roomInfo: roomInfo.value,
    timestamp: new Date().toISOString()
  };

  try {
    await set(ref(db, `report2/${jobNum}`), data);
    showStatus("✅ บันทึกข้อมูลเรียบร้อยแล้ว!", "green");
    
    // Redirect หลังจาก 1 วินาที
    setTimeout(() => {
      window.location.href = "notchoose.html";
    }, 1000);
  } catch (err) {
    console.error("Error saving data:", err);
    showStatus("❌ เกิดข้อผิดพลาด: " + err.message, "red");
  }
}

// ====================================
// Event Listeners
// ====================================

/**
 * อัพเดทแสดงวันที่ไทยเมื่อเลือกวันที่ใหม่
 */
date2.addEventListener("change", function() {
  updateThaiDateDisplay("date2", this.value);
});

date3.addEventListener("change", function() {
  updateThaiDateDisplay("date3", this.value);
});

/**
 * Export ฟังก์ชัน saveFile ไปยัง global scope เพื่อให้ onclick ใช้งานได้
 */
window.saveFile = saveData;

// ====================================
// Initialize on Page Load
// ====================================

/**
 * โหลดข้อมูลเมื่อหน้าเว็บพร้อม
 */
document.addEventListener("DOMContentLoaded", () => {
  const params = getParamsFromURL();
  
  // ใส่ค่าจาก URL parameters
  jobNumberInput.value = params.jobNumber;
  startDateInput.value = formatDateThai(params.start);
  endDateInput.value = formatDateThai(params.end);
  
  // ถ้ามี jobNumber → โหลดข้อมูลทันที
  if (params.jobNumber) {
    loadData(params.jobNumber);
  }
});