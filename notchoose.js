import { db } from '../config-firesbase/firebase-config.js';
import { 
  ref, onValue, update, get, increment 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ฟังก์ชันแปลงวันที่เป็นรูปแบบ DD/MM/YYYY (พ.ศ.)
function formatDateThai(dateStr) {
  if (!dateStr) return "-";
  const [year, month, day] = dateStr.split("-");
  const buddhistYear = parseInt(year) + 543;
  return `${day}/${month}/${buddhistYear}`;
}

const today = new Date().toISOString().split("T")[0];
document.getElementById("orderDate").value = today;

const eventList = document.getElementById("eventList");
const completedEventList = document.getElementById("completedEventList");
const assignedByBtn = document.getElementById("assignedByBtn");
const assignedByList = document.getElementById("assignedByList");

async function loadEvents() {
  eventList.innerHTML = "";
  completedEventList.innerHTML = "";
  
  // ✅ ดึงชื่อผู้ใช้ที่ login
  const currentUser = sessionStorage.getItem("userName");
  
  if (!currentUser) {
    eventList.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><p>กรุณา Login ก่อนใช้งาน</p></div>';
    completedEventList.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><p>กรุณา Login ก่อนใช้งาน</p></div>';
    return;
  }
  
  const normalizedCurrentUser = currentUser.trim().normalize('NFC');
  console.log("👤 ผู้ใช้ปัจจุบัน:", normalizedCurrentUser);
  
  const eventsRef = ref(db, "events");
  const snapshot = await get(eventsRef);
  
  if (!snapshot.exists()) {
    eventList.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>ยังไม่มีงานที่กำลังดำเนินการ</p></div>';
    completedEventList.innerHTML = '<div class="empty-state"><div class="icon">✓</div><p>ยังไม่มีงานที่เสร็จสิ้น</p></div>';
    return;
  }
  
  const events = snapshot.val();
  let activeCount = 0;
  let completedCount = 0;
  
  Object.keys(events).forEach(eventId => {
    const data = events[eventId];
    const isFinished = data.status === "เรียบร้อย" || data.status === "ไม่เรียบร้อย";
    
    // ✅ เช็คว่าผู้ใช้ปัจจุบันอยู่ใน assigners หรือไม่
    let assigners = [];
    if (Array.isArray(data.assigners)) {
      assigners = data.assigners.map(name => name.trim().normalize('NFC'));
    } else if (typeof data.assigners === 'string') {
      assigners = data.assigners.split(',').map(name => name.trim().normalize('NFC'));
    }
    
    // ✅ แสดงเฉพาะงานที่ผู้ใช้เป็นคนสั่งงาน
    if (!assigners.includes(normalizedCurrentUser)) {
      return;
    }
    
    const div = document.createElement("div");
    div.className = "event-item";
    const isApproved = data.status === "อนุมัติ" || data.status === "อนุมัติด่วน";
    const isPending = data.status === "รออนุมัติ" || data.status === "รออนุมัติด่วน";
    const isUrgent = data.status?.includes("ด่วน");

    let buttonsHTML = "";
    let statusBadge = "";
    
    if (isPending) {
      statusBadge = `<span class="status-badge ${isUrgent ? 'status-urgent' : 'status-pending'}">${data.status || "รออนุมัติ"}</span>`;
    } else if (isApproved) {
      statusBadge = `<span class="status-badge status-approved">${data.status}</span>`;
    } else if (isFinished) {
      statusBadge = `<span class="status-badge status-approved">${data.status}</span>`;
    }
    
    // ✅ งานที่เสร็จสิ้นแล้ว - แสดงเฉพาะปุ่มพิมพ์
    if (isFinished) {
      completedCount++;
      buttonsHTML = `
        <div class="event-actions">
          <button class="print-btn" onclick="printEvent('${eventId}')">🖨 พิมพ์</button>
        </div>`;
    }
    // ✅ งานที่รออนุมัติ - แสดงปุ่มแก้ไข, ลบ, และพิมพ์
    else if (isPending) {
      activeCount++;
      buttonsHTML = `
        <div class="event-actions">
          <button class="edit-btn" onclick="editEvent('${eventId}')">✏️ แก้ไข</button>
          <button class="delete-btn" onclick="deleteEvent('${eventId}')">🗑️ ลบ</button>
          <button class="print-btn" onclick="printEvent('${eventId}')">🖨 พิมพ์</button>
        </div>`;
    }
    // ✅ งานที่อนุมัติแล้ว - แสดงเฉพาะปุ่มพิมพ์
    else if (isApproved) {
      activeCount++;
      buttonsHTML = `
        <div class="event-actions">
          <button class="print-btn" onclick="printEvent('${eventId}')">🖨 พิมพ์</button>
        </div>`;
    }
    
    div.innerHTML = `
      <strong>${data.jobNumber || "ไม่ระบุ"}</strong>
      <div class="event-item-row">
        <span class="icon">📍</span>
        <span>${data.location}</span>
      </div>
      <div class="event-item-row">
        <span class="icon">📅</span>
        <span>วันที่สั่งงาน: ${formatDateThai(data.orderDate)}</span>
      </div>
      <div class="event-item-row">
        <span class="icon">🚀</span>
        <span>${formatDateThai(data.start)} → ${formatDateThai(data.end)}</span>
      </div>
      <div class="event-item-row">
        <span class="icon">👤</span>
        <span>${data.contactPerson || "-"} (${data.phoneNumber || "-"})</span>
      </div>
      <div class="event-item-row">
        <span class="icon">🏷️</span>
        <span>${(data.jobTypes || []).join(", ")}</span>
      </div>
      <div class="event-item-row">
        <span class="icon">🧑‍💼</span>
        <span>${(data.assigners || []).join(", ")}</span>
      </div>
      <div class="event-item-row">
        <span class="icon">📌</span>
        <span>สถานะ: ${statusBadge}</span>
      </div>
      ${data.incompleteReason ? `<div class="event-item-row"><span class="icon">⚠️</span><span>เหตุผล: ${data.incompleteReason}</span></div>` : ''}
      ${buttonsHTML}`;
    
    // ✅ เพิ่มเข้า list ที่เหมาะสม
    if (isFinished) {
      completedEventList.appendChild(div);
    } else {
      eventList.appendChild(div);
    }
  });
  
  // ✅ Update count badges
  document.getElementById("activeCount").textContent = activeCount;
  document.getElementById("completedCount").textContent = completedCount;
  
  // ✅ ถ้าไม่มีงาน แสดง empty state
  if (activeCount === 0) {
    eventList.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>ยังไม่มีงานที่กำลังดำเนินการ</p></div>';
  }
  
  if (completedCount === 0) {
    completedEventList.innerHTML = '<div class="empty-state"><div class="icon">✓</div><p>ยังไม่มีงานที่เสร็จสิ้น</p></div>';
  }
}

window.deleteEvent = async id => {
  if (confirm("ต้องการลบงานนี้หรือไม่?")) {
    await remove(ref(db, `events/${id}`));
    await loadEvents();
  }
}

window.editEvent = async id => {
  const eventRef = ref(db, `events/${id}`);
  const snapshot = await get(eventRef);
  
  if (!snapshot.exists()) {
    alert("ไม่พบข้อมูล");
    return;
  }
  
  const data = snapshot.val();
  if (data.status === "อนุมัติ" || data.status === "อนุมัติด่วน") {
    alert("ไม่สามารถแก้ไขงานที่อนุมัติแล้วได้");
    return;
  }

  await loadNames();

  document.getElementById("eventId").value = id;
  document.getElementById("jobNumber").value = data.jobNumber || "";
  document.getElementById("location").value = data.location;
  document.getElementById("details").value = data.details;
  document.getElementById("orderDate").value = data.orderDate || "";
  document.getElementById("start").value = data.start;
  document.getElementById("end").value = data.end;
  document.getElementById("contactPerson").value = data.contactPerson || "";
  document.getElementById("phoneNumber").value = data.phoneNumber || "";
  document.getElementById("urgentJob").checked = data.isUrgent || false;

  document.querySelectorAll("#jobTypeGroup input[type=checkbox]").forEach(cb => cb.checked = false);
  document.getElementById("otherJobTypeText").value = "";

  if (data.jobTypes) {
    document.querySelectorAll("#jobTypeGroup input[type=checkbox]").forEach(cb => {
      if (data.jobTypes.includes(cb.value)) cb.checked = true;
    });
    const other = data.jobTypes.find(t => !["ส่งมอบ","ฝึกอบรม","ออกแสดงสินค้า","ตรวจเช็ค/ซ่อม","Visit","อื่นๆ"].includes(t));
    if (other) {
      document.getElementById("otherJobTypeCheck").checked = true;
      document.getElementById("otherJobTypeText").value = other;
    }
  }

  assignedByList.querySelectorAll("input[type=checkbox]").forEach(cb => {
    if ((data.assigners || []).includes(cb.value)) {
      cb.checked = true;
      cb.disabled = false;
      cb.parentElement.style.opacity = 1;
    }
  });

  updateDropdownButton(assignedByList, assignedByBtn);
  document.getElementById("formTitle").innerText = "✏️ แก้ไขงาน";
  
  // Scroll to form
  document.querySelector('.form-container').scrollIntoView({ behavior: 'smooth' });
};

document.getElementById("eventForm").addEventListener("submit", async e => {
  e.preventDefault();
  const id = document.getElementById("eventId").value;
  const jobNumber = document.getElementById("jobNumber").value.trim();
  const location = document.getElementById("location").value.trim();
  const details = document.getElementById("details").value.trim();
  const orderDate = document.getElementById("orderDate").value;
  const start = document.getElementById("start").value;
  const end = document.getElementById("end").value;
  const contactPerson = document.getElementById("contactPerson").value.trim();
  const phoneNumber = document.getElementById("phoneNumber").value.trim();
  const assigners = Array.from(assignedByList.querySelectorAll("input[type=checkbox]:checked")).map(cb => cb.value);
  const isUrgent = document.getElementById("urgentJob").checked;

  if (assigners.length === 0) {
    alert("⚠️ กรุณาเลือกคนที่สั่งงานอย่างน้อย 1 คน");
    return;
  }

  let jobTypes = Array.from(document.querySelectorAll("#jobTypeGroup input[type=checkbox]:checked")).map(cb => cb.value);
  if (document.getElementById("otherJobTypeCheck").checked) {
    const otherText = document.getElementById("otherJobTypeText").value.trim();
    if (otherText) jobTypes = jobTypes.filter(t => "อื่นๆ" !== t).concat(otherText);
  }

  if (jobTypes.length === 0) {
    alert("⚠️ กรุณาเลือกลักษณะงานอย่างน้อย 1 รายการ");
    return;
  }

  try {
    // ตรวจสอบหมายเลขงานซ้ำ
    if (jobNumber) {
      const eventsRef = ref(db, "events");
      const snapshot = await get(eventsRef);
      
      if (snapshot.exists()) {
        const events = snapshot.val();
        const duplicate = Object.keys(events).find(key => {
          return events[key].jobNumber === jobNumber && key !== id;
        });
        
        if (duplicate) {
          alert(`⚠️ หมายเลขงาน "${jobNumber}" ซ้ำกับงานที่มีอยู่แล้ว!\nกรุณาเปลี่ยนหมายเลขงานใหม่`);
          return;
        }
      }
    }

    const eventData = {
      jobNumber, 
      location, 
      details, 
      orderDate, 
      start, 
      end, 
      assigners, 
      jobTypes, 
      contactPerson, 
      phoneNumber,
      isUrgent: isUrgent,
    };

    if (id) {
      await update(ref(db, `events/${id}`), {
        ...eventData,
        status: eventData.isUrgent ? "รออนุมัติด่วน" : "รออนุมัติ"
      });
      alert("✅ แก้ไขงานเรียบร้อยแล้ว");
    } else {
      const newEventRef = push(ref(db, "events"));
      await set(newEventRef, {
        ...eventData,
        status: eventData.isUrgent ? "รออนุมัติด่วน" : "รออนุมัติ"
      });
      alert("✅ บันทึกงานเรียบร้อยแล้ว");
    }

    await clearFormAfterSave();
    loadEvents();
  } catch (err) {
    console.error(err);
    alert("❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
  }
});

function updateDropdownButton(listEl, btnEl){
  const selected = Array.from(listEl.querySelectorAll("input[type=checkbox]:checked")).map(cb=>cb.value);
  btnEl.innerHTML = selected.map(n=>`<span class="selected-name">${n}</span>`).join(" ") || "เลือกชื่อ";
}

assignedByBtn.addEventListener("click", (e)=> {
  e.stopPropagation();
  assignedByList.style.display = assignedByList.style.display==="block"?"none":"block";
});

assignedByList.addEventListener("change", () => {
  updateDropdownButton(assignedByList, assignedByBtn);
  assignedByList.style.display = "none";
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".dropdown")) {
    assignedByList.style.display = "none";
  }
});

async function loadNames() {
  assignedByList.innerHTML = "";

  const usersRef = ref(db, "users");
  const snapshot = await get(usersRef);
  
  if (!snapshot.exists()) return;
  
  const users = snapshot.val();
  Object.keys(users).forEach(userId => {
    const user = users[userId];
    if (user.position === "sales") {
      const name = user.name;
      assignedByList.innerHTML += `
        <label>
          <span>${name}</span>
          <input type="checkbox" value="${name}">
        </label>`;
    }
  });

  updateDropdownButton(assignedByList, assignedByBtn);
}

loadEvents();
loadNames();

function loadNameFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  let nameFromURL = urlParams.get('name');
  
  // Session storage checks
const userId = sessionStorage.getItem("userId");
const userName = sessionStorage.getItem("userName");
const userPosition = sessionStorage.getItem("userPosition");

// ✅ เพิ่มโค้ดตรงนี้ - ตรวจสอบการ login
if (!userId || !userName) {
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

  if (!nameFromURL) return;
  
  nameFromURL = nameFromURL.trim().normalize('NFC');
  
  const selectName = () => {
    const checkboxes = assignedByList.querySelectorAll('input[type="checkbox"]');
    
    if (checkboxes.length === 0) return false;
    
    let found = false;
    checkboxes.forEach(cb => {
      const cbValue = cb.value.trim().normalize('NFC');
      if (cbValue === nameFromURL) {
        cb.checked = true;
        found = true;
      }
    });
    
    if (found) {
      updateDropdownButton(assignedByList, assignedByBtn);
    }
    
    return found;
  };
  
  setTimeout(selectName, 1000);
  setTimeout(selectName, 1500);
  setTimeout(selectName, 2000);
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(loadNameFromURL, 100);
});

loadNameFromURL();

document.querySelectorAll('#jobTypeGroup input[type="checkbox"]').forEach(cb => {
  cb.addEventListener('change', () => {
    const selected = Array.from(document.querySelectorAll('#jobTypeGroup input[type="checkbox"]:checked'))
      .map(cb => cb.value);

    const otherText = document.getElementById("otherJobTypeText").value.trim();
    if (document.getElementById("otherJobTypeCheck").checked && otherText) {
      selected.push(otherText);
    }

    localStorage.setItem('savedJobTypes', JSON.stringify(selected));
  });
});

document.getElementById("otherJobTypeText").addEventListener("input", () => {
  const otherCheck = document.getElementById("otherJobTypeCheck");
  if (otherCheck.checked) {
    const selected = Array.from(document.querySelectorAll('#jobTypeGroup input[type="checkbox"]:checked'))
      .map(cb => cb.value);

    const otherText = document.getElementById("otherJobTypeText").value.trim();
    if (otherText) selected.push(otherText);

    localStorage.setItem('savedJobTypes', JSON.stringify(selected));
  }
});

window.addEventListener('DOMContentLoaded', () => {
  const saved = JSON.parse(localStorage.getItem('savedJobTypes') || '[]');
  if (saved.length > 0) {
    document.querySelectorAll('#jobTypeGroup input[type="checkbox"]').forEach(cb => {
      if (saved.includes(cb.value)) cb.checked = true;
    });
    const knownTypes = ["ส่งมอบ", "ฝึกอบรม", "ออกแสดงสินค้า", "ตรวจเช็ค/ซ่อม", "Visit", "อื่นๆ"];
    const other = saved.find(v => !knownTypes.includes(v));
    if (other) {
      document.getElementById("otherJobTypeCheck").checked = true;
      document.getElementById("otherJobTypeText").value = other;
    }
  }
});

function saveFormToLocalStorage() {
  const formData = {
    jobNumber: document.getElementById("jobNumber").value.trim(),
    location: document.getElementById("location").value.trim(),
    details: document.getElementById("details").value.trim(),
    orderDate: document.getElementById("orderDate").value,
    start: document.getElementById("start").value,
    end: document.getElementById("end").value,
    contactPerson: document.getElementById("contactPerson").value.trim(),
    phoneNumber: document.getElementById("phoneNumber").value.trim(),
    assigners: Array.from(assignedByList.querySelectorAll("input[type=checkbox]:checked")).map(cb => cb.value),
    jobTypes: Array.from(document.querySelectorAll('#jobTypeGroup input[type="checkbox"]:checked')).map(cb => cb.value),
    otherJobTypeText: document.getElementById("otherJobTypeText").value.trim(),
    isUrgent: document.getElementById("urgentJob").checked
  };
  localStorage.setItem("eventFormData", JSON.stringify(formData));
}

function loadFormFromLocalStorage() {
  const saved = JSON.parse(localStorage.getItem("eventFormData") || "{}");
  if (!saved || Object.keys(saved).length === 0) return;

  document.getElementById("jobNumber").value = saved.jobNumber || "";
  document.getElementById("location").value = saved.location || "";
  document.getElementById("details").value = saved.details || "";
  document.getElementById("orderDate").value = saved.orderDate || "";
  document.getElementById("start").value = saved.start || "";
  document.getElementById("end").value = saved.end || "";
  document.getElementById("contactPerson").value = saved.contactPerson || "";
  document.getElementById("phoneNumber").value = saved.phoneNumber || "";
  document.getElementById("urgentJob").checked = saved.isUrgent || false; 

  document.querySelectorAll('#jobTypeGroup input[type="checkbox"]').forEach(cb => {
    cb.checked = saved.jobTypes?.includes(cb.value) || false;
  });
  if (saved.otherJobTypeText) {
    document.getElementById("otherJobTypeCheck").checked = true;
    document.getElementById("otherJobTypeText").value = saved.otherJobTypeText;
  }

  assignedByList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.checked = saved.assigners?.includes(cb.value) || false;
  });
  updateDropdownButton(assignedByList, assignedByBtn);
}

document.querySelectorAll('#eventForm input, #eventForm textarea').forEach(el => {
  el.addEventListener('input', saveFormToLocalStorage);
});
document.querySelectorAll('#eventForm input[type="checkbox"]').forEach(cb => {
  cb.addEventListener('change', saveFormToLocalStorage);
});

window.addEventListener('DOMContentLoaded', loadFormFromLocalStorage);

async function clearFormAfterSave() {
  localStorage.removeItem("eventFormData");
  localStorage.removeItem("savedJobTypes");
  localStorage.removeItem("selectedAssigners");

  const form = document.getElementById("eventForm");
  form.reset();

  document.getElementById("eventId").value = "";
  document.getElementById("otherJobTypeText").value = "";

  document.querySelectorAll("#jobTypeGroup input[type=checkbox]").forEach(cb => cb.checked = false);
  document.querySelectorAll(".dropdown-content input[type=checkbox]").forEach(cb => cb.checked = false);

  document.getElementById("assignedByBtn").innerText = "เลือกชื่อ";
  document.getElementById("formTitle").innerText = "✨ เพิ่มงานใหม่";
  
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("orderDate").value = today;
}

function saveNamesSelection() {
  const selectedAssigners = Array.from(assignedByList.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
  localStorage.setItem("selectedAssigners", JSON.stringify(selectedAssigners));
}

function loadNamesSelection() {
  const savedAssigners = JSON.parse(localStorage.getItem("selectedAssigners") || "[]");

  assignedByList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.checked = savedAssigners.includes(cb.value);
  });

  updateDropdownButton(assignedByList, assignedByBtn);
}

assignedByList.addEventListener('change', () => {
  saveNamesSelection();
  updateDropdownButton(assignedByList, assignedByBtn);
});

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(loadNamesSelection, 1000);
});

function goToReportPage(page) {
  const jobNumber = document.getElementById("jobNumber").value.trim() || "ไม่ระบุ";
  const start = document.getElementById("start").value;
  const end = document.getElementById("end").value;

  if (!start || !end) {
    alert("กรุณากรอกวันที่เริ่มและวันที่สิ้นสุดก่อน");
    return;
  }

  const url = `${page}?job=${encodeURIComponent(jobNumber)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
  window.location.href = url;
}

document.querySelector('input[value="ส่งมอบ"]')?.addEventListener('change', (e) => {
  if (e.target.checked) goToReportPage("report_send.html");
});
document.querySelector('input[value="ฝึกอบรม"]')?.addEventListener('change', (e) => {
  if (e.target.checked) goToReportPage("seereport4.html");
});
document.querySelector('input[value="ออกแสดงสินค้า"]')?.addEventListener('change', (e) => {
  if (e.target.checked) goToReportPage("seereport2.html");
});
document.querySelector('input[value="ตรวจเช็ค/ซ่อม"]')?.addEventListener('change', (e) => {
  if (e.target.checked) goToReportPage("seereport3.html");
});

window.printEvent = async (id) => {
  const eventRef = ref(db, `events/${id}`);
  const snapshot = await get(eventRef);

  if (!snapshot.exists()) {
    alert("ไม่พบข้อมูลงาน");
    return;
  }

  const jobNumber = snapshot.val().jobNumber || "ไม่ระบุ";

  const url = new URL("report.html", window.location.href);
  url.searchParams.set("job", jobNumber);

  window.open(url, "_blank");
};