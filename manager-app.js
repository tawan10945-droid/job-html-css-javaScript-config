import { db } from '/config-firebase/firebase-config.js';
import { 
  ref, onValue, update, get, increment 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// Global Variables
const eventList = document.getElementById("eventList");
const modal = document.getElementById("approvalModal");
let currentEventId = null;
let currentWorkers = [];
let managerName = "Manager"; // Default

// Utility Functions
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

// Check Login and Get Manager Name
async function getManagerNameFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const originalEventId = urlParams.get('originalEventId');

  // Session storage checks
  const userId = sessionStorage.getItem("userId");
  const userName = sessionStorage.getItem("userName");

  // Check if logged in
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
  
  if (originalEventId) {
    try {
      const userRef = ref(db, `users/${originalEventId}`);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        const userData = snapshot.val();
        managerName = userData.name || 'Manager';
        document.getElementById('userNameDisplay').textContent = `👤 ${managerName}`;
        console.log('Found user:', managerName);
      } else {
        console.log('User not found with originalEventId:', originalEventId);
        document.getElementById('userNameDisplay').textContent = '👤 Manager';
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      document.getElementById('userNameDisplay').textContent = '👤 Manager';
    }
  } else {
    console.log('No originalEventId in URL');
    document.getElementById('userNameDisplay').textContent = '👤 Manager';
  }
  
  return managerName;
}

// Navigation with Name
window.navigateWithName = function(page) {
  const urlParams = new URLSearchParams(window.location.search);
  const name = urlParams.get('name');
  
  if (name) {
    window.location.href = `${page}?name=${encodeURIComponent(name)}`;
  } else {
    window.location.href = page;
  }
  
  return false;
};

// Load Events with Real-time Updates
function loadEvents() {
  const eventsRef = ref(db, 'events');
  
  onValue(eventsRef, (snapshot) => {
    eventList.innerHTML = "";
    const data = snapshot.val();

    if (!data) return;

    const events = [];
    
    Object.keys(data).forEach(id => {
      const eventData = data[id];
      if (!["อนุมัติ", "อนุมัติด่วน", "เรียบร้อย", "ไม่เรียบร้อย"].includes(eventData.status)) {
        events.push({ id: id, data: eventData });
      }
    });

    // Sort events (waiting for 2nd approval > urgent tasks)
    events.sort((a, b) => {
      const aWaiting2nd = a.data.status === "รอการอนุมัติครั้งที่ 2";
      const bWaiting2nd = b.data.status === "รอการอนุมัติครั้งที่ 2";
      const aUrgent = a.data.isUrgent === true;
      const bUrgent = b.data.isUrgent === true;
      
      if (aWaiting2nd && !bWaiting2nd) return -1;
      if (!aWaiting2nd && bWaiting2nd) return 1;
      
      if (aUrgent && !bUrgent) return -1;
      if (!aUrgent && bUrgent) return 1;
      
      return 0;
    });

    // Render events
    events.forEach(({ id, data }) => {
      const li = document.createElement("li");
      
      if (data.isUrgent === true || data.status === "รอการอนุมัติครั้งที่ 2") {
        li.classList.add('urgent');
      }
      
      const urlParams = new URLSearchParams(window.location.search);
      const nameParam = urlParams.get('name') ? `&name=${encodeURIComponent(urlParams.get('name'))}` : '';
      
      let urgentBadge = '';
      if (data.status === "รอการอนุมัติครั้งที่ 2") {
        urgentBadge = '<div class="urgent-badge">🔥 รอการอนุมัติครั้งที่ 2</div>';
      } else if (data.isUrgent === true) {
        urgentBadge = '<div class="urgent-badge">🔥 งานด่วน (ต้องอนุมัติ 2 ครั้ง)</div>';
      }
      
      let firstApprovalInfo = '';
      if (data.firstApproval) {
        firstApprovalInfo = `<div style="background: #fff3cd; padding: 10px; border-radius: 8px; margin-top: 10px; border-left: 4px solid #ffc107;">
          <strong>✅ อนุมัติครั้งที่ 1:</strong><br>
          👤 ${data.firstApproval.approvedBy}<br>
          📝 ${data.firstApproval.signType}<br>
          🕐 ${new Date(data.firstApproval.approvedTime).toLocaleString('th-TH')}
        </div>`;
      }
      
      li.innerHTML = `
        ${urgentBadge}
        <div class="event-details">
          <strong>หมายเลขงาน:</strong> ${data.jobNumber || "-"}<br>
          <strong>ผู้ปฏิบัติงาน:</strong> ${(data.workers || []).join(", ") || "-"}<br>
          <strong>สถานที่:</strong> ${data.location || "-"}<br>
          <strong>ลักษณะงาน:</strong> ${(data.jobTypes || []).join(", ") || "-"}<br>
          <strong>วันที่:</strong> ${formatDateThai(data.start) || "-"} → ${formatDateThai(data.end) || "-"}<br>
          <strong>สถานะ:</strong> ${data.status || "รออนุมัติ"}
        </div>
        ${firstApprovalInfo}
        <div style="margin-top:10px;">
          <a href="editM.html?id=${id}${nameParam}" class="edit">✏️ เพิ่มชื่อ / แก้ไข</a>
          <button class="reject" onclick="rejectEvent('${id}')">❌ ปฏิเสธ</button>
          <button class="approve" onclick="approveEvent('${id}', ${JSON.stringify(data.workers || []).replace(/"/g, '&quot;')})">✅ อนุมัติ</button>
        </div>
      `;
      eventList.appendChild(li);
    });
  }, (error) => {
    console.error("RTDB Error: ", error);
    eventList.innerHTML = `<li>เกิดข้อผิดพลาดในการโหลดงาน: ${error.message}</li>`;
  });
}

// Approve Event
window.approveEvent = function(id, workers) {
  currentEventId = id;
  currentWorkers = workers || [];
  modal.style.display = "block";
  document.getElementById("signSelf").checked = true;
};

// Close Modal
window.closeModal = function() {
  modal.style.display = "none";
  currentEventId = null;
  currentWorkers = [];
};

// Confirm Approval
window.confirmApproval = async function() {
  const selectedSign = document.querySelector('input[name="signType"]:checked').value;
  const eventRef = ref(db, `events/${currentEventId}`);

  const eventSnapshot = await get(eventRef);
  const eventData = eventSnapshot.val();

  if (!eventData) {
    alert("❌ ไม่พบข้อมูลงาน!");
    closeModal();
    return;
  }
  
  const isUrgentTask = eventData.isUrgent === true;
  const updates = {};
  
  if (isUrgentTask) {
    // Urgent task: requires 2 approvals
    
    if (!eventData.firstApproval) {
      // First approval
      updates.status = "รอการอนุมัติครั้งที่ 2";
      updates.firstApproval = {
        approvedBy: managerName,
        signType: selectedSign,
        approvedTime: new Date().toISOString()
      };
      
      await update(eventRef, updates);
      
      alert(`✅ อนุมัติครั้งที่ 1 สำเร็จ (${selectedSign})\nรอการอนุมัติครั้งที่ 2 จากผู้อนุมัติท่านอื่น (หรือท่านเดิมก็ได้)`);
      
    } else {
      // Second approval
      updates.status = "อนุมัติด่วน";
      updates.secondApproval = {
        approvedBy: managerName,
        signType: selectedSign,
        approvedTime: new Date().toISOString()
      };
      
      await update(eventRef, updates);

      // Update worker count
      const workerUpdates = {};
      const currentTime = new Date().toISOString();
      for (const worker of currentWorkers) {
        if (worker && worker.trim()) {
          workerUpdates[`workerCount/${worker.trim()}/count`] = increment(1);
          workerUpdates[`workerCount/${worker.trim()}/lastUpdated`] = currentTime;
        }
      }
      
      if (Object.keys(workerUpdates).length > 0) {
        await update(ref(db), workerUpdates); 
      }
      
      alert(`✅ อนุมัติครั้งที่ 2 สำเร็จ!\n\n` + 
            `อนุมัติครั้งที่ 1 โดย: ${eventData.firstApproval.approvedBy}\n` +
            `อนุมัติครั้งที่ 2 โดย: ${managerName}\n\n` +
            `งานด่วนได้รับการอนุมัติครบแล้ว!`);
    }
    
  } else {
    // Normal task: single approval
    updates.status = "อนุมัติ";
    updates.signType = selectedSign;
    updates.approvedBy = managerName;
    updates.approvedTime = new Date().toISOString();
    
    await update(eventRef, updates); 
    
    // Update worker count
    const workerUpdates = {};
    const currentTime = new Date().toISOString();
    for (const worker of currentWorkers) {
      if (worker && worker.trim()) {
        workerUpdates[`workerCount/${worker.trim()}/count`] = increment(1);
        workerUpdates[`workerCount/${worker.trim()}/lastUpdated`] = currentTime;
      }
    }

    if (Object.keys(workerUpdates).length > 0) {
      await update(ref(db), workerUpdates);
    }
    
    alert(`✅ อนุมัติงานสำเร็จ (${selectedSign})`);
  }
  
  closeModal();
};

// Reject Event
window.rejectEvent = async function(id) {
  if(confirm("❌ ยืนยันการปฏิเสธงานนี้หรือไม่?")) {
    const eventRef = ref(db, `events/${id}`);
    await update(eventRef, { 
      status: "ปฏิเสธ",
      rejectedBy: managerName,
      rejectedTime: new Date().toISOString()
    });
  }
};

// Close modal when clicking outside
window.onclick = function(event) {
  if (event.target == modal) {
    closeModal();
  }
};

// Initialize
getManagerNameFromURL();
loadEvents();