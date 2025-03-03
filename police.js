// Supabase credentials and client initialization
const SUPABASE_URL = 'https://jxsurwtcxvznuqlgnxis.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4c3Vyd3RjeHZ6bnVxbGdueGlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk2NDA3MjIsImV4cCI6MjA1NTIxNjcyMn0.vSYd0BZK3OgbPvxT1n0uwc_o0xyTuVp1IqdiBtdTdQA';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ---------- Alert Overlay Functions ---------- */
function showAlertOverlay(message, type = 'success') {
  let overlay = document.getElementById("alertOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "alertOverlay";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    overlay.style.display = "flex";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.zIndex = "3000";
    document.body.appendChild(overlay);
  }
  // Create a container for the message
  const container = document.createElement("div");
  container.style.backgroundColor = (type === 'success') ? "#2ecc71" : "#e74c3c";
  container.style.color = "#fff";
  container.style.padding = "20px";
  container.style.borderRadius = "8px";
  container.style.textAlign = "center";
  container.style.maxWidth = "80%";
  container.innerHTML = `<p>${message}</p><button style="margin-top:20px; padding:10px 20px; border:none; border-radius:5px; cursor:pointer;">OK</button>`;
  
  overlay.innerHTML = "";
  overlay.appendChild(container);
  
  const okBtn = container.querySelector("button");
  okBtn.addEventListener("click", () => {
    overlay.style.display = "none";
  });
  
  overlay.style.display = "flex";
  
  // Auto-dismiss after 10 seconds if user doesn't press OK
  setTimeout(() => {
    overlay.style.display = "none";
  }, 10000);
}

function showSuccessOverlay(message) {
  showAlertOverlay(message, 'success');
}

function showErrorOverlay(message) {
  showAlertOverlay(message, 'error');
}

/* ---------- Utility Functions ---------- */
function showLoading() {
  document.getElementById('loadingOverlay').style.display = 'flex';
}
function hideLoading() {
  document.getElementById('loadingOverlay').style.display = 'none';
}
// (Legacy global messages functions remain if needed)
// function showError(message) { ... }
// function showSuccess(message) { ... }

function showSection(section) {
  document.getElementById('search-section').classList.add('hidden');
  document.getElementById('add-section').classList.add('hidden');
  document.getElementById('modify-section').classList.add('hidden');
  if (section === 'search') {
    document.getElementById('search-section').classList.remove('hidden');
  } else if (section === 'add') {
    document.getElementById('add-section').classList.remove('hidden');
  } else if (section === 'modify') {
    document.getElementById('modify-section').classList.remove('hidden');
  }
  // Hide details if open
  document.getElementById('details-section').classList.add('hidden');
}

/* ---------- SEARCH FUNCTIONALITY ---------- */
document.getElementById('search-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  try {
    showLoading();
    submitBtn.disabled = true;
    
    const field = document.getElementById('search-field').value;
    const value = document.getElementById('search-input').value.trim();
    if (!value) {
      showErrorOverlay('Please enter a search value');
      return;
    }
    
    let query = supabaseClient.from('criminal').select('*');
    if (field === 'cid') {
      query = query.eq('cid', value);
    } else {
      query = query.ilike(field, `%${value}%`);
    }
    
    const { data, error } = await query;
    if (error) {
      showErrorOverlay("Error searching criminals: " + error.message);
      return;
    }
    populateResultsTable(data);
  } catch (error) {
    showErrorOverlay(`Search failed: ${error.message}`);
  } finally {
    hideLoading();
    submitBtn.disabled = false;
  }
});

function populateResultsTable(criminals) {
  const tbody = document.querySelector('#results-table tbody');
  tbody.innerHTML = "";
  if (criminals.length === 0) {
    tbody.innerHTML = "<tr><td colspan='4'>No results found.</td></tr>";
  } else {
    criminals.forEach(criminal => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${criminal.cid}</td>
        <td>${criminal.name}</td>
        <td><img src="${SUPABASE_URL}/storage/v1/object/public/criminal_photos/${criminal.cid}_1.jpg" alt="Thumbnail" class="thumbnail"></td>
        <td><button onclick="showDetails('${criminal.cid}')">Show Details</button></td>
      `;
      tbody.appendChild(tr);
    });
  }
  document.getElementById('search-results').classList.remove('hidden');
}

/* ---------- View Full Details ---------- */
async function showDetails(cid) {
  try {
    showLoading();
    const { data: criminal, error: crimError } = await supabaseClient
      .from('criminal')
      .select('*')
      .eq('cid', cid)
      .single();
    if (crimError) {
      showErrorOverlay("Error fetching criminal details: " + crimError.message);
      return;
    }
    
    const { data: crimes, error: crimeError } = await supabaseClient
      .from('crime')
      .select('*')
      .eq('cid', cid);
      
    const { data: logs, error: logError } = await supabaseClient
      .from('cr_found')
      .select('*')
      .eq('cid', cid);
      
    document.getElementById('criminal-details').innerHTML = `
      <p><strong>CID:</strong> ${criminal.cid}</p>
      <p><strong>Name:</strong> ${criminal.name}</p>
      <p><strong>Age:</strong> ${criminal.age}</p>
      <p><strong>Aadhar:</strong> ${criminal.aadhar}</p>
      <p><strong>Phone:</strong> ${criminal.phone}</p>
      <p><strong>Gender:</strong> ${criminal.gender}</p>
      <p><strong>Address:</strong> ${criminal.address}</p>
      <p><strong>Reason:</strong> ${criminal.reason}</p>
    `;
    
    let crimeHTML = "<h4>Crime Details:</h4>";
    if (crimeError || !crimes || crimes.length === 0) {
      crimeHTML += "<p>No crime records available.</p>";
    } else {
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
    }
    document.getElementById('crime-details').innerHTML = crimeHTML;
    
    let logHTML = "<h4>Log Details:</h4>";
    if (logError || !logs || logs.length === 0) {
      logHTML += "<p>No log records available.</p>";
    } else {
      logs.forEach(log => {
        logHTML += `<p>${JSON.stringify(log)}</p>`;
      });
    }
    document.getElementById('log-details').innerHTML = logHTML;
    
    let photosHTML = "";
    for (let i = 1; i <= 5; i++) {
      const photoUrl = `${SUPABASE_URL}/storage/v1/object/public/criminal_photos/${cid}_${i}.jpg`;
      photosHTML += `
        <img src="${photoUrl}" 
             alt="Photo ${i}" 
             class="full"
             onerror="this.style.display='none'"
             data-fallback="${cid}_${i}">
      `;
    }
    photosHTML += `<div id="photo-fallback" style="display:none;">No photos available</div>`;
    document.getElementById('photos-section').innerHTML = photosHTML;
    
    setTimeout(() => {
      if (!document.querySelector('#photos-section img:not([style*="none"])')) {
        document.getElementById('photo-fallback').style.display = 'block';
      }
    }, 1000);
    
    document.getElementById('details-section').classList.remove('hidden');
  } catch (error) {
    showErrorOverlay(`Failed to load details: ${error.message}`);
  } finally {
    hideLoading();
  }
}

function closeDetails() {
  document.getElementById('details-section').classList.add('hidden');
}

/* ---------- ADD CRIMINAL FUNCTIONALITY ---------- */
async function checkAddCriminal() {
  const cid = document.getElementById('add-cid').value.trim();
  if (!cid) {
    showErrorOverlay("Please enter a CID.");
    return;
  }
  const { data, error } = await supabaseClient
    .from('criminal')
    .select('*')
    .eq('cid', cid)
    .single();
  if (data) {
    showErrorOverlay("Criminal already exists. Use Modify section to update.");
  } else {
    document.getElementById('add-form-fields').classList.remove('hidden');
  }
}

document.getElementById('full-add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  
  try {
    showLoading();
    submitBtn.disabled = true;
    
    const cid = document.getElementById('add-cid').value.trim();
    const name = document.getElementById('add-name').value.trim() || "Not available";
    const ageInput = document.getElementById('add-age').value.trim();
    const age = ageInput ? parseInt(ageInput) : 0;
    const aadhar = document.getElementById('add-aadhar').value.trim() || "Not available";
    const phone = document.getElementById('add-phone').value.trim() || "Not available";
    const gender = document.getElementById('add-gender').value.trim() || "Not available";
    const address = document.getElementById('add-address').value.trim() || "Not available";
    const reason = document.getElementById('add-reason').value.trim() || "Not available";
    
    const crimeTitle = document.getElementById('crime-title').value.trim() || "Not available";
    const crimeDetail = document.getElementById('crime-detail').value.trim() || "Not available";
    const crimeDate = document.getElementById('crime-date').value || "Not available";
    const crimeDescription = document.getElementById('crime-description').value.trim() || "Not available";
    
    for (let i = 1; i <= 5; i++) {
      const fileInput = document.getElementById(`photo${i}`);
      if (i === 1 && fileInput.files.length === 0) {
        showErrorOverlay(`Photo ${i} is required.`);
        return;
      }
      if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const fileName = `${cid}_${i}.jpg`;
        const { error } = await supabaseClient.storage
          .from('criminal_photos')
          .upload(fileName, file, { upsert: true });
        if (error) {
          showErrorOverlay("Error uploading " + fileName + ": " + error.message);
          return;
        }
      }
    }
    
    const { error: insertError } = await supabaseClient
      .from('criminal')
      .insert([{ cid, name, age, aadhar, phone, gender, address, reason }]);
    if (insertError) {
      showErrorOverlay("Error inserting criminal record: " + insertError.message);
      return;
    }
    
    const { error: crimeInsertError } = await supabaseClient
      .from('crime')
      .insert([{ cid, title: crimeTitle, detail: crimeDetail, date: crimeDate, description: crimeDescription }]);
    if (crimeInsertError) {
      showErrorOverlay("Error inserting crime details: " + crimeInsertError.message);
      return;
    }
    
    showSuccessOverlay('Criminal added successfully');
    form.reset();
    document.getElementById('add-form-fields').classList.add('hidden');
    
  } catch (error) {
    showErrorOverlay(`Failed to add criminal: ${error.message}`);
  } finally {
    hideLoading();
    submitBtn.disabled = false;
  }
});

/* ---------- MODIFY CRIMINAL FUNCTIONALITY ---------- */
async function loadCriminalForModify() {
  const cid = document.getElementById('modify-cid').value.trim();
  if (!cid) {
    showErrorOverlay("Please enter a CID.");
    return;
  }
  
  try {
    showLoading();
    
    const { data: criminal, error: crimError } = await supabaseClient
      .from('criminal')
      .select('*')
      .eq('cid', cid)
      .single();
    if (crimError || !criminal) {
      showErrorOverlay("Criminal not found.");
      return;
    }
    
    document.getElementById('mod-cid').value = criminal.cid;
    document.getElementById('mod-name').value = criminal.name;
    document.getElementById('mod-age').value = criminal.age;
    document.getElementById('mod-aadhar').value = criminal.aadhar;
    document.getElementById('mod-phone').value = criminal.phone;
    document.getElementById('mod-gender').value = criminal.gender;
    document.getElementById('mod-address').value = criminal.address;
    document.getElementById('mod-reason').value = criminal.reason;
    
    const { data: crimes } = await supabaseClient
      .from('crime')
      .select('*')
      .eq('cid', cid);
    if (crimes && crimes.length > 0) {
      const crime = crimes[0];
      document.getElementById('mod-crime-title').value = crime.title;
      document.getElementById('mod-crime-detail').value = crime.detail;
      document.getElementById('mod-crime-date').value = crime.date;
      document.getElementById('mod-crime-description').value = crime.description;
    } else {
      document.getElementById('mod-crime-title').value = "";
      document.getElementById('mod-crime-detail').value = "";
      document.getElementById('mod-crime-date').value = "";
      document.getElementById('mod-crime-description').value = "";
    }
    
    let photosHTML = "";
    for (let i = 1; i <= 5; i++) {
      const photoUrl = `${SUPABASE_URL}/storage/v1/object/public/criminal_photos/${cid}_${i}.jpg`;
      photosHTML += `
        <div>
          <img src="${photoUrl}" alt="Photo ${i}" class="thumbnail">
          <br>
          <label for="mod-photo${i}">Replace Photo ${i}:</label>
          <input type="file" id="mod-photo${i}" accept="image/*">
        </div>
      `;
    }
    document.getElementById('modify-photos').innerHTML = photosHTML;
    document.getElementById('modify-form-fields').classList.remove('hidden');
    
  } catch (error) {
    showErrorOverlay(`Error loading details: ${error.message}`);
  } finally {
    hideLoading();
  }
}

document.getElementById('modify-criminal-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  
  try {
    showLoading();
    submitBtn.disabled = true;
    
    const cid = document.getElementById('mod-cid').value.trim();
    const name = document.getElementById('mod-name').value.trim() || "Not available";
    const ageInput = document.getElementById('mod-age').value.trim();
    const age = ageInput ? parseInt(ageInput) : 0;
    const aadhar = document.getElementById('mod-aadhar').value.trim() || "Not available";
    const phone = document.getElementById('mod-phone').value.trim() || "Not available";
    const gender = document.getElementById('mod-gender').value.trim() || "Not available";
    const address = document.getElementById('mod-address').value.trim() || "Not available";
    const reason = document.getElementById('mod-reason').value.trim() || "Not available";
    
    const { error: updateError } = await supabaseClient
      .from('criminal')
      .update({ name, age, aadhar, phone, gender, address, reason })
      .eq('cid', cid);
    if (updateError) {
      showErrorOverlay("Error updating criminal record: " + updateError.message);
      return;
    }
    
    const crimeTitle = document.getElementById('mod-crime-title').value.trim() || "Not available";
    const crimeDetail = document.getElementById('mod-crime-detail').value.trim() || "Not available";
    const crimeDate = document.getElementById('mod-crime-date').value || "Not available";
    const crimeDescription = document.getElementById('mod-crime-description').value.trim() || "Not available";
    
    const { data: existingCrimes, error: selectCrimeError } = await supabaseClient
      .from('crime')
      .select('*')
      .eq('cid', cid);
    if (selectCrimeError) {
      showErrorOverlay("Error checking crime details: " + selectCrimeError.message);
      return;
    }
    let crimeOperation;
    if (existingCrimes && existingCrimes.length > 0) {
      crimeOperation = await supabaseClient
        .from('crime')
        .update({ title: crimeTitle, detail: crimeDetail, date: crimeDate, description: crimeDescription })
        .eq('cid', cid);
    } else {
      crimeOperation = await supabaseClient
        .from('crime')
        .insert([{ cid, title: crimeTitle, detail: crimeDetail, date: crimeDate, description: crimeDescription }]);
    }
    if (crimeOperation.error) {
      showErrorOverlay("Error updating/inserting crime details: " + crimeOperation.error.message);
      return;
    }
    
    for (let i = 1; i <= 5; i++) {
      const fileInput = document.getElementById(`mod-photo${i}`);
      if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const fileName = `${cid}_${i}.jpg`;
        const { error } = await supabaseClient.storage
          .from('criminal_photos')
          .upload(fileName, file, { upsert: true });
        if (error) {
          showErrorOverlay("Error updating photo " + fileName + ": " + error.message);
          return;
        }
      }
    }
    
    showSuccessOverlay('Criminal record updated successfully');
  } catch (error) {
    showErrorOverlay(`Update failed: ${error.message}`);
  } finally {
    hideLoading();
    submitBtn.disabled = false;
  }
});
 
// Additional input validation for age and phone
document.getElementById('add-age').addEventListener('input', (e) => {
  const value = parseInt(e.target.value);
  if (value < 1 || value > 120) {
    e.target.setCustomValidity('Age must be between 1 and 120');
  } else {
    e.target.setCustomValidity('');
  }
});
document.getElementById('add-phone').addEventListener('input', (e) => {
  const isValid = /^\d{10}$/.test(e.target.value);
  e.target.setCustomValidity(isValid ? '' : 'Phone must be 10 digits');
});
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

