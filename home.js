import { db } from '../config-firebase/firebase-config.js';
import { ref, get, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

let allEvents = [];
let currentEventId = null;
let currentJobNumber = null;

// Utility Functions
function addOneDayForCalendar(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 2);
  return d.toISOString().split("T")[0];
}

function formatDateThai(dateStr) {
  if (!dateStr || dateStr === "-") return "-";
  try {
    const date = new Date(dateStr + "T00:00:00");
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear() + 543;
    return `${day}-${month}-${year}`;
  } catch (err) {
    return dateStr;
  }
}

// Check Login Status
function checkLoginStatus() {
  const userId = sessionStorage.getItem("userId");
  const userName = sessionStorage.getItem("userName");

  if (!userId || !userName) {
    const overlay = document.createElement('div');
    overlay.className = 'custom-alert-overlay';
    
    overlay.innerHTML = `
      <div class="custom-alert-box">
        <div class="custom-alert-icon">⚠️</div>
        <h2 class="custom-alert-title">กรุณาเข้าสู่ระบบ</h2>
        <p class="custom-alert-message">กรุณาเข้าสู่ระบบก่อนเข้าใช้งาน</p>
        <p class="custom-alert-redirect">กำลังนำคุณกลับไปหน้าหลัก...</p>
        <div class="custom-alert-progress">
          <div class="custom-alert-progress-bar"></div>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 3000);
    
    throw new Error('Not logged in');
  }

  return { userId, userName };
}

// Initialize User Display
function initializeUserDisplay() {
  const { userName } = checkLoginStatus();
  
  console.log("User Name:", userName);
  
  document.getElementById("displayName").textContent = userName;
  document.getElementById('leaveDayLink').href = `leaveDay.html?name=${userName}`;
}

// Load Events from Firebase
async function loadEvents() {
  try {
    allEvents = [];

    // Load regular events
    const eventSnap = await get(ref(db, "events"));
    if (eventSnap.exists()) {
      const events = eventSnap.val();
      Object.keys(events).forEach(key => {
        const data = events[key];
        let color = "#A9A9A9";
        if (data.status === "รออนุมัติ") color = "gray";
        else if (data.status === "อนุมัติ") color = "#E3C565";
        else if (data.status === "อนุมัติด่วน") color = "#b23400";
        else if (data.status === "เรียบร้อย") color = "green";
        else if (data.status === "ไม่เรียบร้อย") color = "darkred";

        allEvents.push({
          id: key,
          title: Array.isArray(data.workers) ? data.workers.join(", ") : (data.workers || "-"),
          start: data.start || "",
          end: data.end ? addOneDayForCalendar(data.end) : undefined,
          location: data.location || "",
          howto: data.howto || "",
          assignedBy: Array.isArray(data.assigners) ? data.assigners.join(", ") : (data.assigners || "-"),
          jobNumber: data.jobNumber || "-",
          jobTypes: Array.isArray(data.jobTypes) ? data.jobTypes.join(", ") : (data.jobTypes || "-"),
          details: data.details || "-",
          status: data.status || "รออนุมัติ",
          incompleteReason: data.incompleteReason || "",
          remark: data.remark || "",
          realStart: data.start || "-",
          realEnd: data.end || "-",
          acknowledged: data.acknowledged || false,
          acknowledgedBy: data.acknowledgedBy || "",
          backgroundColor: color,
          borderColor: color,
          textColor: "#fff",
          type: "event",
          allDay: true
        });
      });
    }

    // Load leave days
    const leaveSnap = await get(ref(db, "Days/leaves"));
    if (leaveSnap.exists()) {
      const leaves = leaveSnap.val();
      Object.keys(leaves).forEach(key => {
        const data = leaves[key];
        allEvents.push({
          id: "leave-" + key,
          title: data.name || "ไม่ระบุชื่อ",
          start: data.start || "",
          end: data.end ? addOneDayForCalendar(data.end) : undefined,
          realStart: data.start || "",
          realEnd: data.end || "",
          backgroundColor: "#2196F3",
          borderColor: "#2196F3",
          textColor: "#000000",
          type: "leave",
          reason: data.reason || "",
          allDay: true
        });
      });
    }

    // Load holidays
    const holidaySnap = await get(ref(db, "Days/holidays"));
    if (holidaySnap.exists()) {
      const holidays = holidaySnap.val();
      Object.keys(holidays).forEach(key => {
        const data = holidays[key];
        allEvents.push({
          id: "holiday-" + key,
          title: data.name || "วันหยุด",
          start: data.date || "",
          end: data.date ? addOneDayForCalendar(data.date) : undefined,
          realDate: data.date || "",
          backgroundColor: "#FF9800",
          borderColor: "#FF9800",
          textColor: "#fff",
          type: "holiday",
          allDay: true
        });
      });
    }

    return allEvents;
  } catch (err) {
    console.error("Error fetching events:", err);
    alert("เกิดข้อผิดพลาดขณะดึงข้อมูล โปรดดู console");
    return [];
  }
}

// Render Event Content
function renderEventContent(arg) {
  const data = arg.event.extendedProps;
  const el = document.createElement("div");

  if (data.type === "leave") {
    el.innerHTML = `<div style="background:#E3F2FD;border-left:5px solid #2196F3;padding:8px;border-radius:8px;">
      <strong>🏖 ${arg.event.title}</strong><br><small>เหตุผล: ${data.reason||'-'}</small></div>`;
  } else if (data.type === "holiday") {
    el.innerHTML = `<div style="background:#FF9800;border-radius:8px;padding:8px;color:#fff;text-align:center;">🎉 ${arg.event.title}</div>`;
  } else {
    let acknowledgeLabel = "";
    if (data.status !== "เรียบร้อย" && data.status !== "ไม่เรียบร้อย") {
      let workersList = [];
      if (arg.event.title && typeof arg.event.title === 'string') {
        workersList = arg.event.title.split(",").map(name => name.trim()).filter(name => name.length > 0);
      }
      const totalWorkers = workersList.length;
      
      let acknowledgedList = [];
      if (data.acknowledgedBy) {
        if (Array.isArray(data.acknowledgedBy)) {
          acknowledgedList = data.acknowledgedBy.map(name => name.trim().normalize('NFC'));
        } else if (typeof data.acknowledgedBy === 'string' && data.acknowledgedBy.trim() !== '') {
          acknowledgedList = data.acknowledgedBy.split(",").map(name => name.trim().normalize('NFC'));
        }
      }
      
      let circles = "";
      for (let i = 0; i < totalWorkers; i++) {
        if (i < acknowledgedList.length) {
          circles += `<span style="display:inline-block;width:16px;height:16px;background:#4CAF50;border-radius:50%;margin:0 2px;text-align:center;line-height:16px;color:#fff;font-size:10px;">✓</span>`;
        } else {
          circles += `<span style="display:inline-block;width:16px;height:16px;background:rgba(255,255,255,0.3);border:2px solid #fff;border-radius:50%;margin:0 2px;"></span>`;
        }
      }
      
      acknowledgeLabel = circles;
    }
    
    const locationDisplay = data.location || "-";
    const howtoDisplay = data.howto ? ` (${data.howto})` : "";
    
    el.innerHTML = `<div style="position:relative;width:100%;">
        <strong>${arg.event.title}</strong>
        </div><small>🧰 ${data.jobNumber || "-"}</small><br><small>📍 ${locationDisplay}${howtoDisplay}</small><br><small>🧰 ${data.jobTypes || "-"}</small><br><small>📌 ${data.status || "-"} ${acknowledgeLabel}</small>`;
  }

  return { domNodes: [el] };
}

// Handle Event Click
async function handleEventClick(info) {
  const data = info.event.extendedProps;
  
  // Handle leave events
  if (data.type === "leave") {
    alert(`🏖 ข้อมูลวันลา\n\nชื่อ: ${info.event.title}\nวันที่: ${formatDateThai(data.realStart) || info.event.startStr} → ${formatDateThai(data.realEnd) || '-'}\nเหตุผล: ${data.reason || '-'}`);
    return;
  }
  
  // Handle holiday events
  if (data.type === "holiday") {
    alert(`🎉 วันหยุด\n\n${info.event.title}\nวันที่: ${formatDateThai(data.realDate) || info.event.startStr}`);
    return;
  }

  currentEventId = info.event.id;
  currentJobNumber = data.jobNumber || "";

  const currentUser = sessionStorage.getItem("userName");
  const normalizedCurrentUser = currentUser ? currentUser.trim().normalize('NFC') : "";

  let workersList = [];
  if (info.event.title && typeof info.event.title === 'string') {
    workersList = info.event.title.split(",").map(name => name.trim().normalize('NFC'));
  }

  const isOwner = workersList.includes(normalizedCurrentUser);

  let titleText = info.event.title;
  if (data.acknowledgedBy && Array.isArray(data.acknowledgedBy) && data.acknowledgedBy.length > 0) {
    titleText += ` (รับทราบโดย: ${data.acknowledgedBy.join(", ")})`;
  } else if (data.acknowledgedBy && typeof data.acknowledgedBy === 'string') {
    titleText += ` (รับทราบโดย: ${data.acknowledgedBy})`;
  } else if (data.acknowledged) {
    titleText += " (รับทราบแล้ว)";
  }
  
  // Populate modal
  document.getElementById("modalTitle").textContent = titleText;
  document.getElementById("modalJobNumber").textContent = data.jobNumber || "-";
  document.getElementById("modalJobTypes").textContent = data.jobTypes || "-";
  document.getElementById("modalLocation").textContent = data.location || "-";
  document.getElementById("modalHowto").textContent = data.howto || "-";
  document.getElementById("modalStart").textContent = formatDateThai(data.realStart);
  document.getElementById("modalEnd").textContent = formatDateThai(data.realEnd);
  document.getElementById("modalDetails").textContent = data.details || "-";
  document.getElementById("modalAssignedBy").textContent = data.assignedBy || "-";
  document.getElementById("modalStatus").textContent = data.status || "-";
  document.getElementById("modalIncompleteReason").textContent = data.incompleteReason || "-";
  document.getElementById("modalRemarkInput").value = data.remark || "";

  const disableEdit = data.status === "เรียบร้อย" || data.status === "ไม่เรียบร้อย";

  // Show/hide buttons based on ownership
  if (isOwner) {
    document.getElementById("btnComplete").style.display = "inline-block";
    document.getElementById("btnIncomplete").style.display = "inline-block";
    document.getElementById("btnDetail").style.display = "inline-block";
    document.getElementById("modalRemarkInput").style.display = "block";
    document.getElementById("btnSaveRemark").style.display = "block";
    
    const allParagraphs = document.querySelectorAll(".modal-content p");
    allParagraphs.forEach(p => {
      if (p.innerHTML.includes("หมายเหตุ:")) {
        p.style.display = "block";
      }
    });
    
    document.getElementById("btnComplete").disabled = disableEdit;
    document.getElementById("btnIncomplete").disabled = disableEdit;
    document.getElementById("btnDetail").disabled = disableEdit;
    document.getElementById("modalRemarkInput").disabled = disableEdit;
  } else {
    document.getElementById("btnComplete").style.display = "none";
    document.getElementById("btnIncomplete").style.display = "none";
    document.getElementById("btnDetail").style.display = "none";
    document.getElementById("modalRemarkInput").style.display = "none";
    document.getElementById("btnSaveRemark").style.display = "none";
    
    const allParagraphs = document.querySelectorAll(".modal-content p");
    allParagraphs.forEach(p => {
      if (p.innerHTML.includes("หมายเหตุ:")) {
        p.style.display = "none";
      }
    });
  }

  // Handle acknowledge button
  if (data.status === "อนุมัติ" || data.status === "อนุมัติด่วน") {
    document.getElementById("btnAcknowledge").style.display = "inline-block";
  } else {
    document.getElementById("btnAcknowledge").style.display = (data.acknowledged === false) ? "none" : "inline-block";
  }

  document.getElementById("eventModal").style.display = "block";
}

// Initialize Calendar
async function initializeCalendar() {
  const calendarEl = document.getElementById("calendar");
  const events = await loadEvents();
  
  const calendar = new FullCalendar.Calendar(calendarEl, {
    locale: "th",
    timeZone: "Asia/Bangkok",
    initialView: window.innerWidth < 700 ? "listWeek" : "dayGridMonth",
    headerToolbar: { 
      left: "prev,next today", 
      center: "title", 
      right: "dayGridMonth,dayGridWeek,listWeek" 
    },
    eventContent: renderEventContent,
    eventClick: handleEventClick,
    events: events
  });

  calendar.render();
}

// Modal Button Handlers
function setupModalHandlers() {
  // Close modal
  document.getElementById("closeModal").addEventListener("click", () => {
    document.getElementById("eventModal").style.display = "none";
  });

  // Complete button
  document.getElementById("btnComplete").addEventListener("click", async () => {
    if (!currentEventId) return;
    try {
      await update(ref(db, `events/${currentEventId}`), { 
        status: "เรียบร้อย", 
        updatedAt: new Date().toISOString() 
      });
      alert("✅ อัปเดตสถานะเป็น 'เรียบร้อย'");
      location.reload();
    } catch (err) {
      console.error("Error update complete:", err);
      alert("❌ เกิดข้อผิดพลาดในการบันทึก");
    }
  });

  // Incomplete button
  document.getElementById("btnIncomplete").addEventListener("click", async () => {
    if (!currentEventId) return;
    const reason = prompt("⚠️ กรุณากรอกเหตุผลที่ไม่เรียบร้อย:", "");
    if (reason === null) return;
    if (reason.trim() === "") {
      alert("❗ กรุณากรอกเหตุผลให้ครบถ้วน");
      return;
    }
    try {
      await update(ref(db, `events/${currentEventId}`), { 
        status: "ไม่เรียบร้อย", 
        incompleteReason: reason, 
        updatedAt: new Date().toISOString() 
      });
      alert("❌ อัปเดตสถานะเป็น 'ไม่เรียบร้อย' และบันทึกเหตุผลแล้ว");
      location.reload();
    } catch (err) {
      console.error("Error update incomplete:", err);
      alert("❌ เกิดข้อผิดพลาดในการบันทึก");
    }
  });

  // Save remark button
  document.getElementById("btnSaveRemark").addEventListener("click", async () => {
    if (!currentEventId) return;
    const remark = document.getElementById("modalRemarkInput").value || "";
    try {
      await update(ref(db, `events/${currentEventId}`), { 
        remark, 
        updatedAt: new Date().toISOString() 
      });
      alert("💾 บันทึกหมายเหตุเรียบร้อยแล้ว");
    } catch (err) {
      console.error("Error saving remark:", err);
      alert("❌ เกิดข้อผิดพลาดในการบันทึกหมายเหตุ");
    }
  });

  // Acknowledge button
  document.getElementById("btnAcknowledge").addEventListener("click", async () => {
    if (!currentEventId) return;
    
    const currentUser = sessionStorage.getItem("userName");
    
    if (!currentUser || currentUser === "ไม่ระบุชื่อ") {
      alert("❌ กรุณา Login ก่อนใช้งาน");
      return;
    }
    
    const currentEvent = allEvents.find(e => e.id === currentEventId);
    
    if (!currentEvent) {
      alert("❌ ไม่พบข้อมูลงาน");
      return;
    }
    
    let workersList = [];
    if (currentEvent.title && typeof currentEvent.title === 'string') {
      workersList = currentEvent.title.split(",").map(name => name.trim()).filter(name => name.length > 0);
    }
    
    if (workersList.length === 0) {
      alert("⚠️ ไม่มีข้อมูลผู้ปฏิบัติงาน");
      return;
    }
    
    const normalizedUser = currentUser.trim().normalize('NFC');
    const normalizedWorkers = workersList.map(w => w.trim().normalize('NFC'));
    
    if (!normalizedWorkers.includes(normalizedUser)) {
      alert(`⚠️ คุณไม่สามารถรับทราบงานนี้ได้ เนื่องจากไม่ใช่ผู้ปฏิบัติงาน\n\nชื่อของคุณ: ${currentUser}\nผู้ปฏิบัติงาน: ${workersList.join(", ")}`);
      return;
    }
    
    try {
      let acknowledgedByList = [];
      
      if (currentEvent.acknowledgedBy) {
        if (Array.isArray(currentEvent.acknowledgedBy)) {
          acknowledgedByList = currentEvent.acknowledgedBy.map(name => name.trim().normalize('NFC'));
        } else if (typeof currentEvent.acknowledgedBy === 'string' && currentEvent.acknowledgedBy.trim() !== '') {
          acknowledgedByList = currentEvent.acknowledgedBy.split(",").map(name => name.trim().normalize('NFC'));
        }
      }
      
      if (!acknowledgedByList.includes(normalizedUser)) {
        acknowledgedByList.push(normalizedUser);
      } else {
        alert("⚠️ คุณได้รับทราบงานนี้แล้ว");
        return;
      }
      
      await update(ref(db, `events/${currentEventId}`), { 
        acknowledged: true, 
        acknowledgedBy: acknowledgedByList,
        acknowledgedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString() 
      });
      
      alert(`📌 รับทราบงานเรียบร้อยแล้วโดย: ${currentUser}\n\nรับทราบทั้งหมด (${acknowledgedByList.length}/${workersList.length}):\n${acknowledgedByList.join(", ")}`);
      location.reload();
    } catch (err) {
      console.error("Error acknowledging:", err);
      alert("❌ เกิดข้อผิดพลาดในการบันทึก: " + err.message);
    }
  });

  // Detail button
  document.getElementById("btnDetail").addEventListener("click", () => {
    if (!currentJobNumber) return alert("ไม่พบเลขงาน");
    const url = new URL("detail.html", window.location.href);
    url.searchParams.set("jobNumber", document.getElementById("modalJobNumber").textContent);
    url.searchParams.set("location", document.getElementById("modalLocation").textContent);
    url.searchParams.set("howto", document.getElementById("modalHowto").textContent);
    url.searchParams.set("jobTypes", document.getElementById("modalJobTypes").textContent);
    url.searchParams.set("details", document.getElementById("modalDetails").textContent);
    url.searchParams.set("start", document.getElementById("modalStart").textContent);
    url.searchParams.set("end", document.getElementById("modalEnd").textContent);
    window.open(url.toString(), "_blank");
  });
}

// Setup Sidebar Handlers
function setupSidebarHandlers() {
  document.getElementById('openSidebarBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('show');
  });

  document.getElementById('closeSidebarBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('show');
  });

  document.getElementById('sidebarOverlay').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('show');
  });

  document.getElementById("printCalendarBtn").addEventListener("click", () => {
    window.location.href = "printC.html";
  });
}

// Initialize App
document.addEventListener("DOMContentLoaded", async () => {
  try {
    initializeUserDisplay();
    setupSidebarHandlers();
    setupModalHandlers();
    await initializeCalendar();
  } catch (error) {
    console.error("Initialization error:", error);
  }
});