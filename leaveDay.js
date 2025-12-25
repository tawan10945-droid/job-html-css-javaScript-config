import { db } from '../config-firebase/firebase-config.js';
import {
  ref, get, push, set, remove, update
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// Initialize Storage
const storage = getStorage();

// Global Variables
let currentUserName = "";
let editingLeaveId = null;

// Set Current User from URL Parameters
function setCurrentUserFromURL() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get("name");
  currentUserName = name ? decodeURIComponent(name) : "";
  document.getElementById("leaveWorker").value = currentUserName || "ไม่พบข้อมูลผู้ใช้";
}

// Load Leaves from Firebase
async function loadLeaves() {
  const leaveList = document.getElementById("leaveList");
  leaveList.innerHTML = '<div class="loading">⏳ กำลังโหลดข้อมูล...</div>';

  const leavesRef = ref(db, "Days/leaves");
  const snapshot = await get(leavesRef);
  
  leaveList.innerHTML = "";
  
  const container = document.createElement("div");
  container.className = "leave-list-container";
  
  let hasData = false;

  if (snapshot.exists()) {
    const leavesData = snapshot.val();
    
    for (const id in leavesData) {
      const data = leavesData[id];
      if (data.name !== currentUserName) continue;
      hasData = true;

      const div = document.createElement("div");
      div.className = "leave-item";

      div.innerHTML = `
        <div class="leave-header">
          <div class="leave-name">${data.name}</div>
          <div class="leave-badge">${data.reason || "ไม่ระบุ"}</div>
        </div>
        
        <div class="leave-details">
          <div class="leave-detail-item">
            <div class="leave-detail-icon">📅</div>
            <div>
              <strong>วันที่:</strong> ${data.start} ถึง ${data.end}
            </div>
          </div>
          ${data.fileUrl ? `
            <div class="leave-detail-item">
              <div class="leave-detail-icon">📎</div>
              <a href="${data.fileUrl}" target="_blank" class="file-link">
                <span>เปิดเอกสารแนบ</span>
                <span>→</span>
              </a>
            </div>
          ` : ''}
        </div>

        <div class="file-upload-section">
          <input type="file" id="file-${id}" accept=".pdf,.jpg,.jpeg,.png">
          <div class="btn-group">
            <button class="btn-secondary btn-upload" onclick="uploadFile('${id}')">
              📤 แนบเอกสาร
            </button>
            <button class="btn-secondary btn-edit" onclick="editLeave('${id}', '${data.start}', '${data.end}', '${data.reason}')">
              ✏️ แก้ไข
            </button>
            <button class="btn-secondary btn-delete" onclick="deleteLeave('${id}')">
              🗑️ ลบ
            </button>
          </div>
        </div>
      `;

      container.appendChild(div);
    }
  }

  if (!hasData) {
    leaveList.innerHTML = '<div class="empty-state">📭 ยังไม่มีรายการวันลาของคุณ</div>';
  } else {
    leaveList.appendChild(container);
  }
}

// Add/Update Leave
async function saveLeave() {
  const name = document.getElementById("leaveWorker").value;
  const start = document.getElementById("leaveStart").value;
  const end = document.getElementById("leaveEnd").value;
  const reason = document.getElementById("leaveReason").value;

  if (!name || !start || !end || !reason) {
    alert("⚠️ กรุณากรอกข้อมูลให้ครบทุกช่อง");
    return;
  }

  try {
    if (editingLeaveId) {
      // Update existing leave
      const leaveRef = ref(db, `Days/leaves/${editingLeaveId}`);
      await update(leaveRef, {
        start, end, reason
      });
      alert("✅ แก้ไขวันลาเรียบร้อยแล้ว");
      resetForm();
    } else {
      // Add new leave
      const leavesRef = ref(db, "Days/leaves");
      const newLeaveRef = push(leavesRef);
      await set(newLeaveRef, {
        name, start, end, reason
      });
      alert("✅ บันทึกวันลาเรียบร้อยแล้ว");
      clearForm();
    }

    loadLeaves();
  } catch (error) {
    console.error("Error saving leave:", error);
    alert("❌ เกิดข้อผิดพลาด: " + error.message);
  }
}

// Edit Leave (called from onclick in HTML)
window.editLeave = (id, start, end, reason) => {
  editingLeaveId = id;
  
  document.getElementById("leaveStart").value = start;
  document.getElementById("leaveEnd").value = end;
  document.getElementById("leaveReason").value = reason;
  
  document.getElementById("formIcon").textContent = "✏️";
  document.getElementById("formTitle").textContent = "แก้ไขวันลา";
  document.getElementById("addLeaveBtn").textContent = "💾 บันทึกการแก้ไข";
  document.getElementById("cancelEditBtn").style.display = "block";
  
  // Scroll to form
  const formCard = document.querySelector('.card');
  formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// Upload File (called from onclick in HTML)
window.uploadFile = async (id) => {
  const fileInput = document.getElementById(`file-${id}`);
  const file = fileInput.files[0];

  if (!file) {
    alert("⚠️ กรุณาเลือกไฟล์ก่อนอัปโหลด");
    return;
  }

  const fileRef = storageRef(storage, `leaves/${id}/${file.name}`);

  try {
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    
    const leaveRef = ref(db, `Days/leaves/${id}`);
    await update(leaveRef, { fileUrl: url });
    
    alert("✅ แนบเอกสารสำเร็จ");
    loadLeaves();
  } catch (err) {
    console.error(err);
    alert("❌ เกิดข้อผิดพลาดในการอัปโหลด: " + err.message);
  }
};

// Delete Leave (called from onclick in HTML)
window.deleteLeave = async (id) => {
  if (confirm("❓ ต้องการลบวันลานี้ใช่หรือไม่?")) {
    try {
      const leaveRef = ref(db, `Days/leaves/${id}`);
      await remove(leaveRef);
      alert("✅ ลบรายการเรียบร้อยแล้ว");
      loadLeaves();
    } catch (error) {
      console.error("Error deleting leave:", error);
      alert("❌ เกิดข้อผิดพลาดในการลบ: " + error.message);
    }
  }
};

// Reset Form
function resetForm() {
  editingLeaveId = null;
  clearForm();
  document.getElementById("formIcon").textContent = "➕";
  document.getElementById("formTitle").textContent = "เพิ่มวันลาใหม่";
  document.getElementById("addLeaveBtn").textContent = "บันทึกวันลา";
  document.getElementById("cancelEditBtn").style.display = "none";
}

// Clear Form Fields
function clearForm() {
  document.getElementById("leaveStart").value = "";
  document.getElementById("leaveEnd").value = "";
  document.getElementById("leaveReason").value = "";
}

// Event Listeners
document.getElementById("addLeaveBtn").addEventListener("click", saveLeave);

document.getElementById("cancelEditBtn").addEventListener("click", () => {
  resetForm();
});

// Initialize
setCurrentUserFromURL();
loadLeaves();