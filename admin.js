// Supabase credentials and client initialization
const SUPABASE_URL = 'https://jxsurwtcxvznuqlgnxis.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4c3Vyd3RjeHZ6bnVxbGdueGlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk2NDA3MjIsImV4cCI6MjA1NTIxNjcyMn0.vSYd0BZK3OgbPvxT1n0uwc_o0xyTuVp1IqdiBtdTdQA';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
  setTimeout(() => { msgEl.style.display = 'none'; }, 5000);
}
function showError(message) { showMessage(message, 'error'); }
function showSuccess(message) { showMessage(message, 'success'); }

// Section Toggling
function showSection(sectionId) {
  const sections = document.querySelectorAll('main section');
  sections.forEach(sec => sec.classList.remove('active'));
  document.getElementById(sectionId).classList.add('active');
  
  // Load data based on section
  if (sectionId === 'manageUsers') loadUsers();
  else if (sectionId === 'userLogs') loadUserLogs();
  else if (sectionId === 'criminalLogs') loadCriminalLogs();
}
async function logout() {
  if (!confirm("Are you sure you want to logout?")) {
    return;
  }
  
  showLoading(); // Show spinner
  
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
  
  hideLoading(); // Hide spinner
  window.location.href = 'index.html';
}


// ----------------- Manage Users Section -----------------
// Load Users from 'users' table
async function loadUsers() {
  showLoading();
  try {
    const { data, error } = await supabaseClient.from('users').select('*');
    if (error) { showError("Error loading users: " + error.message); return; }
    renderUsersTable(data);
  } catch (err) { showError("Error loading users: " + err.message); }
  finally { hideLoading(); }
}
function renderUsersTable(users) {
  const table = document.getElementById('usersTable');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  thead.innerHTML = ''; tbody.innerHTML = '';
  if (!users || users.length === 0) {
    thead.innerHTML = '<tr><th>No users found</th></tr>';
    return;
  }
  // Columns: sno, userid, password, utype, Actions
  const headers = ['sno', 'userid', 'password', 'utype', 'Actions'];
  const headerRow = document.createElement('tr');
  headers.forEach(h => { const th = document.createElement('th'); th.textContent = h; headerRow.appendChild(th); });
  thead.appendChild(headerRow);
  
  users.forEach(user => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${user.sno}</td>
      <td>${user.userid}</td>
      <td>${user.password}</td>
      <td>${user.utype}</td>
    `;
    const actionsTd = document.createElement('td');
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.onclick = () => editUser(user);
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => deleteUser(user);
    actionsTd.appendChild(editBtn);
    actionsTd.appendChild(deleteBtn);
    row.appendChild(actionsTd);
    tbody.appendChild(row);
  });
}
document.getElementById('addUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const userid = document.getElementById('newUserID').value.trim();
  const password = document.getElementById('newUserPassword').value.trim();
  const utype = document.getElementById('newUserType').value;
  if (!userid || !password || !utype) { showError("All fields are required."); return; }
  showLoading();
  try {
    const { data, error } = await supabaseClient.from('users').insert([{ userid, password, utype }]);
    if (error) { showError("Error adding user: " + error.message); return; }
    showSuccess("User added successfully.");
    document.getElementById('addUserForm').reset();
    loadUsers();
  } catch (err) { showError("Error adding user: " + err.message); }
  finally { hideLoading(); }
});
async function editUser(user) {
  const newUserid = prompt("Enter new User ID:", user.userid);
  const newPassword = prompt("Enter new Password:", user.password);
  const newUtype = prompt("Enter new User Type (admin, police, security):", user.utype);
  if (!newUserid || !newPassword || !newUtype) { showError("All fields are required."); return; }
  showLoading();
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .update({ userid: newUserid, password: newPassword, utype: newUtype })
      .eq('sno', user.sno);
    if (error) { showError("Error updating user: " + error.message); return; }
    showSuccess("User updated successfully.");
    loadUsers();
  } catch (err) { showError("Error updating user: " + err.message); }
  finally { hideLoading(); }
}
async function deleteUser(user) {
  if (!confirm("Are you sure you want to delete this user?")) return;
  showLoading();
  try {
    const { data, error } = await supabaseClient.from('users').delete().eq('sno', user.sno);
    if (error) { showError("Error deleting user: " + error.message); return; }
    showSuccess("User deleted successfully.");
    loadUsers();
  } catch (err) { showError("Error deleting user: " + err.message); }
  finally { hideLoading(); }
}

// ----------------- Search Criminals Section -----------------
document.getElementById('searchCriminalForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const field = document.getElementById('criminalSearchField').value;
  const value = document.getElementById('criminalSearchInput').value.trim();
  if (!value) { showError("Please enter a search value."); return; }
  showLoading();
  try {
    let query = supabaseClient.from('criminal').select('*');
    if (field === 'cid') query = query.eq('cid', value);
    else query = query.ilike(field, `%${value}%`);
    const { data, error } = await query;
    if (error) { showError("Error searching criminals: " + error.message); return; }
    renderCriminalTable(data);
  } catch (err) { showError("Error searching criminals: " + err.message); }
  finally { hideLoading(); }
});
function renderCriminalTable(criminals) {
  const table = document.getElementById('criminalTable');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  thead.innerHTML = ''; tbody.innerHTML = '';
  if (!criminals || criminals.length === 0) {
    thead.innerHTML = '<tr><th>No criminals found</th></tr>';
    return;
  }
  // Only display: CID, Name, Photo Thumbnail, and a Full Details button.
  const headers = ['CID', 'Name', 'Photo', 'Action'];
  const headerRow = document.createElement('tr');
  headers.forEach(h => { 
    const th = document.createElement('th'); 
    th.textContent = h; 
    headerRow.appendChild(th); 
  });
  thead.appendChild(headerRow);
  
  criminals.forEach(crim => {
    const row = document.createElement('tr');
    
    const tdCID = document.createElement('td');
    tdCID.textContent = crim.cid;
    row.appendChild(tdCID);
    
    const tdName = document.createElement('td');
    tdName.textContent = crim.name;
    row.appendChild(tdName);
    
    const tdPhoto = document.createElement('td');
    const img = document.createElement('img');
    img.src = `${SUPABASE_URL}/storage/v1/object/public/criminal_photos/${crim.cid}_1.jpg`;
    img.alt = 'Thumbnail';
    img.classList.add('thumbnail');
    tdPhoto.appendChild(img);
    row.appendChild(tdPhoto);
    
    const tdAction = document.createElement('td');
    const detailsBtn = document.createElement('button');
    detailsBtn.textContent = 'Full Details';
    detailsBtn.onclick = () => viewCriminalDetails(crim.cid);
    tdAction.appendChild(detailsBtn);
    row.appendChild(tdAction);
    
    tbody.appendChild(row);
  });
}
// View Criminal Full Details
async function viewCriminalDetails(cid) {
  showLoading();
  try {
    // Fetch criminal details
    const { data: criminal, error: crimError } = await supabaseClient
      .from('criminal')
      .select('*')
      .eq('cid', cid)
      .single();
    if (crimError) { showError("Error fetching criminal details: " + crimError.message); return; }
    
    // Fetch crime details (if available)
    const { data: crimes, error: crimeError } = await supabaseClient
      .from('crime')
      .select('*')
      .eq('cid', cid);
      
    // Populate the details section
    document.getElementById('criminalInfo').innerHTML = `
      <p><strong>CID:</strong> ${criminal.cid}</p>
      <p><strong>Name:</strong> ${criminal.name}</p>
      <p><strong>Age:</strong> ${criminal.age}</p>
      <p><strong>Aadhar:</strong> ${criminal.aadhar}</p>
      <p><strong>Phone:</strong> ${criminal.phone}</p>
      <p><strong>Gender:</strong> ${criminal.gender}</p>
      <p><strong>Address:</strong> ${criminal.address}</p>
      <p><strong>Reason:</strong> ${criminal.reason}</p>
    `;
    const crimeInfoDiv = document.getElementById('crimeInfo');
    if (crimeError || !crimes || crimes.length === 0) {
      crimeInfoDiv.innerHTML = '<p>No crime details available.</p>';
    } else {
      let crimeHTML = '<h4>Crime Details:</h4>';
      crimes.forEach(crime => {
        crimeHTML += `
          <p>
            <strong>Title:</strong> ${crime.title}<br>
            <strong>Detail:</strong> ${crime.detail}<br>
            <strong>Date:</strong> ${crime.date}<br>
            <strong>Description:</strong> ${crime.description}
          </p>
        `;
      });
      crimeInfoDiv.innerHTML = crimeHTML;
    }
    // Display all 5 photos
    const photosDiv = document.getElementById('criminalPhotos');
    let photosHTML = '<h4>Photos:</h4>';
    for (let i = 1; i <= 5; i++) {
      const photoUrl = `${SUPABASE_URL}/storage/v1/object/public/criminal_photos/${cid}_${i}.jpg`;
      photosHTML += `<img src="${photoUrl}" alt="Photo ${i}" class="thumbnail" style="margin-right:0.5em;">`;
    }
    photosDiv.innerHTML = photosHTML;
    
    // Show the full details section
    document.getElementById('criminalDetails').classList.remove('hidden');
  } catch (error) {
    showError("Error loading criminal details: " + error.message);
  } finally {
    hideLoading();
  }
}
function closeCriminalDetails() {
  document.getElementById('criminalDetails').classList.add('hidden');
}
// ----------------- User Logs Section -----------------
async function loadUserLogs() {
  showLoading();
  try {
    const { data, error } = await supabaseClient.from('user_log').select('*');
    if (error) { showError("Error loading user logs: " + error.message); return; }
    renderLogsTable('userLogsTable', data);
  } catch (err) { showError("Error loading user logs: " + err.message); }
  finally { hideLoading(); }
}
// ----------------- Criminal Logs Section -----------------
async function loadCriminalLogs() {
  showLoading();
  try {
    const { data, error } = await supabaseClient.from('cr_found').select('*');
    if (error) { showError("Error loading criminal logs: " + error.message); return; }
    renderLogsTable('criminalLogsTable', data);
  } catch (err) { showError("Error loading criminal logs: " + err.message); }
  finally { hideLoading(); }
}
function renderLogsTable(tableId, logs) {
  const table = document.getElementById(tableId);
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  thead.innerHTML = ''; tbody.innerHTML = '';
  if (!logs || logs.length === 0) {
    thead.innerHTML = '<tr><th>No logs found</th></tr>';
    return;
  }
  const headers = Object.keys(logs[0]);
  const headerRow = document.createElement('tr');
  headers.forEach(h => { const th = document.createElement('th'); th.textContent = h; headerRow.appendChild(th); });
  thead.appendChild(headerRow);
  logs.forEach(log => {
    const row = document.createElement('tr');
    headers.forEach(h => {
      const td = document.createElement('td');
      td.textContent = log[h];
      row.appendChild(td);
    });
    tbody.appendChild(row);
  });
}
// On initial load, show Manage Users section
document.addEventListener('DOMContentLoaded', () => { showSection('manageUsers'); });
