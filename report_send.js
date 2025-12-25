// ==================== Import Firebase Database ====================
import { db } from '../config-firesbase/firebase-config.js';
import { ref, set, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ==================== Helper Functions ====================

/**
 * แปลงวันที่เป็น DD/MM/YYYY (พ.ศ.)
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
 * แปลงจาก ISO date (YYYY-MM-DD) เป็นวันที่ไทย (DD/MM/YYYY พ.ศ.)
 */
function isoToThai(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  return `${parseInt(day)}/${parseInt(month)}/${parseInt(year) + 543}`;
}

/**
 * แปลงจากวันที่ไทย (DD/MM/YYYY พ.ศ.) เป็น ISO (YYYY-MM-DD)
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
 * แสดงวันที่เป็นภาษาไทยบนช่อง input
 */
function updateThaiDateDisplay(fieldId, isoDate) {
  if (!isoDate) return;
  const thaiDate = isoToThai(isoDate);
  const field = document.getElementById(fieldId);
  field.setAttribute("data-thai-date", thaiDate);
}

// ==================== URL Parameters ====================

const params = new URLSearchParams(window.location.search);
const job = params.get("job") || "";
const start = params.get("start") || "";
const end = params.get("end") || "";

// ใส่ค่าในช่อง input
document.getElementById("jobNumberInput").value = job;
document.getElementById("startDateInput").value = formatDateThai(start);
document.getElementById("endDateInput").value = formatDateThai(end);

// ==================== Load Existing Data ====================

/**
 * โหลดข้อมูลเดิมจาก Firebase Realtime Database
 */
async function loadExistingData() {
  if (!job) return;
  
  const reportRef = ref(db, `report/${job}/report_send`);
  const snapshot = await get(reportRef);

  if (snapshot.exists()) {
    const data = snapshot.val();

    // เวลา
    document.getElementById("time1").value = data.time1 || "";
    
    // วันที่ (แปลงเป็น ISO format และแสดงเป็น พ.ศ.)
    if (data.date2) {
      if (data.date2.includes("-") && data.date2.length === 10) {
        document.getElementById("date2").value = data.date2;
        updateThaiDateDisplay("date2", data.date2);
      } else if (data.date2.includes("/")) {
        const iso = thaiToIso(data.date2);
        document.getElementById("date2").value = iso;
        updateThaiDateDisplay("date2", iso);
      }
    }
    
    document.getElementById("time2").value = data.time2 || "";
    
    if (data.date3) {
      if (data.date3.includes("-") && data.date3.length === 10) {
        document.getElementById("date3").value = data.date3;
        updateThaiDateDisplay("date3", data.date3);
      } else if (data.date3.includes("/")) {
        const iso = thaiToIso(data.date3);
        document.getElementById("date3").value = iso;
        updateThaiDateDisplay("date3", iso);
      }
    }
    
    document.getElementById("time3").value = data.time3 || "";
    document.getElementById("time4").value = data.time4 || "";

    // แผนการเดินทาง
    document.getElementById("car_company").checked = data.car_company || false;
    document.getElementById("car_sales").checked = data.car_sales || false;
    document.getElementById("bus").checked = data.bus || false;
    document.getElementById("plane").checked = data.plane || false;

    // Sales ไปด้วยหรือไม่
    document.getElementById("sales_no").checked = data.sales_no || false;
    document.getElementById("sales_yes").checked = data.sales_yes || false;
    document.getElementById("sales_together").checked = data.sales_together || false;
    document.getElementById("sales_separate").checked = data.sales_separate || false;

    // รายการอุปกรณ์
    if (data.items && Array.isArray(data.items)) {
      data.items.forEach((item, i) => {
        const index = i + 1;
        if (document.getElementById(`item${index}`)) {
          document.getElementById(`item${index}`).value = item.name || "";
          document.getElementById(`qty${index}`).value = item.qty || "";
        }
      });
    }

    // รูปแบบการขนย้าย
    document.getElementById("move_all_top").checked = data.move_all_top || false;
    document.getElementById("move_all_bottom").checked = data.move_all_bottom || false;
    document.getElementById("move_partial").checked = data.move_partial || false;

    // รายการขนย้ายเอง
    if (data.carry && Array.isArray(data.carry)) {
      data.carry.forEach((c, i) => {
        const index = i + 1;
        if (document.getElementById(`carry${index}`)) {
          document.getElementById(`carry${index}`).value = c.item || "";
          document.getElementById(`carryQty${index}`).value = c.qty || "";
        }
      });
    }

    // ข้อมูลเพิ่มเติม
    document.getElementById("roomInfo").value = data.roomInfo || "";
    document.getElementById("extraEquip").value = data.extraEquip || "";
  }
}

// เรียกโหลดข้อมูลทันทีเมื่อเปิดหน้า
loadExistingData();

// ==================== Event Listeners ====================

// อัพเดทแสดงวันที่ไทยเมื่อเลือกวันที่ใหม่
document.getElementById("date2").addEventListener("change", function() {
  updateThaiDateDisplay("date2", this.value);
});

document.getElementById("date3").addEventListener("change", function() {
  updateThaiDateDisplay("date3", this.value);
});

// ==================== Save Function ====================

/**
 * บันทึกข้อมูลลง Firebase Realtime Database
 */
window.saveFile = async function() {
  const jobNumber = document.getElementById("jobNumberInput").value.trim();
  if (!jobNumber) {
    alert("⚠️ กรุณากรอกเลขที่งานก่อนบันทึก");
    return;
  }

  const data = {
    jobNumber,
    startDate: document.getElementById("startDateInput").value,
    endDate: document.getElementById("endDateInput").value,
    time1: document.getElementById("time1").value,
    date2: document.getElementById("date2").value, // บันทึกเป็น ISO format (YYYY-MM-DD)
    time2: document.getElementById("time2").value,
    date3: document.getElementById("date3").value, // บันทึกเป็น ISO format (YYYY-MM-DD)
    time3: document.getElementById("time3").value,
    time4: document.getElementById("time4").value,
    car_company: document.getElementById("car_company").checked,
    car_sales: document.getElementById("car_sales").checked,
    bus: document.getElementById("bus").checked,
    plane: document.getElementById("plane").checked,
    sales_no: document.getElementById("sales_no").checked,
    sales_yes: document.getElementById("sales_yes").checked,
    sales_together: document.getElementById("sales_together").checked,
    sales_separate: document.getElementById("sales_separate").checked,
    items: [
      { name: document.getElementById("item1").value, qty: document.getElementById("qty1").value },
      { name: document.getElementById("item2").value, qty: document.getElementById("qty2").value },
      { name: document.getElementById("item3").value, qty: document.getElementById("qty3").value },
      { name: document.getElementById("item4").value, qty: document.getElementById("qty4").value },
      { name: document.getElementById("item5").value, qty: document.getElementById("qty5").value }
    ],
    move_all_top: document.getElementById("move_all_top").checked,
    move_all_bottom: document.getElementById("move_all_bottom").checked,
    move_partial: document.getElementById("move_partial").checked,
    carry: [
      { item: document.getElementById("carry1").value, qty: document.getElementById("carryQty1").value },
      { item: document.getElementById("carry2").value, qty: document.getElementById("carryQty2").value },
      { item: document.getElementById("carry3").value, qty: document.getElementById("carryQty3").value }
    ],
    roomInfo: document.getElementById("roomInfo").value,
    extraEquip: document.getElementById("extraEquip").value,
    timestamp: new Date().toISOString()
  };

  try {
    const reportRef = ref(db, `report/${jobNumber}/report_send`);
    await set(reportRef, data);
    
    document.getElementById("statusMsg").textContent = "✅ บันทึกข้อมูลเรียบร้อยแล้ว!";
    setTimeout(() => { window.location.href = "notchoose.html"; }, 1000);
  } catch (err) {
    document.getElementById("statusMsg").textContent = "❌ เกิดข้อผิดพลาด: " + err.message;
    document.getElementById("statusMsg").style.color = "red";
  }
};