import { formatBytes, escapeHtml } from './utils/helpers.js';
import {
  isConfigValid,
  loadGoogleApis,
  checkInitialization,
  handleAuth,
  handleSignout,
  loadFolderContents,
  getAccessToken,
  isSdkLoaded
} from './services/google.js';
import { downloadFileContent, parseFitData } from './services/fit.js';
import { initMap, clearPaths, drawRoute, invalidateMapSize } from './services/map.js';

// State Variables
let allFiles = [];
let currentFolderId = localStorage.getItem('drive_sync_folder_id') || null;
let currentFolderName = localStorage.getItem('drive_sync_folder_name') || null;

// DOM Elements
const btnAuth = document.getElementById('btn-auth');
const btnSignout = document.getElementById('btn-signout');
const btnPicker = document.getElementById('btn-picker');
const btnChangeFolder = document.getElementById('btn-change-folder');
const selectedFolderName = document.getElementById('selected-folder-name');
const filesList = document.getElementById('files-list');

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkConfigAndInit();
});

// Event Bindings
function setupEventListeners() {
  if (btnAuth) btnAuth.addEventListener('click', executeAuthFlow);
  if (btnSignout) btnSignout.addEventListener('click', executeSignoutFlow);
  if (btnPicker) btnPicker.addEventListener('click', openPicker);
  if (btnChangeFolder) btnChangeFolder.addEventListener('click', openPicker);
}

// 1. Check Config and Trigger SDK Loads
function checkConfigAndInit() {
  if (!isConfigValid()) {
    showState('credentials-missing');
    return;
  }
  
  showState('loading');
  
  loadGoogleApis(window.DRIVE_APP_CONFIG)
    .then(() => {
      checkInitialAuthState();
    })
    .catch((error) => {
      console.error('Error loading Google APIs:', error);
      showError(`Failed to load Google Drive SDKs: ${error.message || error}`);
    });
}

function checkInitialAuthState() {
  const isAuthorized = checkInitialization();
  updateConnectionStatus(isAuthorized);
  
  if (isAuthorized) {
    onAuthSuccess();
  } else {
    showState('connect-prompt');
  }
}

// 2. Authentication Flow wrappers
function executeAuthFlow() {
  handleAuth({
    onStatus: (msg) => setLoadingStatus(msg),
    onSuccess: () => {
      updateConnectionStatus(true);
      onAuthSuccess();
    },
    onFailure: (error) => {
      updateConnectionStatus(false);
      showState('connect-prompt');
      alert(`Auth failed: ${error.message || error}`);
    }
  });
}

function executeSignoutFlow() {
  handleSignout();
  
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
    fetchAndDisplayContents(currentFolderId, currentFolderName);
  } else {
    showState('folder-prompt');
  }
}

// 3. UI Status Controllers
function updateConnectionStatus(isConnected) {
  const btnAuth = document.getElementById('btn-auth');
  const btnSignout = document.getElementById('btn-signout');
  const topFolderControls = document.getElementById('top-folder-controls');
  
  if (isConnected) {
    if (btnAuth) {
      btnAuth.classList.add('hidden');
      btnAuth.disabled = false;
      btnAuth.textContent = 'Connect Drive';
    }
    if (btnSignout) btnSignout.classList.remove('hidden');
    if (topFolderControls) topFolderControls.classList.remove('hidden');
  } else {
    if (btnAuth) {
      btnAuth.classList.remove('hidden');
      btnAuth.disabled = false;
      btnAuth.textContent = 'Connect Drive';
    }
    if (btnSignout) btnSignout.classList.add('hidden');
    if (topFolderControls) topFolderControls.classList.add('hidden');
  }
}

function setLoadingStatus(msg) {
  const btnAuth = document.getElementById('btn-auth');
  if (btnAuth) {
    btnAuth.textContent = msg;
    btnAuth.disabled = true;
  }
}

function updateFolderDisplay() {
  const topFolderInfo = document.getElementById('top-folder-info');
  const btnPicker = document.getElementById('btn-picker');
  
  if (currentFolderId && currentFolderName) {
    selectedFolderName.textContent = currentFolderName;
    if (topFolderInfo) topFolderInfo.classList.remove('hidden');
    if (btnPicker) btnPicker.classList.add('hidden');
  } else {
    selectedFolderName.textContent = '-';
    if (topFolderInfo) topFolderInfo.classList.add('hidden');
    if (btnPicker) btnPicker.classList.remove('hidden');
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
      invalidateMapSize();
    }, 50);
  } else {
    dashboard.classList.add('hidden');
  }
}

function showError(msg) {
  showState('credentials-missing');
  const el = document.getElementById('state-credentials-missing');
  if (el) {
    el.querySelector('.error-text').textContent = msg;
  }
}

// 4. Google Picker Integration
function openPicker() {
  const token = getAccessToken();
  if (!token || !isSdkLoaded()) return;

  const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
    .setMimeTypes('application/vnd.google-apps.folder')
    .setSelectFolderEnabled(true);

  const picker = new google.picker.PickerBuilder()
    .addView(view)
    .setOAuthToken(token)
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
    fetchAndDisplayContents(currentFolderId, currentFolderName);
  }
}

// 5. Fetch and Render Files
async function fetchAndDisplayContents(folderId, folderName) {
  showState('loading');
  try {
    allFiles = await loadFolderContents(folderId);
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

function renderFiles(files) {
  filesList.innerHTML = '';
  showState('dashboard');

  // Clear previous paths on map refresh
  clearPaths();

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

// 6. Download and Parse FIT Data
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
      if (parsedData.coordinates && parsedData.coordinates.length > 1) {
        drawRoute(parsedData.coordinates, parsedData.distanceMeters);
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
