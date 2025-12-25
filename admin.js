/* ===== Main Application JavaScript ===== */
import { db } from '/config-firebase/firebase-config.js';
import {
  ref, get, set, push, remove, update, onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// Utility: Get element by ID
const $ = id => document.getElementById(id);

// Global state
let debugMode = false;
let calendar;

/* ================== Date Utilities ================== */
function formatDateThai(dateStr) {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${+y + 543}`;
}

/* ================== Ensure Default Data ================== */
async function ensureDefaultDocs() {
  try {
    if (!(await get(ref(db, "Days/leaves"))).exists()) {
      await push(ref(db, "Days/leaves"), {
        name: "User A",
        reason: "ประชุม",
        start: "2025-01-10",
        end: "2025-01-10"
      });
    }

    if (!(await get(ref(db, "Days/holidays"))).exists()) {
      await push(ref(db, "Days/holidays"), {
        name: "วันขึ้นปีใหม่",
        date: "2025-01-01"
      });
    }

    if (!(await get(ref(db, "events"))).exists()) {
      await push(ref(db, "events"), {
        jobNumber: "JOB-000",
        location: "สำนักงานใหญ่",
        start: "2025-01-01",
        end: "2025-01-02",
        status: "รออนุมัติ",
        workers: ["User A"],
        assigners: ["Admin"],
        jobTypes: ["ทดสอบ"]
      });
    }
  } catch (e) {
    console.warn("ensureDefaultDocs error:", e);
  }
}

/* ================== EVENTS Management ================== */
function loadEvents() {
  const pending = $("eventListPending");
  const completed = $("eventListCompleted");

  onValue(ref(db, "events"), snap => {
    pending.innerHTML = "";
    completed.innerHTML = "";

    if (!snap.exists()) {
      pending.innerHTML = completed.innerHTML = "<i>ไม่มีข้อมูลงาน</i>";
      return;
    }

    Object.entries(snap.val()).forEach(([id, d]) => {
      const div = document.createElement("div");
      div.className = "list-item";
      div.innerHTML = `
        <b>${d.jobNumber || "-"}</b> - ${d.location || "-"}<br>
        <span class="tiny">${formatDateThai(d.start)} → ${formatDateThai(d.end)}</span>
        <div class="action-row">
          <button class="btn" onclick="editEvent('${id}')">✏</button>
          <button class="btn danger" onclick="deleteEvent('${id}')">🗑</button>
        </div>
      `;
      (["เรียบร้อย", "ไม่เรียบร้อย"].includes(d.status)
        ? completed
        : pending).appendChild(div);
    });
  });
}

window.deleteEvent = id => {
  if (confirm("ลบงานนี้?")) remove(ref(db, `events/${id}`));
};

window.editEvent = id => {
  location.href = `edit.html?id=${id}`;
};

/* ================== LEAVES Management (Days/leaves) ================== */
function loadLeaves() {
  const box = $("leaveList");
  onValue(ref(db, "Days/leaves"), snap => {
    box.innerHTML = "";
    if (!snap.exists()) {
      box.innerHTML = "<i>ไม่มีข้อมูลวันลา</i>";
      return;
    }

    Object.entries(snap.val()).forEach(([id, d]) => {
      const div = document.createElement("div");
      div.className = "list-item";
      div.innerHTML = `
        <b>${d.name}</b> (${d.reason})<br>
        <span class="tiny">${formatDateThai(d.start)} → ${formatDateThai(d.end)}</span>
        <div class="action-row">
          <button class="btn" onclick="editLeave('${id}','${encodeURIComponent(d.name)}')">✏</button>
          <button class="btn danger" onclick="deleteLeave('${id}')">🗑</button>
        </div>
      `;
      box.appendChild(div);
    });
  });
}

window.deleteLeave = id => {
  if (confirm("ลบวันลานี้?")) remove(ref(db, `Days/leaves/${id}`));
};

window.editLeave = (id, name) => {
  location.href = `editLeave.html?id=${id}&name=${name}`;
};

/* ================== USERS Management ================== */
function loadUsers() {
  const boxes = {
    engineer: $("engineerList"),
    sales: $("salesList"),
    manager: $("managerList"),
    admin: $("adminList")
  };

  onValue(ref(db, "users"), snap => {
    Object.values(boxes).forEach(b => b.innerHTML = "");
    if (!snap.exists()) return;

    Object.entries(snap.val()).forEach(([id, u]) => {
      const div = document.createElement("div");
      div.className = "list-item";
      div.innerHTML = `
        <b>${u.name}</b><br>
        <span class="tiny">${u.userId}</span>
        <div class="action-row">
          <button class="btn danger" onclick="deleteUser('${id}')">🗑</button>
        </div>
      `;
      boxes[u.position]?.appendChild(div);
    });
  });
}

window.deleteUser = id => {
  if (confirm("ลบผู้ใช้?")) remove(ref(db, `users/${id}`));
};

// Add User Button Handler
$("addUserBtn").onclick = async () => {
  const name = $("userName").value.trim();
  const password = $("userPassword").value;
  const position = $("userPosition").value;
  let uid = $("userUserId").value.trim();

  if (!name || !password || !position) return alert("กรอกข้อมูลให้ครบ");

  const r = push(ref(db, "users"));
  await set(r, { name, password, position, userId: uid || r.key });

  $("userName").value = $("userPassword").value = $("userUserId").value = "";
  $("userPosition").value = "";
};

/* ================== WORKER/ASSIGNER Lists (from users by status) ================== */
function loadWorkerAssignerFromUsers() {
  const workerBox = $("workerList");
  const assignerBox = $("assignerList");
  const workerDebugBox = $("workerDebug");
  const assignerDebugBox = $("assignerDebug");

  onValue(ref(db, "users"), snap => {
    console.log("=== Loading Worker/Assigner from users ===");

    workerBox.innerHTML = "";
    assignerBox.innerHTML = "";

    if (debugMode) {
      workerDebugBox.innerHTML = "<b>Debug Info:</b><br>";
      assignerDebugBox.innerHTML = "<b>Debug Info:</b><br>";
    }

    if (!snap.exists()) {
      console.log("❌ No users found");
      workerBox.innerHTML = assignerBox.innerHTML = "<i>ไม่มีข้อมูล users</i>";
      return;
    }

    const users = snap.val();
    console.log("📊 Total users found:", Object.keys(users).length);

    let workerCount = 0;
    let assignerCount = 0;
    const debugData = {
      workers: [],
      assigners: [],
      other: []
    };

    Object.entries(users).forEach(([id, u]) => {
      // Check both 'status' and 'stutus' (misspelled)
      const statusField = u.status !== undefined ? 'status' : (u.stutus !== undefined ? 'stutus' : null);
      const statusValue = statusField ? u[statusField] : "";
      const status = String(statusValue).toLowerCase().trim();

      console.log(`📝 User: ${u.name}`);
      console.log(`   - Field used: ${statusField || "NONE"}`);
      console.log(`   - Status value: "${statusValue}"`);
      console.log(`   - Normalized: "${status}"`);
      console.log(`   - Position: ${u.position || "NONE"}`);

      // Check Workers (headworkers, workers)
      if (status === "headworkers" || status === "workers") {
        console.log(`   ✅ → WORKER`);
        workerCount++;

        const div = document.createElement("div");
        div.className = "list-item";
        div.innerHTML = `
          <b>${u.name}</b><br>
          <span class="tiny">Status: ${statusValue}</span><br>
          <span class="tiny">Position: ${u.position || "-"}</span>
        `;
        workerBox.appendChild(div);

        debugData.workers.push(`${u.name} (${statusValue})`);
      }
      // Check Assigners
      else if (status === "assigners" || status === "assigner") {
        console.log(`   ✅ → ASSIGNER`);
        assignerCount++;

        const div = document.createElement("div");
        div.className = "list-item";
        div.innerHTML = `
          <b>${u.name}</b><br>
          <span class="tiny">Status: ${statusValue}</span><br>
          <span class="tiny">Position: ${u.position || "-"}</span>
        `;
        assignerBox.appendChild(div);

        debugData.assigners.push(`${u.name} (${statusValue})`);
      }
      else {
        console.log(`   ⚠️ → OTHER (not matched)`);
        debugData.other.push(`${u.name} (status: "${statusValue}")`);
      }
    });

    // Show message when no data
    if (workerCount === 0) {
      workerBox.innerHTML = `<i>ไม่มี Workers<br>(ต้องมี status = 'headworkers' หรือ 'workers')</i>`;
    }

    if (assignerCount === 0) {
      assignerBox.innerHTML = `<i>ไม่มี Assigners<br>(ต้องมี status = 'assigners' หรือ 'assigner')</i>`;
    }

    // Show Debug Info
    if (debugMode) {
      workerDebugBox.innerHTML += `
        <b>Workers found: ${workerCount}</b><br>
        ${debugData.workers.length > 0 ? debugData.workers.join("<br>") : "None"}<br><br>
        <b>Other users (${debugData.other.length}):</b><br>
        ${debugData.other.join("<br>")}
      `;

      assignerDebugBox.innerHTML += `
        <b>Assigners found: ${assignerCount}</b><br>
        ${debugData.assigners.length > 0 ? debugData.assigners.join("<br>") : "None"}<br><br>
        <b>Other users (${debugData.other.length}):</b><br>
        ${debugData.other.join("<br>")}
      `;
    }

    console.log(`✅ Summary: ${workerCount} workers, ${assignerCount} assigners loaded`);
    console.log(`Other users: ${debugData.other.length}`);
  }, (error) => {
    console.error("❌ Error loading users:", error);
    workerBox.innerHTML = assignerBox.innerHTML = "<i>เกิดข้อผิดพลาดในการโหลดข้อมูล</i>";
  });
}

/* ================== HOLIDAY CALENDAR (Days/holidays) ================== */
function initHolidayCalendar() {
  const calendarEl = $("holidayCalendar");

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'th',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,dayGridYear'
    },
    buttonText: {
      today: 'วันนี้',
      month: 'เดือน',
      year: 'ปี'
    },

    // Click date to add holiday
    dateClick: function (info) {
      const holidayName = prompt("ชื่อวันหยุด:", "วันหยุดพิเศษ");
      if (holidayName) {
        addHoliday(holidayName, info.dateStr);
      }
    },

    // Click event to delete holiday
    eventClick: function (info) {
      if (confirm(`ลบวันหยุด "${info.event.title}"?`)) {
        deleteHoliday(info.event.id);
      }
    },

    events: []
  });

  calendar.render();
  loadHolidays();
}

function loadHolidays() {
  onValue(ref(db, "Days/holidays"), snap => {
    calendar.removeAllEvents();

    if (!snap.exists()) return;

    Object.entries(snap.val()).forEach(([id, h]) => {
      calendar.addEvent({
        id: id,
        title: h.name || "วันหยุด",
        start: h.date,
        allDay: true,
        backgroundColor: '#ff5252',
        borderColor: '#c00'
      });
    });
  });
}

async function addHoliday(name, date) {
  try {
    await push(ref(db, "Days/holidays"), {
      name: name,
      date: date
    });
  } catch (e) {
    alert("เกิดข้อผิดพลาด: " + e.message);
  }
}

async function deleteHoliday(id) {
  try {
    await remove(ref(db, `Days/holidays/${id}`));
  } catch (e) {
    alert("เกิดข้อผิดพลาด: " + e.message);
  }
}

/* ================== Debug Toggle ================== */
$("toggleDebug").onclick = () => {
  debugMode = !debugMode;
  $("workerDebug").style.display = debugMode ? "block" : "none";
  $("assignerDebug").style.display = debugMode ? "block" : "none";
  if (debugMode) loadWorkerAssignerFromUsers();
};

/* ================== INITIALIZATION ================== */
(async () => {
  await ensureDefaultDocs();
  loadEvents();
  loadLeaves();
  loadUsers();
  loadWorkerAssignerFromUsers();
  initHolidayCalendar();
})();