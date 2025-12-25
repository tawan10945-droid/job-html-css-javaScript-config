// ==================== Import Firebase Database ====================
import { db } from '../config-firesbase/firebase-config.js';
import { ref, query, orderByChild, equalTo, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ==================== DOM Elements ====================
const jobNumberInput = document.getElementById("jobNumberInput");
const searchBtn = document.getElementById("searchBtn");
const printBtn = document.getElementById("printBtn");
const signatureImg = document.getElementById("signatureImg");

let isDataLoaded = false;

// ==================== Helper Functions ====================

/**
 * ดึงพารามิเตอร์จาก URL
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
 * แปลงวันที่เป็นรูปแบบไทย (DD/MM/YYYY พ.ศ.)
 */
function formatDateThai(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear() + 543;
  return `${day}/${month}/${year}`;
}

// ==================== Search and Display Function ====================

/**
 * ค้นหาและแสดงข้อมูลจาก Firebase
 */
async function searchAndDisplay(jobNum = null) {
  const jobNumber = jobNum || jobNumberInput.value.trim();
  
  if (!jobNumber) {
    alert("⚠️ กรุณากรอก Job Number");
    return;
  }

  document.getElementById("report").style.opacity = "0.5";
  isDataLoaded = false;

  try {
    // Query Realtime Database
    const eventsRef = ref(db, 'events');
    const q = query(eventsRef, orderByChild('jobNumber'), equalTo(jobNumber));
    const snapshot = await get(q);

    if (!snapshot.exists()) {
      alert("❌ ไม่พบข้อมูล Job Number: " + jobNumber);
      document.getElementById("report").style.opacity = "1";
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
      document.getElementById("report").style.opacity = "1";
      return;
    }
    
    // ตรวจสอบประเภทการเซ็นเอกสาร
    if (data.signType === "เซ็นเอง") {
      const currentParams = new URLSearchParams(window.location.search);
      window.location.href = `reportAp.html?${currentParams.toString()}`;
      return;
    }

    // แสดงลายเซ็นตามสถานะ
    const showSignature = data.status === "อนุมัติ" || 
                         data.status === "เรียบร้อย" || 
                         data.status === "ไม่เรียบร้อย";
    signatureImg.style.display = showSignature ? "block" : "none";
    
    // แปลงวันที่เป็นรูปแบบไทย
    const formattedStart = formatDateThai(data.start);
    const formattedOrderDate = formatDateThai(data.orderDate);
    const formattedEnd = formatDateThai(data.end);

    // กรอกข้อมูลในฟอร์ม
    document.getElementById("docNo").textContent = data.jobNumber || "";
    document.getElementById("jobNo").textContent = data.job || "";
    document.getElementById("assignedBy").textContent = (data.assigners || []).join(", ");
    document.getElementById("date").textContent = formattedStart;
    document.getElementById("orderDate").textContent = formattedOrderDate;
    document.getElementById("deadline").textContent = formattedEnd;
    document.getElementById("deadlines").textContent = formattedEnd;

    // แบ่งรายละเอียดงานถ้ายาวเกินไป
    const detailsText = data.details || "";
    const maxLength = 100;
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

    // ล้างช่องทำเครื่องหมาย
    ["type1", "type2", "type3", "type4", "type5"].forEach(id => {
      document.getElementById(id).checked = false;
    });

    // เลือกประเภทงาน
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

    // สถานะผลการปฏิบัติงาน
    document.getElementById("success").checked = data.status === "เรียบร้อย";
    document.getElementById("fail").checked = data.status === "ไม่เรียบร้อย";
    document.getElementById("note").textContent = data.remark || "";
    document.getElementById("incompleteReason").textContent = data.incompleteReason || "";

    isDataLoaded = true;
    document.getElementById("report").style.opacity = "1";
    alert("✅ พบข้อมูล Job Number: " + jobNumber);

  } catch (error) {
    console.error("Error:", error);
    alert("❌ เกิดข้อผิดพลาด: " + error.message);
    document.getElementById("report").style.opacity = "1";
    isDataLoaded = false;
  }
}

// ==================== PDF Export Function ====================

/**
 * สร้างและดาวน์โหลด PDF
 */
async function exportToPDF() {
  console.log("🔍 เริ่มตรวจสอบข้อมูลก่อนปริ้น...");
  
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

  const originalText = printBtn.textContent;
  printBtn.textContent = "⏳ กำลังสร้าง PDF...";
  printBtn.disabled = true;

  try {
    console.log("📄 เริ่มสร้าง PDF...");
    const element = document.getElementById("report");
    const filename = `${jobNumber}.pdf`;

    // โหลดรูปลายเซ็น (ถ้ามี)
    if (signatureImg && signatureImg.style.display !== "none") {
      console.log("⏳ รอโหลดรูปลายเซ็น...");
      
      const preloadImg = new Image();
      preloadImg.crossOrigin = "anonymous";
      preloadImg.src = signatureImg.src;
      
      await new Promise((resolve) => {
        if (signatureImg.complete && signatureImg.naturalWidth > 0) {
          console.log("✅ รูปลายเซ็นโหลดเสร็จแล้ว");
          resolve();
          return;
        }
        
        preloadImg.onload = () => {
          console.log("✅ Preload รูปลายเซ็นสำเร็จ");
          signatureImg.src = preloadImg.src;
          setTimeout(resolve, 500);
        };
        
        preloadImg.onerror = () => {
          console.log("⚠️ Preload รูปลายเซ็นล้มเหลว - ข้าม");
          resolve();
        };
        
        setTimeout(() => {
          console.log("⏱️ Timeout รูปลายเซ็น (8s)");
          resolve();
        }, 8000);
      });
    }

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
    printBtn.textContent = originalText;
    printBtn.disabled = false;
  }
}

// ==================== Event Listeners ====================

searchBtn.addEventListener("click", () => searchAndDisplay());

jobNumberInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") searchAndDisplay();
});

printBtn.addEventListener("click", exportToPDF);

// ==================== Page Load ====================

window.addEventListener('DOMContentLoaded', async () => {
  console.log("🌐 เริ่มโหลดหน้าเว็บ...");
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