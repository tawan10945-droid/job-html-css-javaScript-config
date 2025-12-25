import { db } from '/config-firebase/firebase-config.js';
import { ref, get, push, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// Elements
const loginForm = document.getElementById("loginForm");
const userIdInput = document.getElementById("userId");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const loading = document.getElementById("loading");
const message = document.getElementById("message");
const togglePasswordBtn = document.getElementById("togglePassword");

// Toggle password visibility
togglePasswordBtn.addEventListener("click", () => {
  const type = passwordInput.type === "password" ? "text" : "password";
  passwordInput.type = type;
  togglePasswordBtn.textContent = type === "password" ? "👁️" : "🙈";
});

// Show message
function showMessage(text, type) {
  message.textContent = text;
  message.className = `message ${type}`;
  message.style.display = "block";
  
  setTimeout(() => {
    message.style.display = "none";
  }, 5000);
}

// ✅ ฟังก์ชันดึง IP Address จากเครื่อง (Local IP)
async function getIPAddress() {
  try {
    // สร้าง RTCPeerConnection เพื่อดึง Local IP
    const pc = new RTCPeerConnection({
      iceServers: []
    });
    
    pc.createDataChannel('');
    
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    return new Promise((resolve) => {
      pc.onicecandidate = (ice) => {
        if (!ice || !ice.candidate || !ice.candidate.candidate) {
          resolve("Unknown");
          return;
        }
        
        const candidateStr = ice.candidate.candidate;
        const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
        const ipMatch = ipRegex.exec(candidateStr);
        
        if (ipMatch && ipMatch[1]) {
          pc.close();
          resolve(ipMatch[1]);
        }
      };
      
      // Timeout หากไม่เจอ IP ภายใน 2 วินาที
      setTimeout(() => {
        pc.close();
        resolve("Unknown");
      }, 2000);
    });
    
  } catch (error) {
    console.error("Error getting IP:", error);
    return "Unknown";
  }
}

// ✅ ฟังก์ชันดึงข้อมูล Browser และ Device
function getDeviceInfo() {
  const userAgent = navigator.userAgent;
  let browserName = "Unknown";
  let osName = "Unknown";
  
  // ตรวจสอบ Browser
  if (userAgent.indexOf("Firefox") > -1) {
    browserName = "Firefox";
  } else if (userAgent.indexOf("Chrome") > -1) {
    browserName = "Chrome";
  } else if (userAgent.indexOf("Safari") > -1) {
    browserName = "Safari";
  } else if (userAgent.indexOf("Edge") > -1) {
    browserName = "Edge";
  }
  
  // ตรวจสอบ OS
  if (userAgent.indexOf("Win") > -1) {
    osName = "Windows";
  } else if (userAgent.indexOf("Mac") > -1) {
    osName = "MacOS";
  } else if (userAgent.indexOf("Linux") > -1) {
    osName = "Linux";
  } else if (userAgent.indexOf("Android") > -1) {
    osName = "Android";
  } else if (userAgent.indexOf("iOS") > -1) {
    osName = "iOS";
  }
  
  return {
    browser: browserName,
    os: osName,
    userAgent: userAgent
  };
}

// ✅ ฟังก์ชันบันทึก Login Log
async function saveLoginLog(userId, userName, userPosition, status, ipAddress) {
  try {
    const loginLogsRef = ref(db, "login_logs");
    const newLogRef = push(loginLogsRef);
    
    const deviceInfo = getDeviceInfo();
    const timestamp = new Date().toISOString();
    const timestampThai = new Date().toLocaleString('th-TH', { 
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    const logData = {
      userId: userId,
      userName: userName,
      position: userPosition,
      status: status, // "success" หรือ "failed"
      ipAddress: ipAddress,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      userAgent: deviceInfo.userAgent,
      timestamp: timestamp,
      timestampThai: timestampThai,
      loginDate: new Date().toLocaleDateString('th-TH'),
      loginTime: new Date().toLocaleTimeString('th-TH')
    };
    
    await set(newLogRef, logData);
    console.log("✅ Login log saved successfully:", logData);
    
  } catch (error) {
    console.error("❌ Error saving login log:", error);
  }
}

// Login function
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  console.log("=== LOGIN STARTED ===");
  
  const userId = userIdInput.value.trim();
  const password = passwordInput.value.trim();
  
  console.log("Input userId:", userId);
  
  if (!userId || !password) {
    showMessage("กรุณากรอกข้อมูลให้ครบถ้วน", "error");
    return;
  }
  
  // Show loading
  loginBtn.disabled = true;
  loading.style.display = "block";
  message.style.display = "none";
  
  // ✅ ดึง IP Address
  const ipAddress = await getIPAddress();
  console.log("IP Address:", ipAddress);
  
  try {
    console.log("Fetching users from Firebase...");
    
    // Get all users from database
    const usersRef = ref(db, "users");
    const snapshot = await get(usersRef);
    
    if (!snapshot.exists()) {
      console.log("No users found in database");
      showMessage("ไม่พบข้อมูลผู้ใช้ในระบบ", "error");
      loginBtn.disabled = false;
      loading.style.display = "none";
      return;
    }
    
    const usersData = snapshot.val();
    console.log("All users data:", usersData);
    
    let foundUser = null;
    let foundUserKey = null;
    
    // แปลงเป็นตัวพิมพ์เล็กเพื่อเปรียบเทียบ (case-insensitive)
    const userIdLower = userId.toLowerCase();
    const passwordLower = password.toLowerCase();
    
    // Search for user with matching userId and password
    for (const key in usersData) {
      const user = usersData[key];
      const dbUserIdLower = (user.userId || "").toLowerCase();
      const dbPasswordLower = (user.password || "").toLowerCase();
      
      // เปรียบเทียบแบบไม่สนใจตัวพิมพ์ใหญ่-เล็ก
      if (dbUserIdLower === userIdLower && dbPasswordLower === passwordLower) {
        foundUser = user;
        foundUserKey = key;
        break;
      }
    }
    
    if (!foundUser) {
      console.log("User not found or incorrect password");
      
      // ✅ บันทึก Login Failed
      await saveLoginLog(
        userId,
        "Unknown",
        "Unknown",
        "failed",
        ipAddress
      );
      
      showMessage("รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง", "error");
      loginBtn.disabled = false;
      loading.style.display = "none";
      return;
    }
    
    console.log("=== USER FOUND ===");
    console.log("Found user data:", foundUser);
    console.log("User key:", foundUserKey);
    
    // ✅ บันทึก Login Success
    await saveLoginLog(
      foundUserKey,
      foundUser.name || "ไม่ระบุชื่อ",
      foundUser.position || "ไม่ระบุตำแหน่ง",
      "success",
      ipAddress
    );
    
    // Login successful - store user info in sessionStorage
    sessionStorage.setItem("userId", foundUserKey);
    sessionStorage.setItem("userName", foundUser.name || "ไม่ระบุชื่อ");
    sessionStorage.setItem("userPosition", foundUser.position || "ไม่ระบุตำแหน่ง");
    sessionStorage.setItem("originalEventId", foundUserKey);
    sessionStorage.setItem("userIP", ipAddress); // ✅ เก็บ IP ใน session
    
    showMessage(`ยินดีต้อนรับ ${foundUser.name || "ผู้ใช้"}`, "success");
    
    console.log("Position:", foundUser.position);
    
    // Redirect based on position
    setTimeout(() => {
      let targetUrl = '';
    if (foundUser.position === "engineer") {
  targetUrl = `/HTML/home.html?originalEventId=${foundUserKey}`;

} else if (foundUser.position === "sales") {
  targetUrl = `/HTML/calendar_admin.html?originalEventId=${foundUserKey}`;

} else if (foundUser.position === "managersales") {
  targetUrl = `/HTML/manager.html?originalEventId=${foundUserKey}`;

} else if (foundUser.position === "manager") {
  targetUrl = `/HTML/manager.html?originalEventId=${foundUserKey}`;

} else if (foundUser.position === "admin") {
  targetUrl = `/HTML/calendar_admin.html?originalEventId=${foundUserKey}`;

} else {
  console.log("Unknown position:", foundUser.position);
  showMessage("ไม่พบสิทธิ์การเข้าใช้งาน", "error");
  loginBtn.disabled = false;
  loading.style.display = "none";
  return;
}

window.location.href = targetUrl;

      
      console.log("Redirecting to:", targetUrl);
      window.location.href = targetUrl;
    }, 1000);
    
  } catch (error) {
    console.error("Login error:", error);
    showMessage("เกิดข้อผิดพลาดในการเข้าสู่ระบบ: " + error.message, "error");
    loginBtn.disabled = false;
    loading.style.display = "none";
  }
});

// Auto focus on userId field
userIdInput.focus();

// Enter key support
passwordInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    loginForm.dispatchEvent(new Event("submit"));
  }
});

console.log("Login page loaded successfully");