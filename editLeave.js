import { db, storage } from '../config-firebase/firebase-config.js';
import {
  ref, push, set, get, remove, onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {
  ref as storageRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// Global variables
let currentUserName = "";
let editingLeaveId = null;

/**
 * Get current user name from URL parameters
 */
function setCurrentUserFromURL() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get("name");
  currentUserName = name ? decodeURIComponent(name) : "";
  document.getElementById("leaveWorker").value = currentUserName || "ไม่พบข้อมูลผู้ใช้";
}

/**
 * Load all leave records for current user from Days/leaves
 */
function loadLeaves() {
  const leaveList = document.getElementById("leaveList");
  
  onValue(ref(db, "Days/leaves"), (snapshot) => {
    leaveList.innerHTML = '<div class="loading">⏳ กำลังโหลดข้อมูล...</div>';
    
    if (!snapshot.exists()) {
      leaveList.innerHTML = '<div class="empty-state">📭 ยังไม่มีรายการวันลาของคุณ</div>';
      return;
    }

    const container = document.createElement("div");
    container.className = "leave-list-container";
    
    let hasData = false;

    snapshot.forEach((childSnapshot) => {
      const id = childSnapshot.key;
      const data = childSnapshot.val();
      
      // Filter by current user name
      if (data.name !== currentUserName) return;
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
    });

    if (!hasData) {
      leaveList.innerHTML = '<div class="empty-state">📭 ยังไม่มีรายการวันลาของคุณ</div>';
    } else {
      leaveList.innerHTML = "";
      leaveList.appendChild(container);
    }
  }, (error) => {
    console.error("Error loading leaves:", error);
    leaveList.innerHTML = '<div class="empty-state">❌ เกิดข้อผิดพลาดในการโหลดข้อมูล</div>';
  });
}

/**
 * Add or update leave record
 */
document.getElementById("addLeaveBtn").addEventListener("click", async () => {
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
      await set(ref(db, `Days/leaves/${editingLeaveId}`), {
        name,
        start,
        end,
        reason
      });
      alert("✅ แก้ไขวันลาเรียบร้อยแล้ว");
      resetForm();
    } else {
      // Add new leave
      await push(ref(db, "Days/leaves"), {
        name,
        start,
        end,
        reason
      });
      alert("✅ บันทึกวันลาเรียบร้อยแล้ว");
      clearForm();
    }
  } catch (error) {
    console.error("Error saving leave:", error);
    alert("❌ เกิดข้อผิดพลาดในการบันทึก");
  }
});

/**
 * Edit leave record
 */
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

/**
 * Cancel edit mode
 */
document.getElementById("cancelEditBtn").addEventListener("click", () => {
  resetForm();
});

/**
 * Reset form to add mode
 */
function resetForm() {
  editingLeaveId = null;
  clearForm();
  document.getElementById("formIcon").textContent = "➕";
  document.getElementById("formTitle").textContent = "เพิ่มวันลาใหม่";
  document.getElementById("addLeaveBtn").textContent = "บันทึกวันลา";
  document.getElementById("cancelEditBtn").style.display = "none";
}

/**
 * Clear form inputs
 */
function clearForm() {
  document.getElementById("leaveStart").value = "";
  document.getElementById("leaveEnd").value = "";
  document.getElementById("leaveReason").value = "";
}

/**
 * Upload file attachment
 */
window.uploadFile = async (id) => {
  const fileInput = document.getElementById(`file-${id}`);
  const file = fileInput.files[0];

  if (!file) {
    alert("⚠️ กรุณาเลือกไฟล์ก่อนอัปโหลด");
    return;
  }

  try {
    // Upload to Firebase Storage
    const fileReference = storageRef(storage, `leaves/${id}/${file.name}`);
    await uploadBytes(fileReference, file);
    
    // Get download URL
    const url = await getDownloadURL(fileReference);
    
    // Update database with file URL
    const leaveRef = ref(db, `Days/leaves/${id}`);
    const snapshot = await get(leaveRef);
    
    if (snapshot.exists()) {
      const currentData = snapshot.val();
      await set(leaveRef, {
        ...currentData,
        fileUrl: url
      });
      alert("✅ แนบเอกสารสำเร็จ");
    } else {
      alert("❌ ไม่พบข้อมูลวันลา");
    }
  } catch (error) {
    console.error("Error uploading file:", error);
    alert("❌ เกิดข้อผิดพลาดในการอัปโหลด: " + error.message);
  }
};

/**
 * Delete leave record
 */
window.deleteLeave = async (id) => {
  if (confirm("❓ ต้องการลบวันลานี้ใช่หรือไม่?")) {
    try {
      await remove(ref(db, `Days/leaves/${id}`));
      alert("✅ ลบรายการเรียบร้อยแล้ว");
    } catch (error) {
      console.error("Error deleting leave:", error);
      alert("❌ เกิดข้อผิดพลาดในการลบ");
    }
  }
};

// Initialize app
setCurrentUserFromURL();
loadLeaves();