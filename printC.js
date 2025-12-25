// ==================== Import Firebase Database ====================
import { db } from '../config-firesbase/firebase-config.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ==================== Helper Functions ====================

/**
 * เพิ่ม 2 วันให้กับวันที่สำหรับ FullCalendar
 */
function addOneDayForCalendar(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 2);
  return d.toISOString().split("T")[0];
}

/**
 * แสดงวันที่และเวลาปัจจุบันในรูปแบบไทย
 */
function formatDateTimeThai() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear() + 543;
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `พิมพ์เมื่อ: ${day}/${month}/${year} เวลา ${hours}:${minutes} น.`;
}

/**
 * อัปเดตการแสดงผล Legend ตามข้อมูลที่มีจริง
 */
function updateLegendVisibility(events) {
  const statuses = new Set();
  const types = new Set();
  
  events.forEach(event => {
    if (event.type === "leave") {
      types.add("leave");
    } else if (event.type === "holiday") {
      types.add("holiday");
    } else if (event.status) {
      statuses.add(event.status);
    }
  });
  
  document.querySelectorAll('.legend-item').forEach(item => {
    const status = item.getAttribute('data-status');
    const type = item.getAttribute('data-type');
    
    if (status && !statuses.has(status)) {
      item.classList.add('hidden');
    } else if (type && !types.has(type)) {
      item.classList.add('hidden');
    } else {
      item.classList.remove('hidden');
    }
  });
}

// ==================== FullCalendar Event Content Renderer ====================

/**
 * สร้างเนื้อหาการแสดงผลของ Event
 */
function renderEventContent(arg) {
  const data = arg.event.extendedProps;
  const el = document.createElement("div");
  el.className = "event-card event-type";

  // วันลา
  if (data.type === "leave") {
    el.style.background = "#E3F2FD";
    el.style.color = "#1565C0";
    el.innerHTML = `
      <span class="event-title">🏖 ${arg.event.title}</span>
      <div class="event-detail">${data.reason || '-'}</div>
    `;
  } 
  // วันหยุด
  else if (data.type === "holiday") {
    el.style.background = "#FFF3E0";
    el.style.color = "#E65100";
    el.innerHTML = `
      <span class="event-title">🎉 ${arg.event.title}</span>
    `;
  } 
  // งาน/อีเวนต์ปกติ
  else {
    let acknowledgeLabel = "";
    
    // สร้างวงกลมแสดงสถานะ Acknowledge
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
      
      let circles = '<span class="status-circles">';
      for (let i = 0; i < totalWorkers; i++) {
        if (i < acknowledgedList.length) {
          circles += '<span class="status-circle checked">✓</span>';
        } else {
          circles += '<span class="status-circle unchecked"></span>';
        }
      }
      circles += '</span>';
      
      acknowledgeLabel = circles;
    }
    
    const locationDisplay = data.location || "-";
    const howtoDisplay = data.howto ? ` (${data.howto})` : "";
    
    el.innerHTML = `
      <span class="event-title">${arg.event.title}</span>
      <div class="event-detail">📍 ${locationDisplay}${howtoDisplay}</div>
      <div class="event-detail">🧰 ${data.jobTypes || "-"}</div>
      <div class="event-status">📌 ${data.status || "-"} ${acknowledgeLabel}</div>
    `;
  }

  return { domNodes: [el] };
}

// ==================== Data Loading Functions ====================

/**
 * โหลดข้อมูลงาน/อีเวนต์จาก Firebase
 */
async function loadEvents() {
  const events = [];
  const eventsRef = ref(db, "events");
  const eventsSnapshot = await get(eventsRef);
  
  if (eventsSnapshot.exists()) {
    const eventsData = eventsSnapshot.val();
    Object.entries(eventsData).forEach(([key, data]) => {
      let color = "#a0aec0";
      if (data.status === "รออนุมัติ") color = "gray";
      else if (data.status === "อนุมัติ") color = "#E3C565";
      else if (data.status === "เรียบร้อย") color = "green";
      else if (data.status === "ไม่เรียบร้อย") color = "#c00";

      events.push({
        id: key,
        title: Array.isArray(data.workers) ? data.workers.join(", ") : (data.workers || "-"),
        start: data.start || "",
        end: data.end ? addOneDayForCalendar(data.end) : undefined,
        location: data.location || "",
        howto: data.howto || "",
        jobNumber: data.jobNumber || "-",
        jobTypes: Array.isArray(data.jobTypes) ? data.jobTypes.join(", ") : (data.jobTypes || "-"),
        status: data.status || "รออนุมัติ",
        acknowledged: data.acknowledged || false,
        acknowledgedBy: data.acknowledgedBy || "",
        backgroundColor: color,
        borderColor: color,
        textColor: "#ffffff",
        type: "event",
        allDay: true
      });
    });
  }
  
  return events;
}

/**
 * โหลดข้อมูลวันลาจาก Firebase
 */
async function loadLeaves() {
  const leaves = [];
  const leavesRef = ref(db, "Days/leaves");
  const leavesSnapshot = await get(leavesRef);
  
  if (leavesSnapshot.exists()) {
    const leavesData = leavesSnapshot.val();
    Object.entries(leavesData).forEach(([key, data]) => {
      leaves.push({
        id: "leave-" + key,
        title: data.name || "ไม่ระบุชื่อ",
        start: data.start || "",
        end: data.end ? addOneDayForCalendar(data.end) : undefined,
        backgroundColor: "#4299e1",
        borderColor: "#4299e1",
        textColor: "#ffffff",
        type: "leave",
        reason: data.reason || "",
        allDay: true
      });
    });
  }
  
  return leaves;
}

/**
 * โหลดข้อมูลวันหยุดจาก Firebase
 */
async function loadHolidays() {
  const holidays = [];
  const holidaysRef = ref(db, "Days/holidays");
  const holidaysSnapshot = await get(holidaysRef);
  
  if (holidaysSnapshot.exists()) {
    const holidaysData = holidaysSnapshot.val();
    Object.entries(holidaysData).forEach(([key, data]) => {
      holidays.push({
        id: "holiday-" + key,
        title: data.name || "วันหยุด",
        start: data.date || "",
        end: data.date ? addOneDayForCalendar(data.date) : undefined,
        backgroundColor: "#ed8936",
        borderColor: "#ed8936",
        textColor: "#ffffff",
        type: "holiday",
        allDay: true
      });
    });
  }
  
  return holidays;
}

// ==================== Main Initialization ====================

document.addEventListener("DOMContentLoaded", async () => {
  // แสดงวันที่พิมพ์
  document.getElementById("printDate").textContent = formatDateTimeThai();

  const calendarEl = document.getElementById("calendar");
  calendarEl.innerHTML = '';
  calendarEl.className = '';
  
  // สร้าง FullCalendar
  const calendar = new FullCalendar.Calendar(calendarEl, {
    locale: "th",
    timeZone: "Asia/Bangkok",
    initialView: "dayGridWeek",
    firstDay: 1,
    weekends: true,
    headerToolbar: { 
      left: "prev,next today", 
      center: "title", 
      right: "" 
    },
    nowIndicator: true,
    height: 'parent',
    expandRows: true,
    eventContent: renderEventContent
  });

  calendar.render();
  console.log('Calendar rendered');

  try {
    // โหลดข้อมูลทั้งหมดจาก Firebase
    const [events, leaves, holidays] = await Promise.all([
      loadEvents(),
      loadLeaves(),
      loadHolidays()
    ]);
    
    const allEvents = [...events, ...leaves, ...holidays];
    
    // เพิ่มข้อมูลลงในปฏิทิน
    calendar.addEventSource(allEvents);
    calendar.refetchEvents();
    
    // อัปเดตการแสดง Legend
    updateLegendVisibility(allEvents);
    
    console.log('Events loaded:', allEvents.length);
  } catch (err) {
    console.error("Error loading calendar:", err);
    document.getElementById("calendar").innerHTML = `
      <div style="color: #c53030; text-align: center; padding: 3rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">❌</div>
        <strong style="font-size: 1.5rem; display: block; margin-bottom: 0.5rem;">เกิดข้อผิดพลาด</strong>
        <small style="color: #718096;">${err.message}</small>
      </div>`;
  }
});