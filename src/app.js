import { escapeHtml, formatDistance, formatMonth, parseSearchQuery, matchesFuzzy } from './utils/helpers.js';
import {
  isConfigValid,
  loadGoogleApis,
  checkInitialization,
  handleAuth,
  handleSignout,
  loadAllActivities,
  getAccessToken,
  isSdkLoaded
} from './services/google.js';
import { downloadFileContent, parseFitData } from './services/fit.js';
import { initMap, clearPaths, drawRoute, invalidateMapSize } from './services/map.js';

// State Variables
let allActivities = [];       // Enriched activity objects (Drive metadata + parsed FIT data)
let filteredActivities = [];   // Currently displayed subset after filtering
let activeFilter = { date: null, text: null };  // Parsed filter state
let currentFolderId = localStorage.getItem('drive_sync_folder_id') || null;
let currentFolderName = localStorage.getItem('drive_sync_folder_name') || null;

// DOM Elements
const btnAuth = document.getElementById('btn-auth');
const btnSignout = document.getElementById('btn-signout');
const btnPicker = document.getElementById('btn-picker');
const btnChangeFolder = document.getElementById('btn-change-folder');
const selectedFolderName = document.getElementById('selected-folder-name');
const filesList = document.getElementById('files-list');
const searchInput = document.getElementById('search-input');
const btnThisYear = document.getElementById('btn-this-year');
const btnThisMonth = document.getElementById('btn-this-month');
const filterStatusEl = document.getElementById('filter-status');
const kmAggregateEl = document.getElementById('km-aggregate');

// Debounce timer for search input
let searchDebounceTimer = null;

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

  // Search input with debounce
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        onSearchChanged(searchInput.value);
      }, 200);
    });
  }

  // Shortcut buttons
  if (btnThisYear) btnThisYear.addEventListener('click', onThisYearClick);
  if (btnThisMonth) btnThisMonth.addEventListener('click', onThisMonthClick);
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
  allActivities = [];
  filteredActivities = [];
  activeFilter = { date: null, text: null };
  if (searchInput) searchInput.value = '';
  
  updateConnectionStatus(false);
  updateFolderDisplay();
  showState('connect-prompt');
}

function onAuthSuccess() {
  updateFolderDisplay();
  if (currentFolderId) {
    fetchAndDisplayActivities(currentFolderId);
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
    fetchAndDisplayActivities(currentFolderId);
  }
}

// 5. Fetch, Parse, and Build Activity Model
async function fetchAndDisplayActivities(folderId) {
  showState('dashboard');

  // Show loading state in sidebar
  filesList.innerHTML = `
    <li class="sidebar-loading">
      <div class="spinner"></div>
      Parsing activities...
    </li>
  `;
  clearPaths();
  updateFilterStatus();
  updateAggregate();

  try {
    // Recursively collect all supported activity files
    const files = await loadAllActivities(folderId);

    if (files.length === 0) {
      allActivities = [];
      filteredActivities = [];
      renderActivities();
      return;
    }

    // Parse all FIT files in parallel
    const enriched = await Promise.all(files.map(async (file) => {
      try {
        const arrayBuffer = await downloadFileContent(file.id);
        const parsed = await parseFitData(arrayBuffer);

        if (!parsed) {
          return buildActivity(file, null);
        }
        return buildActivity(file, parsed);
      } catch (error) {
        console.error(`Failed to parse ${file.name}:`, error);
        return buildActivity(file, null);
      }
    }));

    // Sort by date descending (newest first)
    enriched.sort((a, b) => {
      if (!a.displayDate && !b.displayDate) return 0;
      if (!a.displayDate) return 1;
      if (!b.displayDate) return -1;
      return b.displayDate.getTime() - a.displayDate.getTime();
    });

    allActivities = enriched;

    // Reset filter on new folder load
    activeFilter = { date: null, text: null };
    if (searchInput) searchInput.value = '';
    updateShortcutButtons();

    // Apply filters and render
    applyFiltersAndRender();

  } catch (error) {
    console.error('Error fetching activities:', error);
    if (error.status === 401) {
      updateConnectionStatus(false);
      showState('connect-prompt');
    } else {
      showError(`Failed to fetch activities: ${error.result?.error?.message || error.message}`);
    }
  }
}

/**
 * Builds an enriched activity object from Drive file metadata + parsed FIT data.
 */
function buildActivity(file, parsed) {
  const startTime = parsed?.startTime ?? null;
  const modifiedDate = file.modifiedTime ? new Date(file.modifiedTime) : null;
  const displayDate = startTime || modifiedDate;

  // Compute date keys for filtering and grouping
  let dateString = null;
  let monthKey = null;
  let yearKey = null;

  if (displayDate && !isNaN(displayDate.getTime())) {
    const y = displayDate.getFullYear();
    const m = String(displayDate.getMonth() + 1).padStart(2, '0');
    const d = String(displayDate.getDate()).padStart(2, '0');
    dateString = `${y}-${m}-${d}`;
    monthKey = `${y}-${m}`;
    yearKey = `${y}`;
  }

  return {
    // Drive metadata
    id: file.id,
    name: file.name,
    size: file.size,
    webViewLink: file.webViewLink,
    webContentLink: file.webContentLink,
    // Parsed FIT data
    distanceMeters: parsed?.distanceMeters ?? null,
    coordinates: parsed?.coordinates ?? [],
    startTime,
    sport: parsed?.sport ?? null,
    // Computed
    displayDate,
    dateString,
    monthKey,
    yearKey,
  };
}

// 6. Filtering Logic

/**
 * Handles search input changes — parses query and applies filters.
 */
function onSearchChanged(value) {
  activeFilter = parseSearchQuery(value);
  updateShortcutButtons();
  applyFiltersAndRender();
}

/**
 * "This Year" shortcut — toggles date filter for current year.
 */
function onThisYearClick() {
  const now = new Date();
  const yearStr = `${now.getFullYear()}`;

  if (activeFilter.date === yearStr && !activeFilter.text) {
    // Toggle off
    if (searchInput) searchInput.value = '';
    activeFilter = { date: null, text: null };
  } else {
    // Set year filter
    if (searchInput) searchInput.value = yearStr;
    activeFilter = { date: yearStr, text: null };
  }
  updateShortcutButtons();
  applyFiltersAndRender();
}

/**
 * "This Month" shortcut — toggles date filter for current month.
 */
function onThisMonthClick() {
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  if (activeFilter.date === monthStr && !activeFilter.text) {
    // Toggle off
    if (searchInput) searchInput.value = '';
    activeFilter = { date: null, text: null };
  } else {
    // Set month filter
    if (searchInput) searchInput.value = monthStr;
    activeFilter = { date: monthStr, text: null };
  }
  updateShortcutButtons();
  applyFiltersAndRender();
}

/**
 * Updates the active state of shortcut buttons based on current filter.
 */
function updateShortcutButtons() {
  const now = new Date();
  const yearStr = `${now.getFullYear()}`;
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  if (btnThisYear) {
    btnThisYear.classList.toggle('active', activeFilter.date === yearStr && !activeFilter.text);
  }
  if (btnThisMonth) {
    btnThisMonth.classList.toggle('active', activeFilter.date === monthStr && !activeFilter.text);
  }
}

/**
 * Applies active filters to allActivities and triggers rendering.
 */
function applyFiltersAndRender() {
  filteredActivities = allActivities.filter(activity => {
    // Date filter
    if (activeFilter.date) {
      if (activeFilter.date.length === 10) {
        // Full date filter: "2026-07-12"
        if (activity.dateString !== activeFilter.date) return false;
      } else if (activeFilter.date.length === 7) {
        // Month filter: "2026-07"
        if (activity.monthKey !== activeFilter.date) return false;
      } else if (activeFilter.date.length === 4) {
        // Year filter: "2026"
        if (activity.yearKey !== activeFilter.date) return false;
      }
    }

    // Text filter (fuzzy match on filename)
    if (activeFilter.text) {
      if (!matchesFuzzy(activeFilter.text, activity.name)) return false;
    }

    return true;
  });

  renderActivities();
  updateFilterStatus();
  updateAggregate();
  renderMapRoutes();
}

// 7. Rendering

/**
 * Renders the filtered activities list grouped by month with separators.
 */
function renderActivities() {
  filesList.innerHTML = '';

  if (filteredActivities.length === 0) {
    if (allActivities.length === 0) {
      filesList.innerHTML = `<li class="sidebar-empty">No activities found</li>`;
    } else {
      filesList.innerHTML = `<li class="sidebar-empty">No matching activities</li>`;
    }
    return;
  }

  // Group activities by monthKey
  let currentMonth = null;

  filteredActivities.forEach(activity => {
    const month = activity.monthKey || 'unknown';

    // Insert month separator when month changes
    if (month !== currentMonth) {
      currentMonth = month;
      const separator = document.createElement('li');
      separator.className = 'month-separator';
      separator.textContent = activity.displayDate
        ? formatMonth(activity.displayDate)
        : 'Unknown Date';
      filesList.appendChild(separator);
    }

    // Render activity item
    const li = document.createElement('li');
    li.className = 'file-item';

    const distText = formatDistance(activity.distanceMeters);

    li.innerHTML = `
      <a href="${activity.webViewLink}" target="_blank" class="file-name-link">${escapeHtml(activity.name)}</a>
      <div class="file-meta">
        <span class="file-size">${distText}</span>
      </div>
    `;
    filesList.appendChild(li);
  });
}

/**
 * Updates the filter status confirmation line.
 */
function updateFilterStatus() {
  if (!filterStatusEl) return;

  const parts = [];
  if (activeFilter.date) {
    parts.push(`date=${activeFilter.date}`);
  }
  if (activeFilter.text) {
    parts.push(`name≈${activeFilter.text}`);
  }

  if (parts.length > 0) {
    filterStatusEl.textContent = parts.join(' · ');
  } else {
    filterStatusEl.textContent = `${allActivities.length} activities`;
  }
}

/**
 * Updates the km aggregate display for filtered activities.
 */
function updateAggregate() {
  if (!kmAggregateEl) return;

  const totalMeters = filteredActivities.reduce((sum, a) => {
    return sum + (a.distanceMeters || 0);
  }, 0);

  if (totalMeters > 0) {
    kmAggregateEl.textContent = formatDistance(totalMeters);
  } else {
    kmAggregateEl.textContent = '';
  }
}

/**
 * Draws routes on the map for all filtered activities.
 */
function renderMapRoutes() {
  clearPaths();
  filteredActivities.forEach(activity => {
    if (activity.coordinates && activity.coordinates.length > 1) {
      drawRoute(activity.coordinates, activity.distanceMeters);
    }
  });
}
