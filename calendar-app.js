/* ===== Calendar Application JavaScript ===== */
import { db } from '../config-firebase/firebase-config.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

// ================== User Session Management ==================
const urlParams = new URLSearchParams(window.location.search);
let userName = urlParams.get('name');
let userId = urlParams.get('userId');
let userPosition = urlParams.get('position');

// ถ้าไม่มีใน URL ให้ลองดึงจาก sessionStorage
if (!userName) {
  userName = sessionStorage.getItem('userName');
  userId = sessionStorage.getItem('userId');
  userPosition = sessionStorage.getItem('userPosition');
}

// แสดงชื่อผู้ใช้
if (userName) {
  document.getElementById('displayName').textContent = userName;
  // เก็บลง sessionStorage สำหรับใช้ต่อ
  sessionStorage.setItem('userName', userName);
  if (userId) sessionStorage.setItem('userId', userId);
  if (userPosition) sessionStorage.setItem('userPosition', userPosition);
} else {
  document.getElementById('displayName').textContent = 'Guest';
}

// ================== URL Helper Functions ==================
function createURLWithUser(baseUrl, additionalParams = {}) {
  const params = new URLSearchParams({
    name: userName || 'Guest',
    userId: userId || '',
    position: userPosition || '',
    ...additionalParams
  });
  return `${baseUrl}?${params.toString()}`;
}

// ================== Sidebar Navigation ==================
document.getElementById('navAddJob').addEventListener('click', (e) => {
  e.preventDefault();
  window.location.href = createURLWithUser('notchoose.html');
});

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

// ================== Date Utility Functions ==================
function addOneDayForCalendar(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 2);
  return d.toISOString().split("T")[0];
}

function addOneDay(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

// ================== Event Content Renderer ==================
function renderEventContent(arg) {
  const data = arg.event.extendedProps;
  const el = document.createElement("div");

  if (data.type === "leave") {
    el.innerHTML = `<div style="background:#E3F2FD;border-left:5px solid #2196F3;padding:8px;border-radius:8px;">
      <strong>🏖 ${arg.event.title}</strong><br><small>เหตุผล: ${data.reason || '-'}</small></div>`;
  } else if (data.type === "holiday") {
    el.innerHTML = `<div style="background:#FF9800;border-radius:8px;padding:8px;color:#fff;text-align:center;">🎉 ${arg.event.title}</div>`;
  } else {
    let acknowledgeLabel = "";
    if (data.status !== "เรียบร้อย" && data.status !== "ไม่เรียบร้อย") {
      // นับจำนวนคนทั้งหมดในงาน
      let workersList = [];
      if (arg.event.title && typeof arg.event.title === 'string') {
        workersList = arg.event.title.split(",").map(name => name.trim()).filter(name => name.length > 0);
      }
      const totalWorkers = workersList.length;

      // นับจำนวนคนที่รับทราบแล้ว
      let acknowledgedList = [];
      if (data.acknowledgedBy) {
        if (Array.isArray(data.acknowledgedBy)) {
          acknowledgedList = data.acknowledgedBy.map(name => name.trim().normalize('NFC'));
        } else if (typeof data.acknowledgedBy === 'string' && data.acknowledgedBy.trim() !== '') {
          acknowledgedList = data.acknowledgedBy.split(",").map(name => name.trim().normalize('NFC'));
        }
      }

      // สร้างวงกลมและเครื่องหมายถูก
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
        </div><small>📍 ${locationDisplay}${howtoDisplay}</small><br><small>🧰 ${data.jobTypes || "-"}</small><br><small>📌 ${data.status || "-"} ${acknowledgeLabel}</small>`;
  }

  return { domNodes: [el] };
}

// ================== Calendar Initialization ==================
document.addEventListener("DOMContentLoaded", async function () {
  const calendarEl = document.getElementById("calendar");
  const calendar = new FullCalendar.Calendar(calendarEl, {
    locale: "th",
    initialView: window.innerWidth < 600 ? "listWeek" : "dayGridMonth",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,listWeek"
    },
    eventContent: renderEventContent,
    eventClick: function (info) {
      const id = info.event.id;
      window.location.href = createURLWithUser('notchoose.html', { id: id });
    },
    windowResize: function () {
      if (window.innerWidth < 600) {
        calendar.changeView('listWeek');
      } else {
        calendar.changeView('dayGridMonth');
      }
    }
  });

  const allEvents = [];

  try {
    // ================== Load Events ==================
    const eventsRef = ref(db, "events");
    const eventsSnapshot = await get(eventsRef);

    if (eventsSnapshot.exists()) {
      const events = eventsSnapshot.val();
      Object.keys(events).forEach(eventId => {
        const data = events[eventId];
        let color = "gray";
        if (data.status === "อนุมัติ") color = "#E3C565";
        else if (data.status === "อนุมัติด่วน") color = "#b23400";
        else if (data.status === "เรียบร้อย") color = "green";
        else if (data.status === "ไม่เรียบร้อย") color = "darkred";

        allEvents.push({
          id: eventId,
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

    // ================== Load Leaves ==================
    const leavesRef = ref(db, "Days/leaves");
    const leavesSnapshot = await get(leavesRef);

    if (leavesSnapshot.exists()) {
      const leaves = leavesSnapshot.val();
      Object.keys(leaves).forEach(leaveId => {
        const data = leaves[leaveId];
        allEvents.push({
          id: "leave-" + leaveId,
          title: data.name || "-",
          start: data.start || "",
          end: addOneDay(data.end),
          backgroundColor: "#2196F3",
          borderColor: "#2196F3",
          textColor: "#000",
          reason: data.reason || "",
          type: "leave",
          allDay: true
        });
      });
    }

    // ================== Load Holidays ==================
    const holidaysRef = ref(db, "Days/holidays");
    const holidaysSnapshot = await get(holidaysRef);

    if (holidaysSnapshot.exists()) {
      const holidays = holidaysSnapshot.val();
      Object.keys(holidays).forEach(holidayId => {
        const data = holidays[holidayId];
        allEvents.push({
          id: "holiday-" + holidayId,
          title: data.name || "วันหยุด",
          start: data.date || "",
          end: data.date || "",
          backgroundColor: "#FF9800",
          borderColor: "#FF9800",
          textColor: "#fff",
          type: "holiday",
          allDay: true,
          reason: data.reason || ""
        });
      });
    }

    // ================== Render Calendar ==================
    calendar.addEventSource(allEvents);
    calendar.render();

    // ================== Search Button ==================
    document.getElementById("btnSearch").addEventListener("click", () => {
      const keyword = document.getElementById("jobSearch").value.trim().toLowerCase();
      const filtered = keyword
        ? allEvents.filter(e => e.jobNumber && e.jobNumber.toLowerCase().includes(keyword))
        : allEvents;

      if (filtered.length === 0) {
        alert("❌ ไม่พบงานนี้");
        return;
      }

      calendar.removeAllEvents();
      calendar.addEventSource(filtered);
      calendar.changeView(window.innerWidth < 600 ? "listWeek" : "dayGridMonth");

      const firstEvent = filtered[0];
      if (firstEvent.start) {
        calendar.gotoDate(firstEvent.start);
      }
    });

    // ================== Report Button ==================
    document.getElementById("btnReport").addEventListener("click", () => {
      const keyword = document.getElementById("jobSearch").value.trim();
      if (!keyword) {
        alert("กรุณากรอกเลขที่งานก่อนดูรายงาน");
        return;
      }
      const event = allEvents.find(e => e.jobNumber && e.jobNumber.toLowerCase() === keyword.toLowerCase());
      if (!event) {
        alert("❌ ไม่พบงานนี้");
        return;
      }
      window.location.href = `seereport.html?job=${encodeURIComponent(event.jobNumber)}`;
    });

  } catch (err) {
    console.error("❌ โหลดข้อมูลจาก Firebase ไม่สำเร็จ:", err);
    calendar.render();
  }
});