const SUPABASE_URL = 'https://jxsurwtcxvznuqlgnxis.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4c3Vyd3RjeHZ6bnVxbGdueGlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk2NDA3MjIsImV4cCI6MjA1NTIxNjcyMn0.vSYd0BZK3OgbPvxT1n0uwc_o0xyTuVp1IqdiBtdTdQA';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Realtime Variables
let realtimeSubscription = null;
let lastDetectionId = 0;
const logsPerPage = 10;

// Utility Functions
function showLoading() {
  document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loadingOverlay').style.display = 'none';
}

function showMessage(message, type = 'success') {
  const msgEl = document.getElementById('globalMessage');
  msgEl.textContent = message;
  msgEl.className = `message ${type}`;
  msgEl.style.display = 'block';
  setTimeout(() => msgEl.style.display = 'none', type === 'error' ? 5000 : 2000);
}

function showError(message) { showMessage(message, 'error'); }
function showSuccess(message) { showMessage(message, 'success'); }

// Section Management
function showSection(sectionId) {
  if (realtimeSubscription) {
    supabaseClient.removeSubscription(realtimeSubscription);
    realtimeSubscription = null;
  }

  document.querySelectorAll('main section').forEach(section => {
    section.classList.add('hidden');
  });

  const section = document.getElementById(sectionId);
  if (section) {
    section.classList.remove('hidden');
    if (sectionId === 'viewLogs') {
      fetchLogs();
      setupRealtime();
    }
  }
}

// Real-time Detection Functions
async function fetchLogs() {
  try {
    showLoading();
    const { data: logs, error } = await supabaseClient
      .from('cr_found')
      .select('id,detection_timestamp,cid,name')
      .order('detection_timestamp', { ascending: false })
      .limit(logsPerPage);

    if (error) throw error;
    
    renderLogsTable(logs);
    if (logs.length > 0) lastDetectionId = logs[0].id;
  } catch (err) {
    showError("Error loading logs: " + err.message);
  } finally {
    hideLoading();
  }
}

function setupRealtime() {
  realtimeSubscription = supabaseClient
    .channel('detection-channel')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'cr_found',
        filter: `id=gt.${lastDetectionId}`
      },
      (payload) => handleNewDetection(payload.new)
    )
    .subscribe();
}

function handleNewDetection(newRecord) {
  if (newRecord.id > lastDetectionId) {
    lastDetectionId = newRecord.id;
    triggerAlerts(newRecord);
    prependNewLog(newRecord);
  }
}

function triggerAlerts(detection) {
  showMessage(`New detection: ${detection.name}`, 'error');
  
  if (document.getElementById('toggleNotifications').checked) {
    if (Notification.permission === "granted") {
      new Notification("Detection Alert", {
        body: `Name: ${detection.name}\nCID: ${detection.cid}`
      });
    }
  }
  
  if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
  
  if (document.getElementById('toggleRedAlert').checked) {
    showDetectionAlert(`ALERT: ${detection.name} detected!`);
  }
}

// Logs Table Functions
function prependNewLog(log) {
  const tbody = document.querySelector('#logsTable tbody');
  const rows = tbody.querySelectorAll('tr');
  if (rows.length >= logsPerPage) tbody.lastElementChild.remove();
  tbody.prepend(createLogRow(log));
}

function renderLogsTable(logs) {
  const tbody = document.querySelector('#logsTable tbody');
  tbody.innerHTML = '';
  
  if (!logs?.length) {
    tbody.innerHTML = '<tr><td colspan="5">No detection records found</td></tr>';
    return;
  }

  logs.forEach(log => tbody.appendChild(createLogRow(log)));
}

function createLogRow(log) {
  const row = document.createElement('tr');
  row.innerHTML = `
    <td>${new Date(log.detection_timestamp).toLocaleString()}</td>
    <td>${log.cid}</td>
    <td>${log.name}</td>
    <td>
      <img src="${SUPABASE_URL}/storage/v1/object/public/criminal_photos/${log.cid}_1.jpg" 
           class="thumbnail" 
           onerror="this.style.display='none'">
    </td>
    <td><button onclick="viewCriminalDetails('${log.cid}')">Details</button></td>
  `;
  return row;
}

// Search Criminal Functions
document.getElementById('searchCriminalForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const field = document.getElementById('criminalSearchField').value;
  const value = document.getElementById('criminalSearchInput').value.trim();

  if (!value) return showError("Please enter search criteria");

  try {
    showLoading();
    let query = supabaseClient.from('criminal').select('*');
    
    if (field === 'cid') {
      query = query.ilike('cid', `%${value}%`);
    } else {
      query = query.ilike(field, `%${value}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    renderSearchResults(data);
  } catch (err) {
    showError("Search failed: " + err.message);
  } finally {
    hideLoading();
  }
});

function renderSearchResults(criminals) {
  const table = document.getElementById('criminalTable');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  
  thead.innerHTML = '<tr><th>CID</th><th>Name</th><th>Photo</th><th>Actions</th></tr>';
  tbody.innerHTML = '';

  if (!criminals?.length) {
    tbody.innerHTML = '<tr><td colspan="4">No matching records found</td></tr>';
    return;
  }

  criminals.forEach(criminal => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${criminal.cid}</td>
      <td>${criminal.name}</td>
      <td>
        <img src="${SUPABASE_URL}/storage/v1/object/public/criminal_photos/${criminal.cid}_1.jpg" 
             class="thumbnail" 
             onerror="this.style.display='none'">
      </td>
      <td><button onclick="viewCriminalDetails('${criminal.cid}')">View</button></td>
    `;
    tbody.appendChild(row);
  });
}

// Criminal Details Modal
async function viewCriminalDetails(cid) {
  try {
    showLoading();
    const [{ data: criminal }, { data: crimes }] = await Promise.all([
      supabaseClient.from('criminal').select('*').eq('cid', cid).single(),
      supabaseClient.from('crime').select('*').eq('cid', cid)
    ]);

    let detailsHTML = `
      <h3>${criminal.name}</h3>
      <p><strong>CID:</strong> ${criminal.cid}</p>
      <p><strong>Age:</strong> ${criminal.age}</p>
      <p><strong>Contact:</strong> ${criminal.phone}</p>
      <p><strong>Address:</strong> ${criminal.address}</p>
      <h4>Crimes:</h4>
      ${crimes?.length ? crimes.map(crime => `
        <div class="crime-entry">
          <p><strong>${crime.title}</strong></p>
          <p>${crime.detail}</p>
          <p>Date: ${new Date(crime.date).toLocaleDateString()}</p>
        </div>
      `).join('') : '<p>No crime records found</p>'}
      <h4>Photos:</h4>
      <div class="photo-grid">
        ${Array.from({length: 5}, (_, i) => `
          <img src="${SUPABASE_URL}/storage/v1/object/public/criminal_photos/${cid}_${i+1}.jpg" 
               class="detail-photo">
        `).join('')}
      </div>`;

    const modal = document.getElementById('detailsModal');
    modal.innerHTML = `
      <div class="modal-content">
        ${detailsHTML}
        <button onclick="closeDetailsModal()">Close</button>
      </div>`;
    modal.style.display = 'flex';
  } catch (err) {
    showError("Error loading details: " + err.message);
  } finally {
    hideLoading();
  }
}

function closeDetailsModal() {
  document.getElementById('detailsModal').style.display = 'none';
}

// Alert Functions
function showDetectionAlert(message) {
  const overlay = document.getElementById('alertOverlay');
  overlay.querySelector('#alertMessage').textContent = message;
  overlay.style.display = 'flex';
  setTimeout(() => overlay.style.display = 'none', 5000);
}

// Logout Function
async function logout() {
  if (!confirm("Are you sure you want to logout?")) return;
  
  try {
    const userId = localStorage.getItem("userid");
    if (userId) {
      await supabaseClient
        .from('user_log')
        .insert({ 
          userid: userId, 
          logout_time: new Date().toISOString(), 
          status: 'logged out' 
        });
    }
  } catch (err) {
    console.error("Logout error:", err);
  }
  
  localStorage.clear();
  window.location.href = 'index.html';
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  showSection('viewLogs');
  
  document.getElementById('alertOk').addEventListener('click', () => {
    document.getElementById('alertOverlay').style.display = 'none';
  });

  window.addEventListener('beforeunload', () => {
    if (realtimeSubscription) {
      supabaseClient.removeSubscription(realtimeSubscription);
    }
  });
});
