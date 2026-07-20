/**
 * Service for Google API Client (GAPI) and Google Identity Services (GIS)
 *
 * Uses the drive.appdata scope to access only the app's private folder.
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
  // Load GAPI (API Client) — no Picker needed
  await loadScript('https://apis.google.com/js/api.js');
  await new Promise((resolve) => gapi.load('client', resolve));

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
    scope: 'https://www.googleapis.com/auth/drive.appdata',
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
}

/**
 * Lists all files in the app's private Drive appDataFolder.
 * @returns {Promise<Array>} List of file objects.
 */
export async function listAppDataFiles() {
  if (!gapiApiLoaded) throw new Error('Google Drive SDK not loaded.');

  const response = await gapi.client.drive.files.list({
    spaces: 'appDataFolder',
    fields: 'files(id, name, size, modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: 200
  });

  return response.result.files || [];
}

/**
 * Uploads a binary file to the app's private Drive appDataFolder.
 * @param {string} name - Filename.
 * @param {ArrayBuffer} arrayBuffer - Raw binary data.
 * @returns {Promise<object>} The created file metadata from Drive.
 */
export async function uploadFileToAppData(name, arrayBuffer) {
  const metadata = { name, parents: ['appDataFolder'] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([arrayBuffer]));

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}` }, body: form }
  );

  if (!response.ok) throw new Error(`Upload failed (${response.status})`);
  return await response.json();
}

/**
 * Deletes a file from appDataFolder by its Drive file ID.
 * @param {string} fileId - The unique Google Drive file ID.
 */
export async function deleteAppDataFile(fileId) {
  await gapi.client.drive.files.delete({ fileId });
}
