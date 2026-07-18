import FitParser from 'fit-file-parser';

// State Variables
let gapiApiLoaded = false;
let gisLoaded = false;
let tokenClient = null;
let accessToken = null;
let allFiles = [];

// Leaflet Map State
let map = null;
let pathGroup = null;
const neonColors = [
  '#39FF14', // Neon Green
  '#00F3FF', // Neon Cyan
  '#FF007F', // Neon Pink
  '#FF5F00', // Neon Orange
  '#E0FF00', // Neon Yellow
  '#8A2BE2'  // Neon Violet
];
let colorIndex = 0;

// Selected Folder Settings
let currentFolderId = localStorage.getItem('drive_sync_folder_id') || null;
let currentFolderName = localStorage.getItem('drive_sync_folder_name') || null;

// DOM Elements
const btnAuth = document.getElementById('btn-auth');
const btnSignout = document.getElementById('btn-signout');
const btnPicker = document.getElementById('btn-picker');
const btnChangeFolder = document.getElementById('btn-change-folder');
const connectionStatus = document.getElementById('connection-status');
const statusText = document.getElementById('status-text');
const selectedFolderName = document.getElementById('selected-folder-name');
const filesList = document.getElementById('files-list');

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkConfigAndInit();
});

// Event Bindings
function setupEventListeners() {
  if (btnAuth) btnAuth.addEventListener('click', handleAuth);
  if (btnSignout) btnSignout.addEventListener('click', handleSignout);
  if (btnPicker) btnPicker.addEventListener('click', openPicker);
  if (btnChangeFolder) btnChangeFolder.addEventListener('click', openPicker);
}

// 1. Check Config and Trigger SDK Loads
function checkConfigAndInit() {
  if (!window.DRIVE_APP_CONFIG || 
      DRIVE_APP_CONFIG.API_KEY === "YOUR_GOOGLE_API_KEY" || 
      DRIVE_APP_CONFIG.CLIENT_ID === "YOUR_GOOGLE_OAUTH_CLIENT_ID" ||
      !DRIVE_APP_CONFIG.API_KEY || 
      !DRIVE_APP_CONFIG.CLIENT_ID) {
    showState('credentials-missing');
    return;
  }
  
  showState('loading');
  loadGoogleApis();
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(script);
  });
}

async function loadGoogleApis() {
  try {
    // Load GAPI (API Client)
    await loadScript('https://apis.google.com/js/api.js');
    await new Promise((resolve) => gapi.load('client:picker', resolve));

    // Initialize GAPI
    await gapi.client.init({
      apiKey: DRIVE_APP_CONFIG.API_KEY,
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    });
    gapiApiLoaded = true;

    // Load GIS (Identity Services)
    await loadScript('https://accounts.google.com/gsi/client');
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: DRIVE_APP_CONFIG.CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: '', // defined dynamic
    });
    gisLoaded = true;

    // Finish Init Checks
    checkInitialization();
  } catch (error) {
    console.error('Error loading Google APIs:', error);
    showError(`Failed to load Google Drive SDKs: ${error.message || error}`);
  }
}

function checkInitialization() {
  if (gapiApiLoaded && gisLoaded) {
    const savedToken = localStorage.getItem('drive_sync_token');
    const tokenExpiry = localStorage.getItem('drive_sync_token_expiry');
    const now = Date.now();

    if (savedToken && tokenExpiry && parseInt(tokenExpiry) > now) {
      accessToken = savedToken;
      gapi.client.setToken({ access_token: accessToken });
      updateConnectionStatus(true);
      onAuthSuccess();
    } else {
      updateConnectionStatus(false);
      showState('connect-prompt');
    }
  }
}

// 2. Authentication Flow
function handleAuth() {
  if (!tokenClient) return;

  setLoadingStatus('Connecting...');

  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) {
      console.error('Auth Error:', resp);
      updateConnectionStatus(false);
      showState('connect-prompt');
      alert(`Auth failed: ${resp.error_description || resp.error}`);
      return;
    }

    accessToken = resp.access_token;
    gapi.client.setToken({ access_token: accessToken });
    
    // Store token with 55-minute expiry window
    const expiryTime = Date.now() + 55 * 60 * 1000;
    localStorage.setItem('drive_sync_token', accessToken);
    localStorage.setItem('drive_sync_token_expiry', expiryTime.toString());

    updateConnectionStatus(true);
    onAuthSuccess();
  };

  tokenClient.requestAccessToken({ prompt: 'consent' });
}

function handleSignout() {
  try {
    if (accessToken) {
      google.accounts.oauth2.revokeToken(accessToken, () => {});
    }
  } catch (err) {
    console.warn('Could not revoke token from Google:', err);
  }

  accessToken = null;
  if (window.gapi && gapi.client) {
    gapi.client.setToken(null);
  }
  
  localStorage.removeItem('drive_sync_token');
  localStorage.removeItem('drive_sync_token_expiry');
  localStorage.removeItem('drive_sync_folder_id');
  localStorage.removeItem('drive_sync_folder_name');
  
  currentFolderId = null;
  currentFolderName = null;
  allFiles = [];
  
  updateConnectionStatus(false);
  updateFolderDisplay();
  showState('connect-prompt');
}

function onAuthSuccess() {
  updateFolderDisplay();
  if (currentFolderId) {
    loadFolderContents(currentFolderId, currentFolderName);
  } else {
    showState('folder-prompt');
  }
}

// 3. UI Status Controllers
function updateConnectionStatus(isConnected) {
  const dot = connectionStatus.querySelector('.status-dot');
  dot.className = 'status-dot';
  if (isConnected) {
    dot.classList.add('connected');
    statusText.textContent = 'Connected';
  } else {
    dot.classList.add('disconnected');
    statusText.textContent = 'Disconnected';
  }
}

function setLoadingStatus(msg) {
  const dot = connectionStatus.querySelector('.status-dot');
  dot.className = 'status-dot loading';
  statusText.textContent = msg;
}

function updateFolderDisplay() {
  if (currentFolderId && currentFolderName) {
    selectedFolderName.textContent = currentFolderName;
  } else {
    selectedFolderName.textContent = '-';
  }
}

// State display swapper
const states = ['credentials-missing', 'connect-prompt', 'folder-prompt', 'loading'];
function showState(activeState) {
  states.forEach(state => {
    const el = document.getElementById(`state-${state}`);
    if (el) {
      if (state === activeState) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }
  });

  const dashboard = document.getElementById('dashboard-view');
  if (activeState === 'dashboard') {
    dashboard.classList.remove('hidden');
    // Initialize map on dashboard load and invalidate size so it recalculates container bounds
    setTimeout(() => {
      initMap();
      if (map) {
        map.invalidateSize();
      }
    }, 50);
  } else {
    dashboard.classList.add('hidden');
  }
}

function showError(msg) {
  showState('credentials-missing');
  const el = document.getElementById('state-credentials-missing');
  el.querySelector('.error-text').textContent = msg;
}

// 4. Google Picker Integration
function openPicker() {
  if (!accessToken || !gapiApiLoaded) return;

  const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
    .setMimeTypes('application/vnd.google-apps.folder')
    .setSelectFolderEnabled(true);

  const picker = new google.picker.PickerBuilder()
    .addView(view)
    .setOAuthToken(accessToken)
    .setDeveloperKey(DRIVE_APP_CONFIG.API_KEY)
    .setCallback(pickerCallback)
    .setTitle('Select Folder')
    .build();

  picker.setVisible(true);
}

function pickerCallback(data) {
  if (data.action === google.picker.Action.PICKED) {
    const doc = data.docs[0];
    currentFolderId = doc.id;
    currentFolderName = doc.name;

    localStorage.setItem('drive_sync_folder_id', currentFolderId);
    localStorage.setItem('drive_sync_folder_name', currentFolderName);

    updateFolderDisplay();
    loadFolderContents(currentFolderId, currentFolderName);
  }
}

// 5. Fetch Files
async function loadFolderContents(folderId, folderName) {
  showState('loading');
  try {
    const response = await gapi.client.drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink, webContentLink)',
      orderBy: 'folder,name',
      pageSize: 100
    });

    allFiles = response.result.files || [];
    renderFiles(allFiles);
  } catch (error) {
    console.error('Error fetching files:', error);
    if (error.status === 401) {
      updateConnectionStatus(false);
      showState('connect-prompt');
    } else {
      showError(`Failed to fetch files: ${error.result?.error?.message || error.message}`);
    }
  }
}

// 6. Render List
function renderFiles(files) {
  filesList.innerHTML = '';
  showState('dashboard');

  // Clear previous paths on map refresh
  if (pathGroup) {
    pathGroup.clearLayers();
  }
  colorIndex = 0;

  if (files.length === 0) {
    filesList.innerHTML = `<li class="file-item" style="color: var(--text-muted);">Folder is empty</li>`;
    return;
  }

  files.forEach(file => {
    const li = document.createElement('li');
    li.className = 'file-item';

    const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
    const isFitFile = file.name.toLowerCase().endsWith('.fit');
    
    let displaySize = isFolder ? 'Folder' : formatBytes(file.size);
    let fitMetaHtml = '';
    
    if (isFitFile) {
      fitMetaHtml = `<span class="divider">|</span><span id="fit-dist-${file.id}" style="color: var(--text-muted);">Loading distance...</span>`;
    }

    li.innerHTML = `
      <a href="${file.webViewLink}" target="_blank" class="file-name-link">${escapeHtml(file.name)}</a>
      <div class="file-meta">
        <span class="file-size">${displaySize}</span>
        ${fitMetaHtml}
      </div>
    `;
    filesList.appendChild(li);

    // Asynchronously fetch and parse FIT distance
    if (isFitFile) {
      loadAndDisplayFitDistance(file.id);
    }
  });
}

// 7. Download and Parse FIT Data
async function loadAndDisplayFitDistance(fileId) {
  const displayEl = document.getElementById(`fit-dist-${fileId}`);
  if (!displayEl) return;

  try {
    const arrayBuffer = await downloadFileContent(fileId);
    
    // Parse FIT Data for distance and coordinate paths
    const parsedData = await parseFitData(arrayBuffer);
    
    if (parsedData) {
      // 1. Display distance
      if (parsedData.distanceMeters !== null && parsedData.distanceMeters !== undefined) {
        const distanceKm = (parsedData.distanceMeters / 1000).toFixed(2);
        displayEl.textContent = `${distanceKm} km`;
        displayEl.style.color = 'var(--text-color)'; // Make white when loaded
      } else {
        displayEl.textContent = '-';
      }

      // 2. Draw path on Leaflet Map
      if (parsedData.coordinates && parsedData.coordinates.length > 1 && map && pathGroup) {
        const pathColor = neonColors[colorIndex % neonColors.length];
        colorIndex++;

        const polyline = L.polyline(parsedData.coordinates, {
          color: pathColor,
          weight: 3.5,
          opacity: 0.85
        }).addTo(pathGroup);

        // Add a clean tool-tip showing the distance
        if (parsedData.distanceMeters) {
          const distanceKm = (parsedData.distanceMeters / 1000).toFixed(2);
          polyline.bindTooltip(`${distanceKm} km`, { sticky: true });
        }

        // Adjust map camera bounds to fit all coordinate paths
        map.fitBounds(pathGroup.getBounds(), { padding: [40, 40] });
      }
    } else {
      displayEl.textContent = '-';
    }
  } catch (error) {
    console.error(`Failed to parse FIT file for ${fileId}:`, error);
    displayEl.textContent = 'Error parsing';
    displayEl.style.color = '#ff3366';
  }
}

async function downloadFileContent(fileId) {
  const token = gapi.client.getToken().access_token;
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to download binary file (Status ${response.status})`);
  }
  
  return await response.arrayBuffer();
}

function parseFitData(arrayBuffer) {
  return new Promise((resolve) => {
    const fitParser = new FitParser({
      force: true,
      speedUnit: 'km/h',
      lengthUnit: 'm',
    });
    
    fitParser.parse(arrayBuffer, (error, data) => {
      if (error || !data) {
        console.error('FIT parse error:', error);
        resolve(null);
      } else {
        // Extract distance
        let distanceMeters = null;
        if (data.sessions && data.sessions.length > 0) {
          distanceMeters = data.sessions[0].total_distance;
        } else if (data.records && data.records.length > 0) {
          for (let i = data.records.length - 1; i >= 0; i--) {
            if (data.records[i].distance !== undefined) {
              distanceMeters = data.records[i].distance;
              break;
            }
          }
        }

        // Extract GPS coordinate path
        const coordinates = [];
        if (data.records) {
          data.records.forEach(rec => {
            const coords = getRecordCoordinates(rec);
            if (coords) {
              coordinates.push(coords);
            }
          });
        }

        resolve({ distanceMeters, coordinates });
      }
    });
  });
}

function getRecordCoordinates(record) {
  let lat = record.position_lat;
  let lng = record.position_long;
  
  if (lat === undefined || lng === undefined) return null;
  
  // Convert Garmin semicircles to standard decimal degrees if needed
  if (Number.isInteger(lat) && Math.abs(lat) > 180) {
    lat = lat * (180 / 2147483648);
  }
  if (Number.isInteger(lng) && Math.abs(lng) > 180) {
    lng = lng * (180 / 2147483648);
  }
  
  // Verify valid bounds
  if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
    return [lat, lng];
  }
  return null;
}

function initMap() {
  if (map) return; // Map already loaded

  // Create Leaflet map container
  map = L.map('map').setView([47.0, 11.0], 7); // Default zoom center (European Alps / generic)

  // Load a sleek, premium dark theme from CartoDB mapping tiles
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);

  // Group to contain all polyline layers for bounding box zoom calculations
  pathGroup = L.featureGroup().addTo(map);
}

// 8. Helper Utilities
function formatBytes(bytes, decimals = 1) {
  if (bytes === undefined || bytes === null || bytes === '-') return '-';
  const numBytes = parseInt(bytes);
  if (isNaN(numBytes)) return '-';
  if (numBytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(numBytes) / Math.log(k));
  
  return parseFloat((numBytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
