/**
 * Service for Google API Client (GAPI) and Google Identity Services (GIS)
 */

let gapiApiLoaded = false;
let gisLoaded = false;
let tokenClient = null;
let accessToken = null;

/**
 * Checks if the global Google configuration is present and valid.
 * @returns {boolean} True if config is valid.
 */
export function isConfigValid() {
  return (
    window.DRIVE_APP_CONFIG &&
    DRIVE_APP_CONFIG.API_KEY &&
    DRIVE_APP_CONFIG.CLIENT_ID &&
    DRIVE_APP_CONFIG.API_KEY !== "YOUR_GOOGLE_API_KEY" &&
    DRIVE_APP_CONFIG.CLIENT_ID !== "YOUR_GOOGLE_OAUTH_CLIENT_ID"
  );
}

/**
 * Gets the active OAuth2 access token.
 * @returns {string|null} The token string, if authenticated.
 */
export function getAccessToken() {
  return accessToken;
}

/**
 * Returns true if both GAPI and GIS SDKs are loaded and ready.
 * @returns {boolean}
 */
export function isSdkLoaded() {
  return gapiApiLoaded && gisLoaded;
}

/**
 * Helper to dynamically load external JavaScript files.
 */
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

/**
 * Dynamically loads and initializes the Google GAPI and GIS SDKs.
 * @param {object} config - Application configuration (DRIVE_APP_CONFIG).
 * @returns {Promise<void>}
 */
export async function loadGoogleApis(config) {
  // Load GAPI (API Client)
  await loadScript('https://apis.google.com/js/api.js');
  await new Promise((resolve) => gapi.load('client:picker', resolve));

  // Initialize GAPI
  await gapi.client.init({
    apiKey: config.API_KEY,
    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
  });
  gapiApiLoaded = true;

  // Load GIS (Identity Services)
  await loadScript('https://accounts.google.com/gsi/client');
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: config.CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: '', // Defined dynamically during handleAuth
  });
  gisLoaded = true;
}

/**
 * Validates saved local storage token and configures GAPI client if valid.
 * @returns {boolean} True if successfully restored session.
 */
export function checkInitialization() {
  if (!isSdkLoaded()) return false;

  const savedToken = localStorage.getItem('drive_sync_token');
  const tokenExpiry = localStorage.getItem('drive_sync_token_expiry');
  const now = Date.now();

  if (savedToken && tokenExpiry && parseInt(tokenExpiry) > now) {
    accessToken = savedToken;
    gapi.client.setToken({ access_token: accessToken });
    return true;
  }
  return false;
}

/**
 * Starts the interactive Google OAuth2 login flow.
 * @param {object} options - Callbacks.
 * @param {function} options.onSuccess - Called when auth succeeds.
 * @param {function} options.onFailure - Called when auth fails or cancels.
 * @param {function} options.onStatus - Called to report progress messages.
 */
export function handleAuth({ onSuccess, onFailure, onStatus }) {
  if (!tokenClient) return;

  onStatus('Connecting...');

  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) {
      console.error('Auth Error:', resp);
      onFailure(new Error(resp.error_description || resp.error));
      return;
    }

    accessToken = resp.access_token;
    gapi.client.setToken({ access_token: accessToken });
    
    // Store token with 55-minute expiry window
    const expiryTime = Date.now() + 55 * 60 * 1000;
    localStorage.setItem('drive_sync_token', accessToken);
    localStorage.setItem('drive_sync_token_expiry', expiryTime.toString());

    onSuccess();
  };

  tokenClient.requestAccessToken({ prompt: 'consent' });
}

/**
 * Logs out the user by revoking the token, clearing localStorage, and resetting variables.
 */
export function handleSignout() {
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
}

/**
 * Queries files inside a specific Google Drive folder.
 * @param {string} folderId - The unique Google Drive folder ID.
 * @returns {Promise<Array>} List of file objects.
 */
export async function loadFolderContents(folderId) {
  if (!gapiApiLoaded) throw new Error('Google Drive SDK not loaded.');

  const response = await gapi.client.drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink, webContentLink)',
    orderBy: 'folder,name',
    pageSize: 100
  });

  return response.result.files || [];
}

/**
 * Checks if a file is a supported activity format.
 * @param {object} file - Google Drive file object.
 * @returns {boolean} True if the file is a supported activity type.
 */
export function isSupportedActivity(file) {
  const name = file.name.toLowerCase();
  return name.endsWith('.fit');
  // Easy to extend: || name.endsWith('.gpx') || name.endsWith('.tcx')
}

/**
 * Recursively walks a Google Drive folder and collects all supported activity files.
 * Subfolders are traversed, non-activity files are ignored.
 * @param {string} folderId - The root folder ID to walk.
 * @returns {Promise<Array>} Flat list of supported activity file objects from all levels.
 */
export async function loadAllActivities(folderId) {
  const files = await loadFolderContents(folderId);
  const activities = [];

  for (const file of files) {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      const nested = await loadAllActivities(file.id);
      activities.push(...nested);
    } else if (isSupportedActivity(file)) {
      activities.push(file);
    }
  }

  return activities;
}
