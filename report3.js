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
const time4 = document.getElementById("time4");

// Date inputs
const date2 = document.getElementById("date2");
const warranty_until = document.getElementById("warranty_until");

// Transportation checkboxes
const car_company = document.getElementById("car_company");
const car_sales = document.getElementById("car_sales");
const bus = document.getElementById("bus");
const plane = document.getElementById("plane");

// Sales attendance checkboxes
const sales_no = document.getElementById("sales_no");
const sales_yes = document.getElementById("sales_yes");
const sales_together = document.getElementById("sales_together");
const sales_separate = document.getElementById("sales_separate");

// Repair details
const repair_detail = document.getElementById("repair_detail");
const warranty_yes = document.getElementById("warranty_yes");
const warranty_no = document.getElementById("warranty_no");

// Location inputs
const building = document.getElementById("building");
const floor = document.getElementById("floor");

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
  if (field) {
    field.setAttribute("data-thai-date", thaiDate);
  }
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
async function loadData(jobNum) {
  if (!jobNum) return;

  try {
    const dataRef = ref(db, `report3/${jobNum}`);
    const snap = await get(dataRef);

    if (snap.exists()) {
      const d = snap.val();

      // ใส่ค่าเวลา
      time1.value = d.time1 || "";
      time2.value = d.time2 || "";
      time4.value = d.time4 || "";

      // แสดงวันที่ตรวจซ่อม
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

      // Transportation checkboxes
      car_company.checked = d.car_company || false;
      car_sales.checked = d.car_sales || false;
      bus.checked = d.bus || false;
      plane.checked = d.plane || false;

      // Sales attendance checkboxes
      sales_no.checked = d.sales_no || false;
      sales_yes.checked = d.sales_yes || false;
      sales_together.checked = d.sales_together || false;
      sales_separate.checked = d.sales_separate || false;

      // Repair details
      repair_detail.value = d.repair_detail || "";
      warranty_yes.checked = d.warranty_yes || false;
      warranty_no.checked = d.warranty_no || false;

      // Warranty date
      if (d.warranty_until) {
        if (d.warranty_until.includes("-") && d.warranty_until.length === 10) {
          warranty_until.value = d.warranty_until;
          updateThaiDateDisplay("warranty_until", d.warranty_until);
        } else if (d.warranty_until.includes("/")) {
          const iso = thaiToIso(d.warranty_until);
          warranty_until.value = iso;
          updateThaiDateDisplay("warranty_until", iso);
        }
      }

      // Location
      building.value = d.building || "";
      floor.value = d.floor || "";

      showStatus("📋 โหลดข้อมูลสำเร็จ!", "blue");
    }
  } catch (error) {
    console.error("Error loading data:", error);
    showStatus("❌ เกิดข้อผิดพลาดในการโหลดข้อมูล", "red");
  }
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

  // สร้าง object ข้อมูล
  const data = {
    jobNumber: jobNum,
    date1: startDateInput.value,
    time1: time1.value,
    date2: date2.value, // บันทึกเป็น ISO format
    time2: time2.value,
    date4: endDateInput.value,
    time4: time4.value,

    // Transportation
    car_company: car_company.checked,
    car_sales: car_sales.checked,
    bus: bus.checked,
    plane: plane.checked,

    // Sales attendance
    sales_no: sales_no.checked,
    sales_yes: sales_yes.checked,
    sales_together: sales_together.checked,
    sales_separate: sales_separate.checked,

    // Repair details
    repair_detail: repair_detail.value,
    warranty_yes: warranty_yes.checked,
    warranty_no: warranty_no.checked,
    warranty_until: warranty_until.value, // บันทึกเป็น ISO format

    // Location
    building: building.value,
    floor: floor.value,

    timestamp: new Date().toISOString()
  };

  try {
    await set(ref(db, `report3/${jobNum}`), data);
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

warranty_until.addEventListener("change", function() {
  updateThaiDateDisplay("warranty_until", this.value);
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