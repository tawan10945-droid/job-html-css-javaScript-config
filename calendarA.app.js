/* ===== Calendar Application JavaScript ===== */
import { db } from '../config-firebase/firebase-config.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

// ✅ รับข้อมูลจาก URL parameters
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

// ตรวจสอบการ login
if (!userName && !sessionStorage.getItem('userName')) {
  // สร้าง custom alert
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

// ✅ อัพเดท header title ตาม position
const headerTitleElement = document.querySelector('.header-title');
if (userPosition === 'admin') {
  headerTitleElement.textContent = '📅 ปฏิทินงาน (ADMIN)';
} else if (userPosition === 'sales') {
  headerTitleElement.textContent = '📅 ปฏิทินงาน (SALES)';
} else {
  headerTitleElement.textContent = '📅 ปฏิทินงาน (SALES & ADMIN)';
}

if (userPosition === 'sales') {
  const adminLink = document.querySelector('#sidebar a[href="adminV2.html"]');
  if (adminLink) {
    adminLink.style.display = 'none';
  }
}

// ✅ ฟังก์ชันสร้าง URL พร้อมชื่อผู้ใช้
function createURLWithUser(baseUrl, additionalParams = {}) {
  const params = new URLSearchParams({
    name: userName || 'Guest',
    userId: userId || '',
    position: userPosition || '',
    ...additionalParams
  });
  return `${baseUrl}?${params.toString()}`;
}

// ✅ เมื่อคลิกปุ่ม "เพิ่มงาน" ส่งชื่อไปด้วย
document.getElementById('navAddJob').addEventListener('click', (e) => {
  e.preventDefault();
  window.location.href = createURLWithUser('notchoose.html');
});

// Sidebar toggle
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

// ✅ ฟังก์ชันบวก 2 วันสำหรับแสดงในปฏิทินให้ครบ
function addOneDayForCalendar(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 2);
  return d.toISOString().split("T")[0];
}

// ✅ ฟังก์ชันแปลงวันที่เป็นรูปแบบไทย
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

// ตัวแปรเก็บ event ID ปัจจุบันที่เปิดใน Modal
let currentEventId = null;

document.addEventListener("DOMContentLoaded", async function() {
  const calendarEl = document.getElementById("calendar");
  const calendar = new FullCalendar.Calendar(calendarEl, {
    locale: "th",
    initialView: window.innerWidth < 600 ? "listWeek" : "dayGridMonth",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,dayGridWeek,listWeek"
    },
    eventContent: function(arg) {
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
            </div><small>🧰 ${data.jobNumber || "-"}</small><br><small>📍 ${locationDisplay}${howtoDisplay}</small><br><small>🧰 ${data.jobTypes || "-"}</small><br><small>📌 ${data.status || "-"} ${acknowledgeLabel}</small>`;
      }

      return { domNodes: [el] };
    },
    eventClick: function(info) {
      const data = info.event.extendedProps;
      
      // ✅ แสดง Alert สำหรับวันลา
      if (data.type === "leave") {
        alert(`🏖 ข้อมูลวันลา\n\nชื่อ: ${info.event.title}\nวันที่: ${formatDateThai(data.realStart) || info.event.startStr} → ${formatDateThai(data.realEnd) || '-'}\nเหตุผล: ${data.reason || '-'}`);
        return;
      }
      
      // ✅ แสดง Alert สำหรับวันหยุด
      if (data.type === "holiday") {
        alert(`🎉 วันหยุด\n\n${info.event.title}\nวันที่: ${formatDateThai(data.realDate) || info.event.startStr}`);
        return;
      }

      // ✅ แสดง Modal สำหรับงานปกติ
      currentEventId = info.event.id;

      let titleText = info.event.title;
      if (data.acknowledgedBy && Array.isArray(data.acknowledgedBy) && data.acknowledgedBy.length > 0) {
        titleText += ` (รับทราบโดย: ${data.acknowledgedBy.join(", ")})`;
      } else if (data.acknowledgedBy && typeof data.acknowledgedBy === 'string' && data.acknowledgedBy.trim() !== '') {
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
    },
    windowResize: function() {
      if(window.innerWidth < 600){
        calendar.changeView('listWeek');
      } else {
        calendar.changeView('dayGridMonth');
      }
    }
  });

  const allEvents = [];

  try {
    // ✅ อ่านข้อมูล events จาก Realtime Database
    const eventsRef = ref(db, "events");
    const eventsSnapshot = await get(eventsRef);

    // ✅ อ่านข้อมูล leaves จาก Realtime Database
    const leavesRef = ref(db, "Days/leaves");
    const leavesSnapshot = await get(leavesRef);

    // ✅ อ่านข้อมูล holidays จาก Realtime Database
    const holidaysRef = ref(db, "Days/holidays");
    const holidaysSnapshot = await get(holidaysRef);

    function addOneDay(dateStr){
      if(!dateStr) return "";
      const d = new Date(dateStr);
      d.setDate(d.getDate()+1);
      return d.toISOString().split("T")[0];
    }

    // ✅ ประมวลผล events
    if (eventsSnapshot.exists()) {
      const events = eventsSnapshot.val();
      Object.keys(events).forEach(eventId => {
        const data = events[eventId];
        let color = "gray";
        if(data.status==="อนุมัติ") color="#E3C565";
        else if (data.status === "อนุมัติด่วน") color = "#b23400";
        else if(data.status==="เรียบร้อย") color="green";
        else if(data.status==="ไม่เรียบร้อย") color="darkred";

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

    // ✅ ประมวลผล leaves
    if (leavesSnapshot.exists()) {
      const leaves = leavesSnapshot.val();
      Object.keys(leaves).forEach(leaveId => {
        const data = leaves[leaveId];
        allEvents.push({
          id: "leave-" + leaveId,
          title: data.name||"-",
          start: data.start||"",
          end: addOneDay(data.end),
          realStart: data.start || "",
          realEnd: data.end || "",
          backgroundColor: "#2196F3",
          borderColor: "#2196F3",
          textColor: "#000",
          reason: data.reason||"",
          type: "leave",
          allDay: true
        });
      });
    }

    // ✅ ประมวลผล holidays
    if (holidaysSnapshot.exists()) {
      const holidays = holidaysSnapshot.val();
      Object.keys(holidays).forEach(holidayId => {
        const data = holidays[holidayId];
        allEvents.push({
          id: "holiday-" + holidayId,
          title: data.name || "วันหยุด",
          start: data.date || "",
          end: data.date || "",
          realDate: data.date || "",
          backgroundColor: "#FF9800",
          borderColor: "#FF9800",
          textColor: "#fff",
          type: "holiday",
          allDay: true,
          reason: data.reason || ""
        });
      });
    }

    calendar.addEventSource(allEvents);
    calendar.render();

    // 🔹 ปุ่มค้นหา
    document.getElementById("btnSearch").addEventListener("click", ()=>{
      const keyword = document.getElementById("jobSearch").value.trim().toLowerCase();
      const filtered = keyword 
        ? allEvents.filter(e => e.jobNumber && e.jobNumber.toLowerCase().includes(keyword)) 
        : allEvents;

      if(filtered.length === 0){
        alert("❌ ไม่พบงานนี้");
        return;
      }

      calendar.removeAllEvents();
      calendar.addEventSource(filtered);
      calendar.changeView(window.innerWidth < 600 ? "listWeek" : "dayGridMonth");

      const firstEvent = filtered[0];
      if(firstEvent.start){
        calendar.gotoDate(firstEvent.start);
      }
    });

    // 🔹 ปุ่มดูรายงาน
    document.getElementById("btnReport").addEventListener("click", ()=>{
      const keyword = document.getElementById("jobSearch").value.trim();
      if(!keyword){
        alert("กรุณากรอกเลขที่งานก่อนดูรายงาน");
        return;
      }
      const event = allEvents.find(e => e.jobNumber && e.jobNumber.toLowerCase() === keyword.toLowerCase());
      if(!event){
        alert("❌ ไม่พบงานนี้");
        return;
      }
      window.location.href = `seereport.html?job=${encodeURIComponent(event.jobNumber)}`;
    });

  } catch(err){
    console.error("❌ โหลดข้อมูลจาก Firebase ไม่สำเร็จ:", err);
    calendar.render();
  }

  // ✅ ปุ่มปิด Modal
  document.getElementById("closeModal").addEventListener("click", () => {
    document.getElementById("eventModal").style.display = "none";
    currentEventId = null;
  });

  // ✅ ปุ่มแก้ไขงาน (เปิดหน้า notchoose.html พร้อม event ID)
  document.getElementById("editJobBtn").addEventListener("click", () => {
    if (currentEventId) {
      window.location.href = createURLWithUser('notchoose.html', { id: currentEventId });
    }
  });
});