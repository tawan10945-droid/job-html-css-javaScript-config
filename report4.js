import { db } from '../config-firesbase/firebase-config.js';
import { ref, set, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ====================================
// Constants
// ====================================
const CHECKBOX_FIELDS = [
  // Transportation
  'car_company', 'car_sales', 'bus', 'plane',
  // Sales attendance
  'sales_no', 'sales_yes', 'sales_together', 'sales_separate',
  // Participants
  'teacherCheck', 'studentCheck', 'publicCheck',
  // Purpose
  'purposeAfterSale', 'purposePromotion', 'formatLecture', 'formatHandsOn',
  // Ceremonies
  'openCeremonyYes', 'openCeremonyNo', 'closeCeremonyYes', 'closeCeremonyNo',
  // Coffee break
  'coffeeYes', 'coffeeCompany', 'coffeeCollege', 'coffeeNo',
  // Lunch
  'lunchYes', 'lunchCompany', 'lunchCollege', 'lunchNo',
  // Certificate
  'certYes', 'certCompany', 'certCollege', 'certNo',
  // Guest speaker
  'guestSpeakerYes', 'guestSpeakerNo',
  // Documents
  'docCompany', 'docCompanySelf', 'docCompanyOutsource', 'docCollege',
  // Moving
  'move_all_top', 'move_all_bottom', 'move_partial'
];

// ====================================
// Utility Functions
// ====================================

/**
 * Get URL parameters
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
 * Format date to Thai format (DD/MM/YYYY พ.ศ.)
 */
function formatDateThai(isoDate) {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear() + 543;
  return `${day}/${month}/${year}`;
}

/**
 * Convert ISO date to Thai display format
 */
function isoToThai(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  return `${parseInt(day)}/${parseInt(month)}/${parseInt(year) + 543}`;
}

/**
 * Convert Thai date to ISO format
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
 * Update Thai date display on input field
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
 * Show status message
 */
function showStatus(message, color = "green") {
  const statusMsg = document.getElementById("statusMsg");
  statusMsg.textContent = message;
  statusMsg.style.color = color;
}

/**
 * Get value from element safely
 */
function getValue(id) {
  const element = document.getElementById(id);
  return element ? element.value : "";
}

/**
 * Get checkbox state safely
 */
function getCheckboxState(id) {
  const element = document.getElementById(id);
  return element ? element.checked : false;
}

/**
 * Set value to element safely
 */
function setValue(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.value = value || "";
  }
}

/**
 * Set checkbox state safely
 */
function setCheckboxState(id, checked) {
  const element = document.getElementById(id);
  if (element) {
    element.checked = !!checked;
  }
}

// ====================================
// Data Functions
// ====================================

/**
 * Load existing data from Firebase
 */
async function loadExistingData(jobNumber) {
  if (!jobNumber) return;

  try {
    const dataRef = ref(db, `report_training/${jobNumber}`);
    const snapshot = await get(dataRef);

    if (snapshot.exists()) {
      const data = snapshot.val();

      // Time fields
      setValue("time1", data.time1);
      setValue("time2", data.time2);
      setValue("time3", data.time3);
      setValue("time4", data.time4);

      // Date fields with Thai display
      if (data.date2) {
        const date2Value = data.date2.includes("-") && data.date2.length === 10 
          ? data.date2 
          : thaiToIso(data.date2);
        setValue("date2", date2Value);
        updateThaiDateDisplay("date2", date2Value);
      }

      if (data.date3) {
        const date3Value = data.date3.includes("-") && data.date3.length === 10 
          ? data.date3 
          : thaiToIso(data.date3);
        setValue("date3", date3Value);
        updateThaiDateDisplay("date3", date3Value);
      }

      // Text fields
      setValue("trainingTopic", data.trainingTopic);
      setValue("teacherSum", data.teacherSum);
      setValue("studentSum", data.studentSum);
      setValue("publicSum", data.publicSum);
      setValue("contractDays", data.contractDays);
      setValue("guestSpeakerName", data.guestSpeakerName);
      setValue("trainingSubject", data.trainingSubject);
      setValue("carry1", data.carry1);
      setValue("carryQty1", data.carryQty1);
      setValue("carry2", data.carry2);
      setValue("carryQty2", data.carryQty2);
      setValue("carry3", data.carry3);
      setValue("carryQty3", data.carryQty3);
      setValue("roomInfo", data.roomInfo);
      setValue("extraEquip", data.extraEquip);

      // Checkboxes
      CHECKBOX_FIELDS.forEach(field => {
        setCheckboxState(field, data[field]);
      });

      showStatus("📋 โหลดข้อมูลสำเร็จ!", "blue");
    }
  } catch (err) {
    console.error("Error loading data:", err);
    showStatus("❌ เกิดข้อผิดพลาดในการโหลดข้อมูล", "red");
  }
}

/**
 * Collect all form data
 */
function collectFormData() {
  const params = getParamsFromURL();
  
  const data = {
    jobNumber: getValue("jobNumberInput"),
    startDate: params.start,
    endDate: params.end,
    
    // Time fields
    time1: getValue("time1"),
    time2: getValue("time2"),
    time3: getValue("time3"),
    time4: getValue("time4"),
    
    // Date fields (ISO format)
    date2: getValue("date2"),
    date3: getValue("date3"),
    
    // Text fields
    trainingTopic: getValue("trainingTopic"),
    teacherSum: getValue("teacherSum"),
    studentSum: getValue("studentSum"),
    publicSum: getValue("publicSum"),
    contractDays: getValue("contractDays"),
    guestSpeakerName: getValue("guestSpeakerName"),
    trainingSubject: getValue("trainingSubject"),
    carry1: getValue("carry1"),
    carryQty1: getValue("carryQty1"),
    carry2: getValue("carry2"),
    carryQty2: getValue("carryQty2"),
    carry3: getValue("carry3"),
    carryQty3: getValue("carryQty3"),
    roomInfo: getValue("roomInfo"),
    extraEquip: getValue("extraEquip"),
    
    timestamp: new Date().toISOString()
  };

  // Add all checkbox states
  CHECKBOX_FIELDS.forEach(field => {
    data[field] = getCheckboxState(field);
  });

  return data;
}

/**
 * Save data to Firebase
 */
async function saveData() {
  const jobNum = getValue("jobNumberInput").trim();

  if (!jobNum) {
    alert("⚠️ กรุณากรอกเลขที่งานก่อนบันทึก");
    return;
  }

  const data = collectFormData();

  try {
    await set(ref(db, `report_training/${jobNum}`), data);
    showStatus("✅ บันทึกข้อมูลเรียบร้อยแล้ว!", "green");

    setTimeout(() => {
      window.location.href = "notchoose.html";
    }, 1500);
  } catch (err) {
    console.error("Error saving:", err);
    showStatus("❌ เกิดข้อผิดพลาด: " + err.message, "red");
  }
}

// ====================================
// Event Listeners
// ====================================

/**
 * Setup date change listeners
 */
function setupDateListeners() {
  const date2 = document.getElementById("date2");
  const date3 = document.getElementById("date3");

  if (date2) {
    date2.addEventListener("change", function() {
      updateThaiDateDisplay("date2", this.value);
    });
  }

  if (date3) {
    date3.addEventListener("change", function() {
      updateThaiDateDisplay("date3", this.value);
    });
  }
}

/**
 * Export saveFile to global scope for onclick
 */
window.saveFile = saveData;

// ====================================
// Initialize
// ====================================

/**
 * Initialize the form on page load
 */
document.addEventListener("DOMContentLoaded", () => {
  const params = getParamsFromURL();

  // Set initial values
  setValue("jobNumberInput", params.jobNumber);
  setValue("startDateInput", formatDateThai(params.start));
  setValue("endDateInput", formatDateThai(params.end));

  // Setup event listeners
  setupDateListeners();

  // Load existing data if job number exists
  if (params.jobNumber) {
    loadExistingData(params.jobNumber);
  }
});