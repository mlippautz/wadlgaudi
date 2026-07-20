import { escapeHtml, formatDistance, formatMonth, formatBytes, parseSearchQuery, matchesFuzzy, cleanActivityName } from './utils/helpers.js';
import {
  isConfigValid,
  loadGoogleApis,
  checkInitialization,
  handleAuth,
  handleSignout,
  getAccessToken,
  isSdkLoaded,
  listAppDataFiles,
  uploadFileToAppData,
  deleteAppDataFile,
} from './services/google.js';
import { downloadFileContent, parseFitData } from './services/fit.js';
import { initMap, clearPaths, drawRoute, invalidateMapSize, fitMapToRoutes } from './services/map.js';
import {
  storeFile,
  getFile,
  removeFile,
  getAllFiles,
  getUnsyncedFiles,
  markSynced,
  getTotalStorageBytes,
  storeActivity,
  getAllActivities,
  removeActivity,
} from './services/storage.js';

// State Variables
let allActivities = [];       // Enriched activity objects (parsed FIT data)
let filteredActivities = [];   // Currently displayed subset after filtering
let activeFilter = { id: null, date: null, text: null, sport: null };  // Parsed filter state
let selectedActivityId = null; // Currently selected unique activity name (filename)

// DOM Elements
const btnAuth = document.getElementById('btn-auth');
const btnSignout = document.getElementById('btn-signout');
const btnAddFiles = document.getElementById('btn-add-files');
const fileUploadInput = document.getElementById('file-upload');
const filesList = document.getElementById('files-list');
const searchInput = document.getElementById('search-input');
const btnClearSearch = document.getElementById('btn-clear-search');
const btnThisYear = document.getElementById('btn-this-year');
const btnThisMonth = document.getElementById('btn-this-month');
const btnClear = document.getElementById('btn-clear');
const btnSportAll = document.getElementById('btn-sport-all');
const btnSportRunning = document.getElementById('btn-sport-running');
const btnSportCycling = document.getElementById('btn-sport-cycling');
const btnSportSkiing = document.getElementById('btn-sport-skiing');
const filterStatusEl = document.getElementById('filter-status');
const kmAggregateEl = document.getElementById('km-aggregate');
const storageUsedEl = document.getElementById('storage-used');

// Debounce timer for search input
let searchDebounceTimer = null;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  initFromCache();
});

// Event Bindings
function setupEventListeners() {
  if (btnAuth) btnAuth.addEventListener('click', executeAuthFlow);
  if (btnSignout) btnSignout.addEventListener('click', executeSignoutFlow);

  // File upload
  if (btnAddFiles) btnAddFiles.addEventListener('click', () => fileUploadInput?.click());
  if (fileUploadInput) fileUploadInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFilesAdded(e.target.files);
      e.target.value = ''; // Reset so same file can be re-selected
    }
  });

  // Drag-and-drop on the main area
  const appMain = document.querySelector('.app-main');
  if (appMain) {
    appMain.addEventListener('dragover', (e) => {
      e.preventDefault();
      appMain.classList.add('drag-over');
    });
    appMain.addEventListener('dragleave', (e) => {
      e.preventDefault();
      appMain.classList.remove('drag-over');
    });
    appMain.addEventListener('drop', (e) => {
      e.preventDefault();
      appMain.classList.remove('drag-over');
      if (e.dataTransfer.files.length > 0) {
        handleFilesAdded(e.dataTransfer.files);
      }
    });
  }

  // Search input with debounce
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        onSearchChanged(searchInput.value);
      }, 200);
    });
  }

  // Clear search icon/button inside search input
  if (btnClearSearch) {
    btnClearSearch.addEventListener('click', clearSearch);
  }

  // Shortcut buttons
  if (btnThisYear) btnThisYear.addEventListener('click', onThisYearClick);
  if (btnThisMonth) btnThisMonth.addEventListener('click', onThisMonthClick);
  if (btnClear) btnClear.addEventListener('click', clearSearch);

  // Sport buttons
  if (btnSportAll) btnSportAll.addEventListener('click', () => setSportFilter(null));
  if (btnSportRunning) btnSportRunning.addEventListener('click', () => setSportFilter('running'));
  if (btnSportCycling) btnSportCycling.addEventListener('click', () => setSportFilter('cycling'));
  if (btnSportSkiing) btnSportSkiing.addEventListener('click', () => setSportFilter('skiing'));

  // Clear selection/search on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      clearSearch();
    }
  });

  // Floating view toggle on mobile
  const btnViewToggle = document.getElementById('btn-view-toggle');
  if (btnViewToggle) {
    btnViewToggle.addEventListener('click', () => {
      const dashboard = document.getElementById('dashboard-view');
      if (dashboard) {
        const isMapShown = dashboard.classList.toggle('show-map');
        const toggleText = document.getElementById('toggle-text');
        if (toggleText) {
          toggleText.textContent = isMapShown ? 'Show List' : 'Show Map';
        }
      }
    });
  }
}

function clearSearch() {
  selectedActivityId = null;
  if (searchInput) {
    searchInput.value = '';
  }
  onSearchChanged('');
}

function setSportFilter(sport) {
  selectedActivityId = null; // Clear individual selection
  if (searchInput) {
    const currentQuery = searchInput.value;
    const newQuery = updateSearchQueryWithSport(currentQuery, sport);
    searchInput.value = newQuery;
    onSearchChanged(newQuery);
  }
}

/**
 * Updates a search query string to add, replace, or toggle a sport filter parameter.
 * @param {string} query - The current search query.
 * @param {string|null} targetSport - The sport to set (running, cycling, skiing, or null to clear).
 * @returns {string} The updated search query.
 */
function updateSearchQueryWithSport(query, targetSport) {
  const sportRegex = /\bsport[=:]\s*["']?([A-Za-z0-9_-]+)["']?/i;
  const match = query.match(sportRegex);

  if (targetSport === null) {
    if (match) {
      return query.replace(sportRegex, '').replace(/\s+/g, ' ').trim();
    }
    return query.trim();
  }

  if (match) {
    // If the active sport matches, toggle it off by removing it
    if (match[1].toLowerCase() === targetSport.toLowerCase()) {
      return query.replace(sportRegex, '').replace(/\s+/g, ' ').trim();
    }
    // Otherwise, replace it with the new sport
    return query.replace(sportRegex, `sport=${targetSport}`).trim();
  }

  // Append new sport filter
  return query.trim() ? `${query.trim()} sport=${targetSport}` : `sport=${targetSport}`;
}

/**
 * Updates a search query string to add, replace, or toggle a date filter parameter.
 * @param {string} query - The current search query.
 * @param {string|null} targetDate - The date string to set (YYYY, YYYY-MM, or null to clear).
 * @returns {string} The updated search query.
 */
function updateSearchQueryWithDate(query, targetDate) {
  const dateRegex = /\b(\d{4}(?:-\d{2}(?:-\d{2})?)?)\b/;
  const match = query.match(dateRegex);

  if (targetDate === null) {
    if (match) {
      return query.replace(dateRegex, '').replace(/\s+/g, ' ').trim();
    }
    return query.trim();
  }

  if (match) {
    // If the active date matches, toggle it off by removing it
    if (match[1] === targetDate) {
      return query.replace(dateRegex, '').replace(/\s+/g, ' ').trim();
    }
    // Otherwise, replace it with the new date
    return query.replace(dateRegex, targetDate).trim();
  }

  // Append new date filter
  return query.trim() ? `${query.trim()} ${targetDate}` : targetDate;
}

/**
 * Updates active class styling on sport filter buttons.
 */
function updateSportFilterButtons() {
  const sport = activeFilter.sport;
  if (btnSportAll) btnSportAll.classList.toggle('active', sport === null);
  if (btnSportRunning) btnSportRunning.classList.toggle('active', sport === 'running');
  if (btnSportCycling) btnSportCycling.classList.toggle('active', sport === 'cycling');
  if (btnSportSkiing) btnSportSkiing.classList.toggle('active', sport === 'skiing');
}

/**
 * Calculates the sport with the most activities in the current calendar month.
 * Falls back to the sport with the most activities overall if there are no activities in the current month.
 * @returns {string|null} The default sport string (running, cycling, skiing, or null).
 */
function getDefaultSport() {
  if (allActivities.length === 0) return null;

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Count in current month
  let runningCount = 0;
  let cyclingCount = 0;
  let skiingCount = 0;

  allActivities.forEach(activity => {
    if (activity.monthKey === currentMonthKey) {
      const sport = activity.sport;
      if (sport === 'running') {
        runningCount++;
      } else if (sport === 'cycling' || sport === 'e_biking') {
        cyclingCount++;
      } else if (sport && (sport.toLowerCase().includes('skiing') || sport.toLowerCase().includes('ski'))) {
        skiingCount++;
      }
    }
  });

  // If we have activities in the current month, return the one with the maximum count
  if (runningCount > 0 || cyclingCount > 0 || skiingCount > 0) {
    if (runningCount >= cyclingCount && runningCount >= skiingCount) {
      return 'running';
    } else if (cyclingCount >= runningCount && cyclingCount >= skiingCount) {
      return 'cycling';
    } else {
      return 'skiing';
    }
  }

  // Fallback: Count overall
  let overallRunning = 0;
  let overallCycling = 0;
  let overallSkiing = 0;

  allActivities.forEach(activity => {
    const sport = activity.sport;
    if (sport === 'running') {
      overallRunning++;
    } else if (sport === 'cycling' || sport === 'e_biking') {
      overallCycling++;
    } else if (sport && (sport.toLowerCase().includes('skiing') || sport.toLowerCase().includes('ski'))) {
      overallSkiing++;
    }
  });

  if (overallRunning > 0 || overallCycling > 0 || overallSkiing > 0) {
    if (overallRunning >= overallCycling && overallRunning >= overallSkiing) {
      return 'running';
    } else if (overallCycling >= overallRunning && overallCycling >= overallSkiing) {
      return 'cycling';
    } else {
      return 'skiing';
    }
  }

  return null;
}

// 1. Initialize from IndexedDB cache, then optionally load Google APIs
async function initFromCache() {
  try {
    // Load cached activities from IndexedDB
    const cached = await getAllActivities();
    if (cached.length > 0) {
      // Restore Date objects from serialized strings
      allActivities = cached.map(a => ({
        ...a,
        displayDate: a.startTime ? new Date(a.startTime) : null,
      }));
      sortActivities();
      showState('dashboard');
      const defaultSport = getDefaultSport();
      if (defaultSport && searchInput) {
        searchInput.value = `sport=${defaultSport}`;
      }
      onSearchChanged(searchInput ? searchInput.value : '');
      updateStorageIndicator();
    }
  } catch (err) {
    console.warn('Failed to load from IndexedDB:', err);
  }

  // Try loading Google APIs for sync (non-blocking)
  if (isConfigValid()) {
    try {
      await loadGoogleApis(window.DRIVE_APP_CONFIG);
      const isAuthorized = checkInitialization();
      updateConnectionStatus(isAuthorized);

      if (isAuthorized) {
        // Background sync with Drive
        syncWithDrive().catch(err => console.warn('Background sync failed:', err));
      }
    } catch (error) {
      console.warn('Google APIs not available:', error);
    }
  }

  // If no cached activities and no Google APIs, show empty state
  if (allActivities.length === 0) {
    showState('empty');
  }
}

// 2. Authentication Flow wrappers
function executeAuthFlow() {
  handleAuth({
    onStatus: (msg) => setLoadingStatus(msg),
    onSuccess: () => {
      updateConnectionStatus(true);
      // Trigger background sync
      syncWithDrive().catch(err => console.warn('Sync after auth failed:', err));
    },
    onFailure: (error) => {
      updateConnectionStatus(false);
      alert(`Auth failed: ${error.message || error}`);
    }
  });
}

function executeSignoutFlow() {
  handleSignout();
  updateConnectionStatus(false);
  updateSyncStatus('');
}

// 3. File Handling — Add

/**
 * Handles files added via file input or drag-and-drop.
 * Validates, deduplicates, stores in IndexedDB, parses, and renders.
 * @param {FileList} fileList
 */
async function handleFilesAdded(fileList) {
  const filesArray = Array.from(fileList);
  console.log(`[Import] Starting import for ${filesArray.length} files...`);
  const skipped = [];
  let added = 0;

  for (const file of filesArray) {
    if (!file.name.toLowerCase().endsWith('.fit')) {
      console.log(`[Import] Skipped non-FIT file: ${file.name}`);
      continue;
    }

    // Duplicate check — skip files already in the local store
    if (allActivities.some(a => a.name === file.name)) {
      console.log(`[Import] Skipped duplicate file: ${file.name}`);
      skipped.push(file.name);
      continue;
    }

    try {
      console.log(`[Import] Processing file: ${file.name} (${file.size} bytes)`);

      // Read binary data
      const arrayBuffer = await file.arrayBuffer();
      console.log(`[Import] File read success: ${file.name}`);

      // Store raw file in IndexedDB
      await storeFile(file.name, arrayBuffer);
      console.log(`[Import] Stored raw file in IndexedDB: ${file.name}`);

      // Parse FIT data
      console.log(`[Import] Parsing FIT data for: ${file.name}`);
      const parsed = await parseFitData(arrayBuffer);
      console.log(`[Import] FIT parse complete: ${file.name}`, parsed ? "Success" : "Failed (null)");

      const activity = buildActivity(file.name, parsed);

      // Store parsed metadata in IndexedDB
      await storeActivity(activity);
      allActivities.push(activity);
      console.log(`[Import] Saved metadata to IndexedDB: ${file.name}`);

      added++;
    } catch (err) {
      console.error(`[Import] Error processing file ${file.name}:`, err);
    }
  }

  console.log(`[Import] Finished processing. Added: ${added}, Skipped: ${skipped.length}`);

  if (skipped.length > 0) {
    showNotice(`${skipped.length} duplicate(s) skipped`);
  }

  if (added > 0) {
    sortActivities();
    showState('dashboard');
    if (!activeFilter.sport) {
      const defaultSport = getDefaultSport();
      if (defaultSport && searchInput) {
        searchInput.value = updateSearchQueryWithSport(searchInput.value, defaultSport);
      }
    }
    onSearchChanged(searchInput ? searchInput.value : '');
    updateStorageIndicator();

    // Background sync to Drive (fire-and-forget)
    if (isDriveConnected()) {
      syncUnsyncedToDrive().catch(err => console.warn('Sync failed:', err));
    }
  }
}

// 4. File Handling — Remove

/**
 * Removes an activity from local cache and optionally from Drive.
 * @param {string} originalFileName - The original filename in IndexedDB.
 */
async function handleFileRemoved(originalFileName) {
  // Remove from IndexedDB (both stores)
  await removeFile(originalFileName);
  await removeActivity(originalFileName);

  // Remove from in-memory state
  allActivities = allActivities.filter(a => a.name !== originalFileName);

  // Re-render
  applyFiltersAndRender();
  updateStorageIndicator();

  // Show empty state if no activities left
  if (allActivities.length === 0) {
    showState('empty');
  }

  // Background: delete from Drive if connected
  if (isDriveConnected()) {
    deleteFromDriveByName(originalFileName).catch(err =>
      console.warn('Drive delete failed:', err)
    );
  }
}

// 5. Drive Sync

/**
 * Returns true if Google APIs are loaded and user is authenticated.
 */
function isDriveConnected() {
  return isSdkLoaded() && !!getAccessToken();
}

/**
 * Pushes unsynced local files to Drive's appDataFolder.
 */
async function syncUnsyncedToDrive() {
  console.log('[Sync] Querying unsynced files from IndexedDB...');
  const unsynced = await getUnsyncedFiles();
  console.log(`[Sync] Found ${unsynced.length} unsynced file(s) to upload.`);
  if (unsynced.length === 0) return;

  updateSyncStatus(`Syncing ${unsynced.length} file(s)...`);

  for (const file of unsynced) {
    try {
      console.log(`[Sync] Starting upload for: ${file.name} (${file.data.byteLength} bytes)`);
      const response = await uploadFileToAppData(file.name, file.data);
      console.log(`[Sync] Upload successful for: ${file.name}. Response ID: ${response.id}`);
      await markSynced(file.name);
      console.log(`[Sync] Marked as synced: ${file.name}`);
    } catch (err) {
      console.error(`[Sync] Failed to sync ${file.name}:`, err);
    }
  }

  updateSyncStatus('✓ Synced');
  setTimeout(() => updateSyncStatus(''), 3000);
}

/**
 * Full bidirectional sync with Drive.
 * Push unsynced local files, pull new Drive files, resolve conflicts by modifiedTime.
 */
async function syncWithDrive() {
  updateSyncStatus('Syncing...');

  // Push: upload any local files not yet synced
  const unsynced = await getUnsyncedFiles();
  for (const file of unsynced) {
    try {
      await uploadFileToAppData(file.name, file.data);
      await markSynced(file.name);
    } catch (err) {
      console.warn(`Failed to upload ${file.name}:`, err);
    }
  }

  // Pull: download any Drive files not in local cache
  try {
    const driveFiles = await listAppDataFiles();
    let pulled = 0;

    for (const df of driveFiles) {
      const local = await getFile(df.name);

      if (!local) {
        // New file on Drive — pull it
        const arrayBuffer = await downloadFileContent(df.id);
        await storeFile(df.name, arrayBuffer);
        await markSynced(df.name);
        const parsed = await parseFitData(arrayBuffer);
        const activity = buildActivity(df.name, parsed);
        await storeActivity(activity);
        allActivities.push(activity);
        pulled++;
      } else if (local.addedAt && df.modifiedTime) {
        // Conflict: same name exists locally and on Drive — newer wins
        const driveTime = new Date(df.modifiedTime).getTime();
        if (driveTime > local.addedAt) {
          const arrayBuffer = await downloadFileContent(df.id);
          await storeFile(df.name, arrayBuffer);
          await markSynced(df.name);
          const parsed = await parseFitData(arrayBuffer);
          const activity = buildActivity(df.name, parsed);
          await storeActivity(activity);
          allActivities = allActivities.filter(a => a.name !== activity.name);
          allActivities.push(activity);
          pulled++;
        }
      }
    }

    if (pulled > 0) {
      sortActivities();
      showState('dashboard');
      if (!activeFilter.sport) {
        const defaultSport = getDefaultSport();
        if (defaultSport && searchInput) {
          searchInput.value = updateSearchQueryWithSport(searchInput.value, defaultSport);
        }
      }
      onSearchChanged(searchInput ? searchInput.value : '');
      updateStorageIndicator();
    }
  } catch (err) {
    console.warn('Failed to pull from Drive:', err);
  }

  updateSyncStatus('✓ Synced');
  setTimeout(() => updateSyncStatus(''), 3000);
}

/**
 * Deletes a file from Drive's appDataFolder by name.
 * Finds the file by name first, then deletes by ID.
 */
async function deleteFromDriveByName(fileName) {
  const driveFiles = await listAppDataFiles();
  const match = driveFiles.find(f => f.name === fileName);
  if (match) {
    await deleteAppDataFile(match.id);
  }
}

// 6. UI Status Controllers

function updateConnectionStatus(isConnected) {
  const btnAuth = document.getElementById('btn-auth');
  const btnSignout = document.getElementById('btn-signout');

  if (isConnected) {
    if (btnAuth) {
      btnAuth.classList.add('hidden');
      btnAuth.disabled = false;
      btnAuth.textContent = 'Connect Drive';
    }
    if (btnSignout) btnSignout.classList.remove('hidden');
  } else {
    if (btnAuth) {
      btnAuth.classList.remove('hidden');
      btnAuth.disabled = false;
      btnAuth.textContent = 'Connect Drive';
    }
    if (btnSignout) btnSignout.classList.add('hidden');
  }
}

function setLoadingStatus(msg) {
  const btnAuth = document.getElementById('btn-auth');
  if (btnAuth) {
    btnAuth.textContent = msg;
    btnAuth.disabled = true;
  }
}

function updateSyncStatus(text) {
  const syncEl = document.getElementById('sync-status');
  if (!syncEl) return;
  if (text) {
    syncEl.textContent = text;
    syncEl.classList.remove('hidden');
  } else {
    syncEl.classList.add('hidden');
  }
}

async function updateStorageIndicator() {
  if (!storageUsedEl) return;
  try {
    const bytes = await getTotalStorageBytes();
    storageUsedEl.textContent = bytes > 0 ? formatBytes(bytes) : '';
  } catch (err) {
    storageUsedEl.textContent = '';
  }
}

/**
 * Shows a brief notice message (e.g., duplicates skipped).
 */
function showNotice(msg) {
  // Create a temporary notice element
  const notice = document.createElement('div');
  notice.className = 'notice-toast';
  notice.textContent = msg;
  document.body.appendChild(notice);

  // Trigger animation
  requestAnimationFrame(() => notice.classList.add('show'));

  setTimeout(() => {
    notice.classList.remove('show');
    setTimeout(() => notice.remove(), 300);
  }, 2500);
}

// State display swapper
const states = ['credentials-missing', 'connect-prompt', 'empty', 'loading'];
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
    dashboard.classList.remove('show-map');
    const toggleText = document.getElementById('toggle-text');
    if (toggleText) {
      toggleText.textContent = 'Show Map';
    }
    // Initialize map synchronously on dashboard load
    initMap();
    invalidateMapSize();
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

// 7. Activity Model

/**
 * Builds an enriched activity object from a filename + parsed FIT data.
 */
function buildActivity(fileName, parsed) {
  const displayName = cleanActivityName(fileName);
  const startTime = parsed?.startTime ?? null;
  const displayDate = startTime || null;

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
    // File reference
    name: fileName,
    displayName,
    originalFileName: fileName,
    // Parsed FIT data
    distanceMeters: parsed?.distanceMeters ?? null,
    coordinates: parsed?.coordinates ?? [],
    startTime: startTime ? startTime.toISOString() : null,
    sport: parsed?.sport ?? null,
    // Computed
    displayDate,
    dateString,
    monthKey,
    yearKey,
  };
}

/**
 * Sorts allActivities by date descending (newest first).
 */
function sortActivities() {
  allActivities.sort((a, b) => {
    const da = a.displayDate ? new Date(a.displayDate).getTime() : 0;
    const db = b.displayDate ? new Date(b.displayDate).getTime() : 0;
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return db - da;
  });
}

// 8. Filtering Logic

/**
 * Handles search input changes — parses query and applies filters.
 */
function onSearchChanged(value) {
  selectedActivityId = null;
  activeFilter = parseSearchQuery(value);
  updateShortcutButtons();
  updateSportFilterButtons();
  applyFiltersAndRender();
}

/**
 * Toggles single activity selection. Updates search input text to id:<id>.
 */
function toggleSelectActivity(name) {
  if (selectedActivityId === name) {
    selectedActivityId = null;
  } else {
    selectedActivityId = name;

    // Auto-switch to Map view on mobile when selecting an activity
    const dashboard = document.getElementById('dashboard-view');
    if (window.innerWidth <= 900 && dashboard && !dashboard.classList.contains('show-map')) {
      dashboard.classList.add('show-map');
      const toggleText = document.getElementById('toggle-text');
      if (toggleText) {
        toggleText.textContent = 'Show List';
      }
    }
  }
  applyFiltersAndRender();
}

function onThisYearClick() {
  selectedActivityId = null;
  const now = new Date();
  const yearStr = `${now.getFullYear()}`;

  if (searchInput) {
    const currentQuery = searchInput.value;
    const newQuery = updateSearchQueryWithDate(currentQuery, yearStr);
    searchInput.value = newQuery;
    onSearchChanged(newQuery);
  }
}

/**
 * "This Month" shortcut — toggles date filter for current month.
 */
function onThisMonthClick() {
  selectedActivityId = null;
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  if (searchInput) {
    const currentQuery = searchInput.value;
    const newQuery = updateSearchQueryWithDate(currentQuery, monthStr);
    searchInput.value = newQuery;
    onSearchChanged(newQuery);
  }
}

/**
 * Updates the active state of shortcut buttons based on current filter.
 */
function updateShortcutButtons() {
  const now = new Date();
  const yearStr = `${now.getFullYear()}`;
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  if (btnThisYear) {
    btnThisYear.classList.toggle('active', activeFilter.date === yearStr && !activeFilter.text && !activeFilter.id);
  }
  if (btnThisMonth) {
    btnThisMonth.classList.toggle('active', activeFilter.date === monthStr && !activeFilter.text && !activeFilter.id);
  }

  if (btnClear) {
    const hasFilter = !!(activeFilter.id || activeFilter.date || activeFilter.text || activeFilter.sport);
    if (hasFilter) {
      btnClear.removeAttribute('disabled');
      btnClear.classList.remove('disabled');
    } else {
      btnClear.setAttribute('disabled', 'true');
      btnClear.classList.add('disabled');
    }
  }
}

/**
 * Applies active filters to allActivities and triggers rendering.
 */
function applyFiltersAndRender() {
  filteredActivities = allActivities.filter(activity => {
    // Single activity selection filter
    if (selectedActivityId && activity.name !== selectedActivityId) return false;

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

    // Text filter (fuzzy match on display name or original filename)
    if (activeFilter.text) {
      if (!matchesFuzzy(activeFilter.text, activity.displayName) &&
          !matchesFuzzy(activeFilter.text, activity.name)) return false;
    }

    // Sport filter
    if (activeFilter.sport) {
      if (activeFilter.sport === 'running') {
        if (activity.sport !== 'running') return false;
      } else if (activeFilter.sport === 'cycling') {
        if (activity.sport !== 'cycling' && activity.sport !== 'e_biking') return false;
      } else if (activeFilter.sport === 'skiing') {
        const isSkiing = activity.sport && (activity.sport.toLowerCase().includes('skiing') || activity.sport.toLowerCase().includes('ski'));
        if (!isSkiing) return false;
      }
    }

    return true;
  });

  renderActivities();
  updateFilterStatus();
  updateAggregate();
  renderMapRoutes();
}

// 9. Rendering

/**
 * Renders the filtered activities list grouped by month with separators.
 */
function renderActivities() {
  filesList.innerHTML = '';

  if (filteredActivities.length === 0) {
    if (allActivities.length === 0) {
      filesList.innerHTML = `<li class="sidebar-empty">No activities yet</li>`;
    } else {
      filesList.innerHTML = `<li class="sidebar-empty">No matching activities</li>`;
    }
    return;
  }

  // Manage selection class on parent list
  if (selectedActivityId) {
    filesList.classList.add('has-selection');
  } else {
    filesList.classList.remove('has-selection');
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
        ? formatMonth(new Date(activity.displayDate))
        : 'Unknown Date';
      filesList.appendChild(separator);
    }

    // Render activity item
    const li = document.createElement('li');
    li.className = 'file-item';
    if (selectedActivityId === activity.name) {
      li.classList.add('selected');
    }

    const distText = formatDistance(activity.distanceMeters);

    li.innerHTML = `
      <div class="file-main">
        ${getSportBadge(activity.sport)}
        <span class="file-name-btn" role="button" tabindex="0">${escapeHtml(activity.displayName)}</span>
      </div>
      <div class="file-meta">
        <button class="btn-delete-activity" title="Remove activity" data-name="${escapeHtml(activity.name)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
        <span class="file-size">${distText}</span>
      </div>
    `;

    // Click on name to select/deselect
    li.addEventListener('click', (e) => {
      if (e.target.closest('.btn-delete-activity')) return;
      toggleSelectActivity(activity.name);
    });

    // Click on delete button
    const deleteBtn = li.querySelector('.btn-delete-activity');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleFileRemoved(activity.name);
      });
    }

    filesList.appendChild(li);
  });
}

/**
 * Constructs the HTML badge representing the sport type.
 * @param {string|null} sport - The parsed sport string.
 * @returns {string} HTML markup for the sport badge.
 */
function getSportBadge(sport) {
  if (sport === 'running') {
    return `<span class="sport-badge sport-running" title="Running">🏃 Run</span>`;
  } else if (sport === 'cycling' || sport === 'e_biking') {
    return `<span class="sport-badge sport-cycling" title="Cycling">🚴 Ride</span>`;
  } else if (sport && (sport.toLowerCase().includes('skiing') || sport.toLowerCase().includes('ski'))) {
    return `<span class="sport-badge sport-skiing" title="Skiing">🎿 Ski</span>`;
  }
  return `<span class="sport-badge sport-other" title="Other">🎯 Misc</span>`;
}

/**
 * Updates the filter status confirmation line.
 */
function updateFilterStatus() {
  if (!filterStatusEl) return;

  const parts = [];
  if (selectedActivityId) {
    const selected = allActivities.find(a => a.name === selectedActivityId);
    if (selected) {
      parts.push(`activity="${selected.displayName}"`);
    }
  }
  if (activeFilter.date) {
    parts.push(`date=${activeFilter.date}`);
  }
  if (activeFilter.sport) {
    parts.push(`sport=${activeFilter.sport}`);
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
  fitMapToRoutes();
}
