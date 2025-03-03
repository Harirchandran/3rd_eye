const SUPABASE_URL = 'https://jxsurwtcxvznuqlgnxis.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4c3Vyd3RjeHZ6bnVxbGdueGlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk2NDA3MjIsImV4cCI6MjA1NTIxNjcyMn0.vSYd0BZK3OgbPvxT1n0uwc_o0xyTuVp1IqdiBtdTdQA';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Utility Functions
function showLoading() {
  const loadingEl = document.getElementById('loadingOverlay');
  if (loadingEl) loadingEl.style.display = 'flex';
}
function hideLoading() {
  const loadingEl = document.getElementById('loadingOverlay');
  if (loadingEl) loadingEl.style.display = 'none';
}
function showMessage(message, type = 'success') {
  const msgEl = document.getElementById('globalMessage');
  if (msgEl) {
    msgEl.textContent = message;
    msgEl.className = `message ${type}`;
    msgEl.style.display = 'block';
    setTimeout(() => { msgEl.style.display = 'none'; }, 5000);
  }
}
function showShortMessage(message, type = 'success') {
  const msgEl = document.getElementById('globalMessage');
  if (msgEl) {
    msgEl.textContent = message;
    msgEl.className = `message ${type}`;
    msgEl.style.display = 'block';
    setTimeout(() => { msgEl.style.display = 'none'; }, 2000);
  }
}
function showError(message) { showMessage(message, 'error'); }
function showSuccess(message) { showMessage(message, 'success'); }

// Section Toggling
function showSection(sectionId) {
  const viewLogsEl = document.getElementById('viewLogs');
  const searchCriminalEl = document.getElementById('searchCriminal');
  if (viewLogsEl) viewLogsEl.classList.add('hidden');
  if (searchCriminalEl) searchCriminalEl.classList.add('hidden');
  const section = document.getElementById(sectionId);
  if (section) section.classList.remove('hidden');
}

// ----------------- Realtime Detection Logs Section -----------------
let currentPage = 1;
const logsPerPage = 10;
let lastDetectionId = 0;
let logsIntervalID = null;

async function fetchLogs() {
  const viewLogsSection = document.getElementById('viewLogs');
  if (!viewLogsSection || viewLogsSection.classList.contains('hidden')) return;

  try {
    showLoading();
    const { data: logs, error } = await supabaseClient
      .from('cr_found')
      .select('id,detection_timestamp,cid,name')
      .order('detection_timestamp', { ascending: false })
      .range((currentPage - 1) * logsPerPage, currentPage * logsPerPage - 1);

    if (error) {
      showError("Error fetching logs: " + error.message);
      return;
    }

    // Check for new detections
    if (logs && logs.length > 0) {
      const newestId = logs[0].id;
      if (lastDetectionId > 0 && newestId > lastDetectionId) {
        showShortMessage("New detection alert!", "error");
        if (navigator.vibrate) navigator.vibrate(500);
        if (document.getElementById('toggleNotifications') && document.getElementById('toggleNotifications').checked) {
          if (Notification.permission === "granted") {
            new Notification("Detection Alert", { body: "Warning: New detection alert!" });
          } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
              if (permission === "granted") {
                new Notification("Detection Alert", { body: "Warning: New detection alert!" });
              }
            });
          }
        }
        if (document.getElementById('toggleRedAlert') && document.getElementById('toggleRedAlert').checked) {
          showDetectionAlert("Warning: New detection alert!");
        }
      }
      lastDetectionId = newestId;
    }

    renderLogsTable(logs);
  } catch (err) {
    showError("Error loading logs: " + err.message);
  } finally {
    hideLoading();
  }
}

function renderLogsTable(logs) {
  const tbody = document.querySelector('#logsTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  if (!logs || logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">No detection records found</td></tr>';
    return;
  }

  logs.forEach(log => {
    const tr = document.createElement('tr');
    
    // Detection Time
    const tdTime = document.createElement('td');
    tdTime.textContent = new Date(log.detection_timestamp).toLocaleString();
    
    // CID
    const tdCID = document.createElement('td');
    tdCID.textContent = log.cid;
    
    // Name
    const tdName = document.createElement('td');
    tdName.textContent = log.name;
    
    // Thumbnail
    const tdThumb = document.createElement('td');
    const img = document.createElement('img');
    img.src = `${SUPABASE_URL}/storage/v1/object/public/criminal_photos/${log.cid}_1.jpg`;
    img.alt = 'Thumbnail';
    img.classList.add('thumbnail');
    img.onerror = function() {
      this.src = '';
      this.classList.add('fallback');
      this.textContent = 'No Image';
    };
    
    // Action: View Details button
    const tdAction = document.createElement('td');
    const btn = document.createElement('button');
    btn.textContent = 'View Details';
    btn.onclick = () => viewCriminalDetails(log.cid);
    
    tr.appendChild(tdTime);
    tr.appendChild(tdCID);
    tr.appendChild(tdName);
    tdThumb.appendChild(img);
    tr.appendChild(tdThumb);
    tdAction.appendChild(btn);
    tr.appendChild(tdAction);
    
    tbody.appendChild(tr);
  });
}

function nextPage() {
  currentPage++;
  fetchLogs();
}

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    fetchLogs();
  }
}

// Auto-refresh logs every 5 seconds only when "viewLogs" section is visible
function startLogsAutoRefresh() {
  if (logsIntervalID) clearInterval(logsIntervalID);
  logsIntervalID = setInterval(() => {
    if (document.getElementById('viewLogs') && !document.getElementById('viewLogs').classList.contains('hidden')) {
      fetchLogs();
    }
  }, 5000);
}
function stopLogsAutoRefresh() {
  if (logsIntervalID) clearInterval(logsIntervalID);
}

/* ---------- Detection Alert Functionality ---------- */
function showDetectionAlert(message) {
  const overlay = document.getElementById('alertOverlay');
  if (!overlay) return;
  const alertMsg = document.getElementById('alertMessage');
  if (alertMsg) alertMsg.textContent = message;
  overlay.style.display = 'flex';
  
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 5000);
}

document.addEventListener('DOMContentLoaded', () => {
  const alertOkBtn = document.getElementById('alertOk');
  if (alertOkBtn) {
    alertOkBtn.addEventListener('click', function() {
      document.getElementById('alertOverlay').style.display = 'none';
    });
  }
  
  const simulateDetectionEl = document.getElementById('simulateDetection');
  if (simulateDetectionEl) {
    simulateDetectionEl.addEventListener('click', function() {
      showDetectionAlert("Warning: New detection alert!");
    });
  }
  
  // Start auto-refresh if viewLogs section exists
  if (document.getElementById('viewLogs')) {
    startLogsAutoRefresh();
  }
});

/* ---------- Search Criminal Section ---------- */
const searchCriminalForm = document.getElementById('searchCriminalForm');
if (searchCriminalForm) {
  searchCriminalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const field = document.getElementById('criminalSearchField').value;
    const value = document.getElementById('criminalSearchInput').value.trim();
    if (!value) {
      showError("Please enter a search value.");
      return;
    }
    showLoading();
    try {
      let query = supabaseClient.from('criminal').select('*');
      if (field === 'cid') query = query.eq('cid', value);
      else query = query.ilike(field, `%${value}%`);
      const { data, error } = await query;
      if (error) {
        showError("Error searching criminals: " + error.message);
        return;
      }
      renderSearchResults(data);
    } catch (err) {
      showError("Error searching criminals: " + err.message);
    } finally {
      hideLoading();
    }
  });
}

function renderSearchResults(criminals) {
  const table = document.getElementById('criminalTable');
  if (!table) return;
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  thead.innerHTML = '';
  tbody.innerHTML = '';
  if (!criminals || criminals.length === 0) {
    thead.innerHTML = '<tr><th>No criminals found.</th></tr>';
    return;
  }
  // Headers: CID, Name, Thumbnail, Action
  const headerRow = document.createElement('tr');
  ['CID', 'Name', 'Thumbnail', 'Action'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  
  criminals.forEach(crim => {
    const tr = document.createElement('tr');
    const tdCID = document.createElement('td');
    tdCID.textContent = crim.cid;
    tr.appendChild(tdCID);
    
    const tdName = document.createElement('td');
    tdName.textContent = crim.name;
    tr.appendChild(tdName);
    
    const tdThumb = document.createElement('td');
    const img = document.createElement('img');
    img.src = `${SUPABASE_URL}/storage/v1/object/public/criminal_photos/${crim.cid}_1.jpg`;
    img.alt = 'Thumbnail';
    img.classList.add('thumbnail');
    tdThumb.appendChild(img);
    tr.appendChild(tdThumb);
    
    const tdAction = document.createElement('td');
    const btn = document.createElement('button');
    btn.textContent = 'View Details';
    btn.onclick = () => viewCriminalDetails(crim.cid);
    tdAction.appendChild(btn);
    tr.appendChild(tdAction);
    
    tbody.appendChild(tr);
  });
}

/* ---------- View Criminal Full Details ---------- */
async function viewCriminalDetails(cid) {
  showLoading();
  try {
    const { data: criminal, error: crimError } = await supabaseClient
      .from('criminal')
      .select('*')
      .eq('cid', cid)
      .single();
    if (crimError) {
      showError("Error fetching criminal details: " + crimError.message);
      return;
    }
    const { data: crimes, error: crimeError } = await supabaseClient
      .from('crime')
      .select('*')
      .eq('cid', cid);
      
    let detailsHTML = `<h3>Criminal Details</h3>
      <p><strong>CID:</strong> ${criminal.cid}</p>
      <p><strong>Name:</strong> ${criminal.name}</p>
      <p><strong>Age:</strong> ${criminal.age}</p>
      <p><strong>Aadhar:</strong> ${criminal.aadhar}</p>
      <p><strong>Phone:</strong> ${criminal.phone}</p>
      <p><strong>Gender:</strong> ${criminal.gender}</p>
      <p><strong>Address:</strong> ${criminal.address}</p>
      <p><strong>Reason:</strong> ${criminal.reason}</p>`;
      
    if (crimeError || !crimes || crimes.length === 0) {
      detailsHTML += `<h4>Crime Details</h4><p>No crime records available.</p>`;
    } else {
      detailsHTML += `<h4>Crime Details</h4>`;
      crimes.forEach(crime => {
        detailsHTML += `
          <p>
            <strong>Title:</strong> ${crime.title}<br>
            <strong>Detail:</strong> ${crime.detail}<br>
            <strong>Date:</strong> ${crime.date}<br>
            <strong>Description:</strong> ${crime.description}
          </p>`;
      });
    }
    detailsHTML += `<h4>Photos</h4>`;
    for (let i = 1; i <= 5; i++) {
      const photoUrl = `${SUPABASE_URL}/storage/v1/object/public/criminal_photos/${cid}_${i}.jpg`;
      detailsHTML += `<img src="${photoUrl}" alt="Photo ${i}" class="thumbnail" style="margin-right:0.5em;">`;
    }
    
    let modal = document.getElementById('detailsModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'detailsModal';
      modal.style.position = 'fixed';
      modal.style.top = '0';
      modal.style.left = '0';
      modal.style.width = '100%';
      modal.style.height = '100%';
      modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
      modal.style.display = 'flex';
      modal.style.justifyContent = 'center';
      modal.style.alignItems = 'center';
      modal.style.zIndex = '2000';
      document.body.appendChild(modal);
    }
    modal.innerHTML = `
      <div>
        ${detailsHTML}
        <br>
        <button onclick="closeDetailsModal()">Close</button>
      </div>
    `;
    modal.style.display = 'flex';
  } catch (err) {
    showError("Error loading criminal details: " + err.message);
  } finally {
    hideLoading();
  }
}

function closeDetailsModal() {
  const modal = document.getElementById('detailsModal');
  if (modal) modal.style.display = 'none';
}

/* ---------- Logout Function ---------- */
async function logout() {
  if (!confirm("Are you sure you want to logout?")) return;
  
  showLoading();
  const userid = localStorage.getItem("userid");
  if (userid) {
    try {
      const { data, error } = await supabaseClient
        .from('user_log')
        .insert({
          userid: userid,
          logout_time: new Date().toISOString(),
          status: 'logged out'
        });
      
      if (error) {
        console.error("Error inserting logout log:", error);
      } else {
        console.log("Logout log inserted:", data);
      }
    } catch (err) {
      console.error("Error during logout:", err);
    }
  }
  
  hideLoading();
  window.location.href = 'index.html';
}

/* ---------- Start Auto-Refresh ---------- */
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('viewLogs')) {
    startLogsAutoRefresh();
  }
  
  const alertOkBtn = document.getElementById('alertOk');
  if (alertOkBtn) {
    alertOkBtn.addEventListener('click', function() {
      document.getElementById('alertOverlay').style.display = 'none';
    });
  }
  
  const simulateDetectionEl = document.getElementById('simulateDetection');
  if (simulateDetectionEl) {
    simulateDetectionEl.addEventListener('click', function() {
      showDetectionAlert("Warning: New detection alert!");
    });
  }
});