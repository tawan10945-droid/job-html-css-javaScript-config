import { db } from '../config-firesbase/firebase-config.js';
import { ref, query, orderByChild, equalTo, get } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

// ====================================
// DOM Elements
// ====================================
const jobNumberInput = document.getElementById("jobNumberInput");
const searchBtn = document.getElementById("searchBtn");
const printBtn = document.getElementById("printBtn");
const signatureImg = document.getElementById("signatureImg");
const reportContainer = document.getElementById("report");

// ====================================
// State Management
// ====================================
let isDataLoaded = false;

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

/**
 * รีเซ็ต checkboxes ทั้งหมด
 */
function resetCheckboxes() {
  ["type1", "type2", "type3", "type4", "type5"].forEach(id => {
    document.getElementById(id).checked = false;
  });
}

/**
 * แสดง/ซ่อนลายเซ็น
 */
function showSignature(shouldShow) {
  signatureImg.style.display = shouldShow ? "block" : "none";
}

/**
 * ตั้งค่าสถานะการโหลดข้อมูล
 */
function setLoadingState(isLoading) {
  reportContainer.style.opacity = isLoading ? "0.5" : "1";
  isDataLoaded = !isLoading;
}

// ====================================
// Data Functions
// ====================================

/**
 * ฟังก์ชันใส่ข้อมูลลงในฟอร์ม
 */
function populateForm(data) {
  // แปลงวันที่
  const formattedStart = formatDateThai(data.start);
  const formattedOrderDate = formatDateThai(data.orderDate);
  const formattedEnd = formatDateThai(data.end);

  // ใส่ข้อมูลพื้นฐาน
  document.getElementById("docNo").textContent = data.jobNumber || "";
  document.getElementById("jobNo").textContent = data.job || "";
  document.getElementById("assignedBy").textContent = (data.assigners || []).join(", ");
  document.getElementById("date").textContent = formattedStart;
  document.getElementById("orderDate").textContent = formattedOrderDate;
  document.getElementById("deadline").textContent = formattedEnd;
  document.getElementById("deadlines").textContent = formattedEnd;
  
  // แบ่งรายละเอียดเป็น 2 บรรทัด
  const detailsText = data.details || "";
  const maxLength = 100;
  if (detailsText.length > maxLength) {
    document.getElementById("details").textContent = detailsText.substring(0, maxLength);
    document.getElementById("details2").textContent = detailsText.substring(maxLength);
  } else {
    document.getElementById("details").textContent = detailsText;
    document.getElementById("details2").textContent = "";
  }
  
  // ข้อมูลที่ตั้งและผู้ติดต่อ
  document.getElementById("location").textContent = data.location || "";
  document.getElementById("title").textContent = (data.workers || []).join(", ");
  document.getElementById("contactName").textContent = data.contactPerson || "-";
  document.getElementById("contactPhone").textContent = data.phoneNumber || "-";

  // รีเซ็ต checkboxes
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

  // แสดงลายเซ็นตามสถานะ
  const shouldShowSignature = ["อนุมัติ", "เรียบร้อย", "ไม่เรียบร้อย"].includes(data.status);
  showSignature(shouldShowSignature);
}

/**
 * ฟังก์ชันค้นหาและแสดงข้อมูลจาก Firebase
 */
async function searchAndDisplay(jobNum = null) {
  const jobNumber = jobNum || jobNumberInput.value.trim();
  
  if (!jobNumber) {
    alert("⚠️ กรุณากรอก Job Number");
    return;
  }

  setLoadingState(true);

  try {
    // Query Realtime Database
    const eventsRef = ref(db, 'events');
    const q = query(eventsRef, orderByChild('jobNumber'), equalTo(jobNumber));
    const snapshot = await get(q);

    if (!snapshot.exists()) {
      alert("❌ ไม่พบข้อมูล Job Number: " + jobNumber);
      setLoadingState(false);
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
      setLoadingState(false);
      return;
    }
    
    // ถ้าเป็นประเภท "เซ็นเอง" ให้ redirect ไปหน้าอื่น
    if (data.signType === "เซ็นเอง") {
      const currentParams = new URLSearchParams(window.location.search);
      window.location.href = `reportAp.html?${currentParams.toString()}`;
      return;
    }

    // แสดงข้อมูลในฟอร์ม
    populateForm(data);
    
    setLoadingState(false);
    alert("✅ พบข้อมูล Job Number: " + jobNumber);

  } catch (error) {
    console.error("Error:", error);
    alert("❌ เกิดข้อผิดพลาด: " + error.message);
    setLoadingState(false);
  }
}

// ====================================
// PDF Export Function
// ====================================

/**
 * Preload รูปลายเซ็นก่อนสร้าง PDF
 */
async function preloadSignatureImage() {
  if (!signatureImg || signatureImg.style.display === "none") {
    return;
  }

  console.log("⏳ รอโหลดรูปลายเซ็น...");
  
  return new Promise((resolve) => {
    // ถ้ารูปโหลดเสร็จแล้ว
    if (signatureImg.complete && signatureImg.naturalWidth > 0) {
      console.log("✅ รูปลายเซ็นโหลดเสร็จแล้ว");
      resolve();
      return;
    }
    
    // Preload รูปภาพ
    const preloadImg = new Image();
    preloadImg.crossOrigin = "anonymous";
    preloadImg.src = signatureImg.src;
    
    preloadImg.onload = () => {
      console.log("✅ Preload รูปลายเซ็นสำเร็จ");
      signatureImg.src = preloadImg.src;
      setTimeout(resolve, 500);
    };
    
    preloadImg.onerror = () => {
      console.log("⚠️ Preload รูปลายเซ็นล้มเหลว - ข้าม");
      resolve();
    };
    
    // Timeout หลัง 8 วินาที
    setTimeout(() => {
      console.log("⏱️ Timeout รูปลายเซ็น (8s)");
      resolve();
    }, 8000);
  });
}

/**
 * ฟังก์ชันสร้าง PDF จากฟอร์ม
 */
async function exportToPDF() {
  console.log("🔍 เริ่มตรวจสอบข้อมูลก่อนปริ้น...");
  
  // ตรวจสอบว่ามีข้อมูลหรือไม่
  if (!isDataLoaded) {
    alert("⚠️ กรุณาค้นหาข้อมูลก่อนปริ้น!");
    return;
  }

  const jobNumber = document.getElementById("docNo").textContent.trim();
  if (!jobNumber) {
    alert("⚠️ ไม่พบข้อมูลในฟอร์ม กรุณาค้นหาใหม่!");
    isDataLoaded = false;
    return;
  }

  // ตั้งค่าสถานะปุ่ม
  const originalText = printBtn.textContent;
  printBtn.textContent = "⏳ กำลังสร้าง PDF...";
  printBtn.disabled = true;

  try {
    console.log("📄 เริ่มสร้าง PDF...");
    const element = reportContainer;
    const filename = `${jobNumber}.pdf`;

    // Preload รูปลายเซ็น
    await preloadSignatureImage();

    // รอให้ DOM เรนเดอร์
    console.log("⏳ รอ DOM เรนเดอร์...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log("🎨 กำลัง render HTML to Canvas...");

    // สร้าง PDF
    await html2pdf().set({
      margin: 0,
      filename: filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { 
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        logging: false,
        letterRendering: true,
        windowHeight: 297 * 3.7795275591,
        height: 297 * 3.7795275591,
        backgroundColor: '#ffffff',
        removeContainer: true,
        imageTimeout: 15000
      },
      jsPDF: { 
        unit: "mm", 
        format: "a4", 
        orientation: "portrait",
        compress: true
      },
      pagebreak: { mode: 'avoid-all' }
    }).from(element).save();

    console.log("✅ PDF สร้างสำเร็จ!");
    alert("✅ สร้าง PDF สำเร็จ: " + filename);

  } catch (error) {
    console.error("❌ PDF Error:", error);
    alert("❌ เกิดข้อผิดพลาด: " + error.message);
  } finally {
    // คืนค่าปุ่ม
    printBtn.textContent = originalText;
    printBtn.disabled = false;
  }
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
window.addEventListener('DOMContentLoaded', async () => {
  console.log("🌐 เริ่มโหลดหน้าเว็บ...");
  
  // รอให้ Firebase พร้อม
  await new Promise(resolve => setTimeout(resolve, 1500));
  console.log("✅ Firebase พร้อมใช้งาน");
  
  const params = getParamsFromURL();
  
  if (params.jobNumber) {
    jobNumberInput.value = params.jobNumber;
    
    if (params.start) console.log("วันเริ่ม:", params.start);
    if (params.end) console.log("วันสิ้นสุด:", params.end);
    
    searchAndDisplay(params.jobNumber);
  }
});