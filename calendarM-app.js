import { db, storage } from '../config-firebase/firebase-config.js';
import {
  collection, getDocs, addDoc, deleteDoc, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import {
  ref as dbRef, get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

let allEvents = [];

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
function handleEventClick(info) {
  const data = info.event.extendedProps;
  
  if (data.type === "leave") {
    alert(`🏖 ข้อมูลวันลา\n\nชื่อ: ${info.event.title}\nวันที่: ${formatDateThai(data.realStart) || info.event.startStr} → ${formatDateThai(data.realEnd) || '-'}\nเหตุผล: ${data.reason || '-'}`);
    return;
  }
  
  if (data.type === "holiday") {
    alert(`🎉 วันหยุด\n\n${info.event.title}\nวันที่: ${formatDateThai(data.realDate) || info.event.startStr}`);
    return;
  }

  // Show modal for regular events
  let titleText = info.event.title;
  if (data.acknowledgedBy && Array.isArray(data.acknowledgedBy) && data.acknowledgedBy.length > 0) {
    titleText += ` (รับทราบโดย: ${data.acknowledgedBy.join(", ")})`;
  } else if (data.acknowledgedBy && typeof data.acknowledgedBy === 'string') {
    titleText += ` (รับทราบโดย: ${data.acknowledgedBy})`;
  } else if (data.acknowledged) {
    titleText += " (รับทราบแล้ว)";
  }
  
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
  document.getElementById("modalRemark").textContent = data.remark || "-";

  document.getElementById("eventModal").style.display = "block";
}

// Load Events from Firebase
async function loadEvents() {
  try {
    allEvents = [];

    // Load regular events
    const eventSnap = await get(dbRef(db, "events"));
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
    const leaveSnap = await get(dbRef(db, "Days/leaves"));
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
    const holidaySnap = await get(dbRef(db, "Days/holidays"));
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

// Setup Modal Handlers
function setupModalHandlers() {
  document.getElementById("closeModal").addEventListener("click", () => {
    document.getElementById("eventModal").style.display = "none";
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
}

// Initialize User Display
function initializeUserDisplay() {
  const urlParams = new URLSearchParams(window.location.search);
  const userName = urlParams.get('name') || 'ผู้ใช้';

  console.log("User Name:", userName);

  document.getElementById("displayName").textContent = userName;
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