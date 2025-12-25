import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyABY8jkjB2RD3RPK-qQ6kJThm32Pc9OpKE",
  authDomain: "events-93cb9.firebaseapp.com",
  databaseURL: "https://events-93cb9-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "events-93cb9",
  storageBucket: "events-93cb9.firebasestorage.app",
  messagingSenderId: "234410411694",
  appId: "1:234410411694:web:b544058bce0dfe78a88f3f",
  measurementId: "G-4D3X216R1K"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const startMonth = document.getElementById("startMonth");
const endMonth = document.getElementById("endMonth");
const includeZeroCheckbox = document.getElementById("includeZero");
const loadBtn = document.getElementById("loadBtn");
const exportBtn = document.getElementById("exportBtn");
const tableWrap = document.getElementById("tableWrap");
const messageBox = document.getElementById("messageBox");

let currentReport = [];

function showMessage(text, type = 'info') {
  const icons = {
    info: '💡',
    success: '✅',
    loading: '⏳'
  };
  messageBox.innerHTML = `
    <div class="message-box message-${type} fade-in">
      <span class="message-icon">${icons[type]}</span>
      <span>${text}</span>
    </div>
  `;
}

function toBuddhistYear(year) {
  return year + 543;
}

function getThaiMonth(monthNum) {
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", 
                  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return months[monthNum];
}

function formatMonthThai(monthStr) {
  if(!monthStr) return "";
  const [year, month] = monthStr.split("-").map(Number);
  const buddhistYear = toBuddhistYear(year);
  const thaiMonth = getThaiMonth(month - 1);
  return `${thaiMonth} ${buddhistYear}`;
}

function cleanText(text) {
  if (!text) return "";
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/\u0E4D/g, '\u0E48')
    .replace(/\u0E34/g, 'ิ')
    .replace(/\u0E38/g, 'ุ')
    .replace(/\s+/g, ' ')
    .normalize('NFC')
    .trim();
}

function parseYMD(ymd){
  if(!ymd) return null;
  const parts = ymd.split("-");
  if(parts.length < 3) return null;
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}

function getMonthRange(startStr, endStr){
  const [sy, sm] = startStr.split("-").map(Number);
  const [ey, em] = endStr.split("-").map(Number);
  const start = new Date(sy, sm - 1, 1);
  const end = new Date(ey, em, 1);
  return { start, end };
}

loadBtn.addEventListener("click", async ()=>{
  const sVal = startMonth.value;
  const eVal = endMonth.value;
  if(!sVal || !eVal){ 
    alert("⚠️ กรุณาเลือกช่วงเดือนให้ครบ"); 
    return; 
  }

  const { start, end } = getMonthRange(sVal, eVal);
  if(start >= end){ 
    alert("⚠️ ช่วงเดือนไม่ถูกต้อง"); 
    return; 
  }

  loadBtn.disabled = true;
  exportBtn.disabled = true;
  tableWrap.innerHTML = "";
  showMessage("กำลังโหลดข้อมูล กรุณารอสักครู่...", "loading");

  try{
    // Get events from RTDB
    const eventsRef = ref(db, 'events');
    const eventsSnapshot = await get(eventsRef);
    const events = [];
    
    if (eventsSnapshot.exists()) {
      const eventsData = eventsSnapshot.val();
      Object.entries(eventsData).forEach(([id, data]) => {
        events.push({ _id: id, ...data });
      });
    }

    // Get workers from RTDB
    const workersRef = ref(db, 'workers');
    const workersSnapshot = await get(workersRef);
    const workers = [];
    
    if (workersSnapshot.exists()) {
      const workersData = workersSnapshot.val();
      Object.values(workersData).forEach(data => {
        if (data.name) {
          workers.push(cleanText(data.name));
        }
      });
    }

    const mainStatuses = ["เรียบร้อย", "ไม่เรียบร้อย", "รออนุมัติ", "อนุมัติ"];
    
    const otherStatuses = new Set();
    events.forEach(ev => {
      if(ev.status && ev.status.trim() !== "") {
        const status = ev.status.trim();
        if(!mainStatuses.includes(status)) {
          otherStatuses.add(status);
        }
      }
    });

    const statusList = [...mainStatuses, ...Array.from(otherStatuses).sort((a,b) => a.localeCompare(b,"th"))];

    const stats = new Map();
    const ensureWorker = name => {
      if(!name) return;
      if(!stats.has(name)) {
        const workerStat = { name, total: 0 };
        statusList.forEach(status => { workerStat[status] = 0; });
        stats.set(name, workerStat);
      }
    };

    let totalEventsCount = 0;
    const totalStatusCount = {};
    statusList.forEach(status => { totalStatusCount[status] = 0; });

    if(includeZeroCheckbox.checked){
      workers.forEach(w => ensureWorker(w));
    }

    for(const ev of events){
      const startDate = parseYMD(ev.start);
      if(!startDate) continue;
      if(startDate >= start && startDate < end){

        totalEventsCount++;

        const workerList = Array.isArray(ev.workers) ? ev.workers : (ev.workers ? [ev.workers] : []);
        
        const status = ev.status ? ev.status.trim() : "";

        if(status && statusList.includes(status)) {
          totalStatusCount[status]++;
        }

        for(const w of workerList){
          const cleanedWorker = cleanText(w);
          ensureWorker(cleanedWorker);
          const rec = stats.get(cleanedWorker);
          rec.total++;
          if(status && statusList.includes(status)) {
            rec[status]++;
          }
        }
      }
    }

    const rows = Array.from(stats.values()).sort((a,b)=> a.name.localeCompare(b.name,"th"));
    if(rows.length === 0){
      tableWrap.innerHTML = `
        <div class="empty-state fade-in">
          <div class="empty-icon">📭</div>
          <h3>ไม่พบข้อมูล</h3>
          <p>ไม่มีข้อมูลในช่วงเดือนที่เลือก</p>
        </div>
      `;
      showMessage("ไม่มีข้อมูลในช่วงเดือนที่เลือก", "info");
      return;
    }

    const totalSum = { total: totalEventsCount };
    statusList.forEach(status => { 
      totalSum[status] = totalStatusCount[status];
    });

    const startThai = formatMonthThai(sVal);
    const endThai = formatMonthThai(eVal);

    let html = `<div class="results-card fade-in">`;
    
    html += `<div class="stats-summary">
      <div class="stat-card">
        <div class="stat-label">จำนวนงานทั้งหมด</div>
        <div class="stat-value">
          <span>🎯</span>
          <span>${totalEventsCount}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">จำนวนบุคลากร</div>
        <div class="stat-value">
          <span>👥</span>
          <span>${rows.length}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">เรียบร้อย</div>
        <div class="stat-value">
          <span>✅</span>
          <span>${totalSum["เรียบร้อย"] || 0}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">ไม่เรียบร้อย</div>
        <div class="stat-value">
          <span>⚠️</span>
          <span>${totalSum["ไม่เรียบร้อย"] || 0}</span>
        </div>
      </div>
    </div>`;

    html += `<div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>ชื่อผู้ปฏิบัติงาน</th>
            <th>จำนวนครั้งทั้งหมด</th>
            <th>เรียบร้อย</th>
            <th>ไม่เรียบร้อย</th>
            <th>รออนุมัติ</th>
            <th>อนุมัติ</th>
          </tr>
        </thead>
        <tbody>`;

    rows.forEach(r=>{
      html += `<tr>
        <td><strong>${r.name}</strong></td>
        <td><strong>${r.total}</strong></td>
        <td>${r["เรียบร้อย"] || 0}</td>
        <td>${r["ไม่เรียบร้อย"] || 0}</td>
        <td>${r["รออนุมัติ"] || 0}</td>
        <td>${r["อนุมัติ"] || 0}</td>
      </tr>`;
    });

    html += `</tbody></table></div>`;

    html += `<div class="summary-section">
      <div class="summary-title">
        <span>📊</span>
        <span>สรุปผลรวมรายบุคคล</span>
      </div>
      <ul class="summary-list">`;
    
    rows.forEach(r=>{
      let details = statusList.map(s => `${s} ${r[s]}`).join(", ");
      html += `
        <li class="summary-item">
          <strong>${r.name}</strong>
          <div class="summary-details">รวม ${r.total} ครั้ง (${details})</div>
        </li>`;
    });
    
    html += `</ul></div></div>`;

    tableWrap.innerHTML = html;
    showMessage(`สรุปผลรวมช่วง ${startThai} ถึง ${endThai}`, "success");

    exportBtn.disabled = false;
    currentReport = { rows, totalSum, totalEventsCount, sVal, eVal, statusList, startThai, endThai };

  }catch(err){
    console.error(err);
    alert("⚠️ เกิดข้อผิดพลาดในการโหลดข้อมูล");
    showMessage("เกิดข้อผิดพลาดในการโหลดข้อมูล", "info");
  }finally{
    loadBtn.disabled = false;
  }
});

exportBtn.addEventListener("click", ()=>{
  if(!currentReport?.rows?.length) return alert("⚠️ ไม่มีข้อมูลให้ export");

  const { rows, totalSum, totalEventsCount, sVal, eVal, statusList, startThai, endThai } = currentReport;

  const header = ["ช่วงเดือน","ชื่อผู้ปฏิบัติงาน","จำนวนครั้งทั้งหมด","เรียบร้อย","ไม่เรียบร้อย","รออนุมัติ","อนุมัติ"];
  
  const lines = [header.join(",")];

  rows.forEach(r=>{
    const row = [
      `"${startThai} ถึง ${endThai}"`,
      `"${cleanText(r.name)}"`,
      r.total,
      r["เรียบร้อย"] || 0,
      r["ไม่เรียบร้อย"] || 0,
      r["รออนุมัติ"] || 0,
      r["อนุมัติ"] || 0
    ];
    lines.push(row.join(","));
  });

  const totalRow = [
    "\"รวมทั้งหมด\"",
    "",
    totalSum.total,
    totalSum["เรียบร้อย"] || 0,
    totalSum["ไม่เรียบร้อย"] || 0,
    totalSum["รออนุมัติ"] || 0,
    totalSum["อนุมัติ"] || 0
  ];
  lines.push(totalRow.join(","));

  lines.push("");
  lines.push(`จำนวนงานทั้งหมด (นับตามจำนวน event),${totalEventsCount}`);
  lines.push("");

  lines.push("📈 สรุปผลรวมทั้งหมด");
  lines.push(`ช่วงเดือน,"${startThai} ถึง ${endThai}"`);
  lines.push(`จำนวนงานทั้งหมด,${totalSum.total}`);
  lines.push(`เรียบร้อย,${totalSum["เรียบร้อย"] || 0}`);
  lines.push(`ไม่เรียบร้อย,${totalSum["ไม่เรียบร้อย"] || 0}`);
  lines.push(`รออนุมัติ,${totalSum["รออนุมัติ"] || 0}`);
  lines.push(`อนุมัติ,${totalSum["อนุมัติ"] || 0}`);

  const csv = "\uFEFF" + lines.join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `รายงานปฏิบัติงาน-${startThai}_ถึง_${endThai}.csv`;
  a.click();

  URL.revokeObjectURL(url);
  
  showMessage("ดาวน์โหลดไฟล์ CSV สำเร็จ!", "success");
});

showMessage("เลือกช่วงเดือน แล้วกด \"โหลดข้อมูล\"", "info");