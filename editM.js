import { db } from '../config-firebase/firebase-config.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const params = new URLSearchParams(window.location.search);
const eventId = params.get("id");

const titleList = document.getElementById("titleList");
const assignedByList = document.getElementById("assignedByList");
const titleBtn = document.getElementById("titleBtn");
const assignedByBtn = document.getElementById("assignedByBtn");

/* ฟังก์ชันเช็คว่าคนทำงานว่างในช่วงวันที่ */
async function isWorkerAvailable(workerName, startDate, endDate, currentEventId) {
  // แปลงวันที่เป็น timestamp เพื่อเปรียบเทียบ
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();

  // เช็คจาก Days/leaves
  const leavesRef = ref(db, "Days/leaves");
  const leavesSnap = await get(leavesRef);
  if (leavesSnap.exists()) {
    const leavesData = leavesSnap.val();
    for (const key in leavesData) {
      const leave = leavesData[key];
      // เช็คว่าเป็นคนเดียวกันหรือไม่
      if (leave.name === workerName || (leave.workers && leave.workers.includes(workerName))) {
        const leaveStart = new Date(leave.start).getTime();
        const leaveEnd = new Date(leave.end).getTime();
        
        // เช็คว่าวันที่ทับซ้อนกันหรือไม่
        if (!(end < leaveStart || start > leaveEnd)) {
          return false; // มีวันลาที่ทับซ้อน
        }
      }
    }
  }

  // เช็คจาก events (งานอื่นๆ)
  const eventsRef = ref(db, "events");
  const eventsSnap = await get(eventsRef);
  if (eventsSnap.exists()) {
    const eventsData = eventsSnap.val();
    for (const key in eventsData) {
      // ข้ามงานปัจจุบันที่กำลังแก้ไข
      if (key === currentEventId) continue;
      
      const event = eventsData[key];
      // เช็คว่าเป็นคนเดียวกันหรือไม่
      const workers = event.workers || [];
      const workersArray = Array.isArray(workers) ? workers : (workers ? Object.values(workers) : []);
      
      if (workersArray.includes(workerName)) {
        const eventStart = new Date(event.start).getTime();
        const eventEnd = new Date(event.end).getTime();
        
        // เช็คว่าวันที่ทับซ้อนกันหรือไม่
        if (!(end < eventStart || start > eventEnd)) {
          return false; // มีงานอื่นที่ทับซ้อน
        }
      }
    }
  }

  return true; // คนนี้ว่าง
}

/* โหลดรายชื่อจาก users ตาม status และ position */
async function loadDropdowns() {
  titleList.innerHTML = "";
  assignedByList.innerHTML = "";

  const startDate = document.getElementById("start").value;
  const endDate = document.getElementById("end").value;

  // โหลด users
  const usersRef = ref(db, "users");
  const usersSnap = await get(usersRef);
  
  console.log("Users snapshot exists:", usersSnap.exists());
  
  if (usersSnap.exists()) {
    const usersData = usersSnap.val();
    console.log("Users data:", usersData);
    
    for (const userId in usersData) {
      const user = usersData[userId];
      console.log("Processing user:", userId, user);
      
      const name = user.name || user.username || user.displayName;
      const stutus = user.stutus; // ใช้ stutus ตามที่มีในฐานข้อมูล (สะกดผิด)
      const position = user.position;
      
      console.log(`User: ${name}, Status: ${stutus}, Position: ${position}`);
      
      // ผู้ปฏิบัติงาน: position = engineer เท่านั้น
      if (position === "engineer") {
        console.log(`Adding ${name} to workers list`);
        
        // เช็คว่าคนนี้ว่างหรือไม่ (ถ้ามีวันที่เลือก)
        let isAvailable = true;
        let availabilityNote = "";
        
        if (startDate && endDate) {
          isAvailable = await isWorkerAvailable(name, startDate, endDate, eventId);
          if (!isAvailable) {
            availabilityNote = " <span style='color: #888;'>(ไม่ว่าง)</span>";
          }
        }
        
        const disabled = !isAvailable ? "disabled" : "";
        const style = !isAvailable ? "style='opacity: 0.5;'" : "";
        
        titleList.innerHTML += `<label ${style}><input type="checkbox" value="${name}" ${disabled}> ${name}${availabilityNote}</label>`;
      }
      
      // คนสั่งงาน: position = sales
      if (position === "sales") {
        console.log(`Adding ${name} to assigners list`);
        assignedByList.innerHTML += `<label><input type="checkbox" value="${name}"> ${name}</label>`;
      }
    }
  } else {
    console.log("No users data found");
  }
  
  console.log("Workers list HTML:", titleList.innerHTML);
  console.log("Assigners list HTML:", assignedByList.innerHTML);
}

/* โหลดข้อมูลงาน */
async function loadEventData() {
  if (!eventId) return alert("ไม่พบ ID งานใน URL");

  const eventRef = ref(db, `events/${eventId}`);
  const snap = await get(eventRef);

  if (!snap.exists()) return alert("ไม่พบข้อมูลงานนี้");
  const data = snap.val();

  document.getElementById("eventId").value = eventId;
  document.getElementById("job").value = data.job || "";
  document.getElementById("jobNumber").value = data.jobNumber || "";
  document.getElementById("location").value = data.location || "";
  document.getElementById("details").value = data.details || "";
  document.getElementById("howto").value = data.howto || "";
  document.getElementById("start").value = data.start || "";
  document.getElementById("end").value = data.end || "";
  document.getElementById("status").value = data.status || "รออนุมัติ";

  await loadDropdowns();

  // ตั้งค่า checkbox ที่เลือกไว้
  const workers = data.workers || [];
  const assigners = data.assigners || [];

  // Handle both array and object formats
  const workersArray = Array.isArray(workers) ? workers : (workers ? Object.values(workers) : []);
  const assignersArray = Array.isArray(assigners) ? assigners : (assigners ? Object.values(assigners) : []);

  titleList.querySelectorAll("input").forEach(cb => {
    if (workersArray.includes(cb.value)) cb.checked = true;
  });
  assignedByList.querySelectorAll("input").forEach(cb => {
    if (assignersArray.includes(cb.value)) cb.checked = true;
  });

  updateDropdownButton(titleList, titleBtn);
  updateDropdownButton(assignedByList, assignedByBtn);
}

/* บันทึกข้อมูล */
document.getElementById("editForm").addEventListener("submit", async e => {
  e.preventDefault();

  const job = document.getElementById("job").value.trim();
  const jobNumber = document.getElementById("jobNumber").value.trim();
  const location = document.getElementById("location").value.trim();
  const details = document.getElementById("details").value.trim();
  const howto = document.getElementById("howto").value.trim();
  const start = document.getElementById("start").value;
  const end = document.getElementById("end").value;
  const status = document.getElementById("status").value;

  const workers = Array.from(titleList.querySelectorAll("input:checked")).map(cb => cb.value);
  const assigners = Array.from(assignedByList.querySelectorAll("input:checked")).map(cb => cb.value);

  try {
    const eventRef = ref(db, `events/${eventId}`);
    await update(eventRef, {
      job, 
      jobNumber, 
      location, 
      details, 
      howto, 
      start, 
      end, 
      status, 
      workers, 
      assigners
    });

    alert("✅ บันทึกข้อมูลเรียบร้อยแล้ว");
    window.location.href = "manager.html";
  } catch (error) {
    console.error("Error updating document:", error);
    alert("❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + error.message);
  }
});

/* อัพเดตปุ่มแสดงชื่อที่เลือก */
function updateDropdownButton(list, btn) {
  const selected = Array.from(list.querySelectorAll("input:checked")).map(cb => cb.value);
  btn.innerHTML = selected.length 
    ? selected.map(n => `<span class="selected-name">${n}</span>`).join(" ")
    : "เลือกชื่อ";
}

/* Event: เปิด dropdown */
titleBtn.addEventListener("click", () => {
  titleList.style.display = titleList.style.display === "block" ? "none" : "block";
});
assignedByBtn.addEventListener("click", () => {
  assignedByList.style.display = assignedByList.style.display === "block" ? "none" : "block";
});

/* ปิด dropdown เมื่อคลิกข้างนอก */
document.addEventListener("click", (e) => {
  if (!titleBtn.contains(e.target) && !titleList.contains(e.target)) {
    titleList.style.display = "none";
  }
  if (!assignedByBtn.contains(e.target) && !assignedByList.contains(e.target)) {
    assignedByList.style.display = "none";
  }
});

titleList.addEventListener("change", () => updateDropdownButton(titleList, titleBtn));
assignedByList.addEventListener("change", () => updateDropdownButton(assignedByList, assignedByBtn));

// เมื่อเปลี่ยนวันที่ ให้โหลด dropdown ใหม่เพื่อเช็คความว่าง
document.getElementById("start").addEventListener("change", async () => {
  await loadDropdowns();
  // เก็บค่าที่เลือกไว้เดิม
  const currentData = await getCurrentEventData();
  if (currentData && currentData.workers) {
    const workersArray = Array.isArray(currentData.workers) ? currentData.workers : Object.values(currentData.workers || {});
    titleList.querySelectorAll("input:not([disabled])").forEach(cb => {
      if (workersArray.includes(cb.value)) cb.checked = true;
    });
    updateDropdownButton(titleList, titleBtn);
  }
});

document.getElementById("end").addEventListener("change", async () => {
  await loadDropdowns();
  // เก็บค่าที่เลือกไว้เดิม
  const currentData = await getCurrentEventData();
  if (currentData && currentData.workers) {
    const workersArray = Array.isArray(currentData.workers) ? currentData.workers : Object.values(currentData.workers || {});
    titleList.querySelectorAll("input:not([disabled])").forEach(cb => {
      if (workersArray.includes(cb.value)) cb.checked = true;
    });
    updateDropdownButton(titleList, titleBtn);
  }
});

// ฟังก์ชันช่วยดึงข้อมูล event ปัจจุบัน
async function getCurrentEventData() {
  if (!eventId) return null;
  const eventRef = ref(db, `events/${eventId}`);
  const snap = await get(eventRef);
  return snap.exists() ? snap.val() : null;
}

loadEventData();