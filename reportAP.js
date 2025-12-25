import { db } from '../config-firesbase/firebase-config.js';
import { ref, query, orderByChild, equalTo, get } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

// DOM Elements
const jobNumberInput = document.getElementById("jobNumberInput");
const searchBtn = document.getElementById("searchBtn");
const printBtn = document.getElementById("printBtn");

// ====================================
// Utility Functions
// ====================================

/**
 * ดึงค่าจาก URL parameters ที่ส่งมาจาก manageS.html
 */
function getParamsFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    jobNumber: urlParams.get('job'),
    start: urlParams.get('start'),
    end: urlParams.get('end')
  };
}

/**
 * ฟังก์ชันแปลงวันที่เป็น พ.ศ. (ว/ด/ป)
 */
function formatDateThai(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear() + 543; // แปลง ค.ศ. เป็น พ.ศ.
  return `${day}/${month}/${year}`;
}

// ====================================
// Data Functions
// ====================================

/**
 * ฟังก์ชันค้นหาและแสดงข้อมูลจาก Firebase
 */
async function searchAndDisplay(jobNum = null) {
  const jobNumber = jobNum || jobNumberInput.value.trim();
  
  if (!jobNumber) {
    alert("⚠️ กรุณากรอก Job Number");
    return;
  }

  try {
    // Query Realtime Database
    const eventsRef = ref(db, 'events');
    const q = query(eventsRef, orderByChild('jobNumber'), equalTo(jobNumber));
    const snapshot = await get(q);

    if (!snapshot.exists()) {
      alert("❌ ไม่พบข้อมูล Job Number: " + jobNumber);
      return;
    }

    // Get first matching record
    let data = null;
    snapshot.forEach((childSnapshot) => {
      if (!data) {
        data = childSnapshot.val();
      }
    });

    if (!data) {
      alert("❌ ไม่พบข้อมูล Job Number: " + jobNumber);
      return;
    }

    // แสดงข้อมูลในฟอร์ม
    populateForm(data);
    
    alert("✅ พบข้อมูล Job Number: " + jobNumber);

  } catch (error) {
    console.error("Error:", error);
    alert("❌ เกิดข้อผิดพลาด: " + error.message);
  }
}

/**
 * ฟังก์ชันใส่ข้อมูลลงในฟอร์ม
 */
function populateForm(data) {
  // แปลงวันที่ก่อน
  const formattedStart = formatDateThai(data.start);
  const formattedOrderDate = formatDateThai(data.orderDate);
  const formattedEnd = formatDateThai(data.end);

  // ใส่ข้อมูลในฟอร์ม
  document.getElementById("docNo").textContent = data.jobNumber || "";
  document.getElementById("jobNo").textContent = data.job || "";
  document.getElementById("assignedBy").textContent = (data.assigners || []).join(", ");
  document.getElementById("date").textContent = formattedStart;
  document.getElementById("orderDate").textContent = formattedOrderDate;
  document.getElementById("deadline").textContent = formattedEnd;
  document.getElementById("deadlines").textContent = formattedEnd;
  
  // แบ่งรายละเอียดเป็น 2 บรรทัด
  const detailsText = data.details || "";
  const maxLength = 100; // ความยาวสูงสุดต่อบรรทัด
  if (detailsText.length > maxLength) {
    document.getElementById("details").textContent = detailsText.substring(0, maxLength);
    document.getElementById("details2").textContent = detailsText.substring(maxLength);
  } else {
    document.getElementById("details").textContent = detailsText;
    document.getElementById("details2").textContent = "";
  }
  
  document.getElementById("location").textContent = data.location || "";
  document.getElementById("title").textContent = (data.workers || []).join(", ");
  document.getElementById("contactName").textContent = data.contactPerson || "-";
  document.getElementById("contactPhone").textContent = data.phoneNumber || "-";

  // Reset checkboxes
  resetCheckboxes();

  // เช็ค jobTypes
  if (data.jobTypes) {
    if (data.jobTypes.includes("ส่งมอบ")) document.getElementById("type1").checked = true;
    if (data.jobTypes.includes("ฝึกอบรม")) document.getElementById("type2").checked = true;
    if (data.jobTypes.includes("ตรวจเช็ค/ซ่อม")) document.getElementById("type3").checked = true;
    if (data.jobTypes.includes("Visit")) document.getElementById("type4").checked = true;

    const other = data.jobTypes.find(t =>
      !["ส่งมอบ", "ฝึกอบรม", "ตรวจเช็ค/ซ่อม", "Visit"].includes(t)
    );
    if (other) document.getElementById("type5").checked = true;
  }

  // สถานะงาน
  document.getElementById("success").checked = data.status === "เรียบร้อย";
  document.getElementById("fail").checked = data.status === "ไม่เรียบร้อย";
  document.getElementById("note").textContent = data.remark || "";
  document.getElementById("incompleteReason").textContent = data.incompleteReason || "";
}

/**
 * รีเซ็ต checkboxes ทั้งหมด
 */
function resetCheckboxes() {
  ["type1", "type2", "type3", "type4", "type5"].forEach(id => {
    document.getElementById(id).checked = false;
  });
}

// ====================================
// PDF Export Function
// ====================================

/**
 * ฟังก์ชันสร้าง PDF จากฟอร์ม
 */
function exportToPDF() {
  const element = document.getElementById("report");

  // ดึงเลข Job Number จากฟอร์ม
  const jobNumber = document.getElementById("docNo").textContent.trim() || "ใบสั่งงาน";
  const filename = `${jobNumber}.pdf`;

  html2pdf().set({
    margin: [0, 0, 0, 0],
    filename: filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { 
      scale: 2, 
      useCORS: true,
      windowHeight: element.scrollHeight,
      height: element.scrollHeight
    },
    jsPDF: { 
      unit: "px", 
      format: [element.offsetWidth, element.scrollHeight], 
      orientation: "portrait",
      hotfixes: ["px_scaling"]
    },
    pagebreak: { mode: 'avoid-all' }
  }).from(element).save();
}

// ====================================
// Event Listeners
// ====================================

/**
 * กดปุ่มค้นหา
 */
searchBtn.addEventListener("click", () => {
  searchAndDisplay();
});

/**
 * กด Enter ในช่องค้นหา
 */
jobNumberInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    searchAndDisplay();
  }
});

/**
 * กดปุ่มปริ้น PDF
 */
printBtn.addEventListener("click", exportToPDF);

// ====================================
// Initialize on Page Load
// ====================================

/**
 * โหลดข้อมูลอัตโนมัติถ้ามี jobNumber ใน URL
 */
window.addEventListener('DOMContentLoaded', () => {
  const params = getParamsFromURL();
  
  if (params.jobNumber) {
    jobNumberInput.value = params.jobNumber;
    
    if (params.start) console.log("วันเริ่ม:", params.start);
    if (params.end) console.log("วันสิ้นสุด:", params.end);
    
    searchAndDisplay(params.jobNumber);
  }
});