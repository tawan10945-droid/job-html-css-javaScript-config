import { db } from '../config-firesbase/firebase-config.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const monthNames = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

function getMonthKey(dateField) {
  if (typeof dateField === "string") {
    const date = new Date(dateField);
    if (!isNaN(date)) {
      const buddhistYear = date.getFullYear() + 543;
      return `${monthNames[date.getMonth()]} ${buddhistYear}`;
    }
  }
  return null;
}

async function loadWorkData() {
  const eventsRef = ref(db, 'events');
  const snapshot = await get(eventsRef);
  
  const monthlyData = {};
  const allWorkers = new Set();

  if (snapshot.exists()) {
    const eventsData = snapshot.val();
    
    Object.values(eventsData).forEach(data => {
      const monthKey = getMonthKey(data.start);
      if (!monthKey) return;

      if (Array.isArray(data.workers)) {
        data.workers.forEach(name => {
          if (!name) return;
          allWorkers.add(name);
          if (!monthlyData[monthKey]) monthlyData[monthKey] = {};
          monthlyData[monthKey][name] = (monthlyData[monthKey][name] || 0) + 1;
        });
      } else if (typeof data.workers === "string" && data.workers.trim() !== "") {
        const name = data.workers.trim();
        allWorkers.add(name);
        if (!monthlyData[monthKey]) monthlyData[monthKey] = {};
        monthlyData[monthKey][name] = (monthlyData[monthKey][name] || 0) + 1;
      }
    });
  }

  return { monthlyData, allWorkers: [...allWorkers] };
}

let chartInstance = null;

function updateStats(filteredMonths, totalPerPerson, allWorkers) {
  document.getElementById('statsSection').style.display = 'grid';
  document.getElementById('monthCount').textContent = filteredMonths.length;
  document.getElementById('workerCount').textContent = allWorkers.length;
  
  const totalWork = Object.values(totalPerPerson).reduce((sum, val) => sum + val, 0);
  document.getElementById('totalWork').textContent = totalWork;
  
  const avgWork = allWorkers.length > 0 ? (totalWork / allWorkers.length).toFixed(1) : 0;
  document.getElementById('avgWork').textContent = avgWork;
}

async function renderChart(filteredMonths = null) {
  const { monthlyData, allWorkers } = await loadWorkData();

  let months = Object.keys(monthlyData).sort((a, b) => {
    const [ma, ya] = a.split(" ");
    const [mb, yb] = b.split(" ");
    return (parseInt(ya) - parseInt(yb)) || (monthNames.indexOf(ma) - monthNames.indexOf(mb));
  });

  if (filteredMonths) {
    months = months.filter(m => filteredMonths.includes(m));
  }

  if (months.length === 0) {
    document.getElementById("chartContainer").innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <h3>ไม่พบข้อมูล</h3>
        <p>ไม่มีข้อมูลการปฏิบัติงานในช่วงเวลาที่เลือก</p>
      </div>
    `;
    document.querySelector('.chart-wrapper').style.display = 'none';
    return;
  }

  const totalPerPerson = {};
  allWorkers.forEach(name => totalPerPerson[name] = 0);

  months.forEach(month => {
    const monthData = monthlyData[month];
    for (const name in monthData) {
      totalPerPerson[name] += monthData[name];
    }
  });

  updateStats(months, totalPerPerson, allWorkers);

  const sortedEntries = Object.entries(totalPerPerson)
    .sort((a, b) => b[1] - a[1]);

  const labels = sortedEntries.map(e => e[0]);
  const values = sortedEntries.map(e => e[1]);

  const ctx = document.getElementById("workChart").getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 400, 0);
  gradient.addColorStop(0, '#c00');
  gradient.addColorStop(1, '#ff4444');

  document.getElementById("chartContainer").style.display = 'none';
  document.querySelector('.chart-wrapper').style.display = 'block';

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: filteredMonths ? `ผลรวมเดือน ${filteredMonths.join(", ")}` : "รวมทุกเดือน",
        data: values,
        backgroundColor: gradient,
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: "จำนวนครั้งที่แต่ละคนออกปฏิบัติงาน (รวมเดือนที่เลือก)",
          color: "#c00",
          font: { 
            size: 20,
            weight: '700',
            family: "'Prompt', sans-serif"
          },
          padding: 20
        },
        legend: { 
          display: true,
          labels: {
            font: {
              size: 14,
              family: "'Prompt', sans-serif"
            },
            padding: 15,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          cornerRadius: 8,
          titleFont: {
            size: 15,
            family: "'Prompt', sans-serif"
          },
          bodyFont: {
            size: 14,
            family: "'Prompt', sans-serif"
          }
        }
      },
      scales: {
        x: { 
          beginAtZero: true, 
          ticks: { 
            stepSize: 1, 
            color: "#666",
            font: {
              size: 13,
              family: "'Prompt', sans-serif"
            }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        },
        y: { 
          ticks: { 
            color: "#333",
            font: {
              size: 13,
              weight: '500',
              family: "'Prompt', sans-serif"
            }
          },
          grid: {
            display: false
          }
        }
      }
    }
  });
}

function setupMonthSelectors(allMonths) {
  const startSel = document.getElementById("startMonth");
  const endSel = document.getElementById("endMonth");
  startSel.innerHTML = "";
  endSel.innerHTML = "";
  allMonths.forEach(m => {
    startSel.innerHTML += `<option value="${m}">${m}</option>`;
    endSel.innerHTML += `<option value="${m}">${m}</option>`;
  });
  endSel.selectedIndex = allMonths.length - 1;
}

(async function init() {
  const { monthlyData } = await loadWorkData();
  const months = Object.keys(monthlyData).sort((a, b) => {
    const [ma, ya] = a.split(" ");
    const [mb, yb] = b.split(" ");
    return (parseInt(ya) - parseInt(yb)) || (monthNames.indexOf(ma) - monthNames.indexOf(mb));
  });
  
  setupMonthSelectors(months);
  await renderChart();

  document.getElementById("applyFilter").addEventListener("click", () => {
    const start = document.getElementById("startMonth").value;
    const end = document.getElementById("endMonth").value;
    if (!start || !end) return alert("⚠️ กรุณาเลือกช่วงเดือนให้ครบ");

    const sIndex = months.indexOf(start);
    const eIndex = months.indexOf(end);
    if (sIndex > eIndex) return alert("⚠️ ลำดับเดือนเริ่มต้นต้องน้อยกว่าหรือเท่ากับเดือนสิ้นสุด");

    const selectedMonths = months.slice(sIndex, eIndex + 1);
    renderChart(selectedMonths);
  });
})();