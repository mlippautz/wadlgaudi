/**
 * Local storage service using IndexedDB.
 *
 * Database: 'wadlgaudi' with two object stores:
 *   - 'fit-files': raw binary .fit data  { name, data: ArrayBuffer, addedAt, synced }
 *   - 'activities': parsed activity metadata for rendering
 */

const DB_NAME = 'wadlgaudi';
const DB_VERSION = 1;
const STORE_FILES = 'fit-files';
const STORE_ACTIVITIES = 'activities';

let dbPromise = null;

/**
 * Opens (or creates) the IndexedDB database. Returns a cached promise.
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES, { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains(STORE_ACTIVITIES)) {
        db.createObjectStore(STORE_ACTIVITIES, { keyPath: 'name' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

// ---------------------------------------------------------------------------
// fit-files store
// ---------------------------------------------------------------------------

/**
 * Stores a .fit file's binary data in IndexedDB.
 * @param {string} name - Filename (used as key).
 * @param {ArrayBuffer} arrayBuffer - Raw .fit binary data.
 */
export async function storeFile(name, arrayBuffer) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FILES, 'readwrite');
    tx.objectStore(STORE_FILES).put({
      name,
      data: arrayBuffer,
      addedAt: Date.now(),
      synced: false,
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Retrieves a stored .fit file entry by name.
 * @param {string} name - Filename.
 * @returns {Promise<{name: string, data: ArrayBuffer, addedAt: number, synced: boolean}|null>}
 */
export async function getFile(name) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FILES, 'readonly');
    const request = tx.objectStore(STORE_FILES).get(name);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Removes a .fit file from both the fit-files and activities stores.
 * @param {string} name - Filename.
 */
export async function removeFile(name) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_FILES, STORE_ACTIVITIES], 'readwrite');
    tx.objectStore(STORE_FILES).delete(name);
    tx.objectStore(STORE_ACTIVITIES).delete(name);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Returns all stored .fit file entries.
 * @returns {Promise<Array<{name: string, data: ArrayBuffer, addedAt: number, synced: boolean}>>}
 */
export async function getAllFiles() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FILES, 'readonly');
    const request = tx.objectStore(STORE_FILES).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Returns .fit file entries that have not yet been synced to Drive.
 * @returns {Promise<Array>}
 */
export async function getUnsyncedFiles() {
  const all = await getAllFiles();
  return all.filter(f => !f.synced);
}

/**
 * Marks a .fit file as synced with Drive.
 * @param {string} name - Filename.
 */
export async function markSynced(name) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FILES, 'readwrite');
    const store = tx.objectStore(STORE_FILES);
    const request = store.get(name);
    request.onsuccess = () => {
      const entry = request.result;
      if (entry) {
        entry.synced = true;
        store.put(entry);
      }
      tx.oncomplete = () => resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Returns the total size in bytes of all stored .fit files.
 * @returns {Promise<number>}
 */
export async function getTotalStorageBytes() {
  const all = await getAllFiles();
  return all.reduce((sum, f) => sum + (f.data ? f.data.byteLength : 0), 0);
}

// ---------------------------------------------------------------------------
// activities store
// ---------------------------------------------------------------------------

/**
 * Stores a parsed activity metadata object.
 * @param {object} activity - Activity metadata (must have a 'name' property).
 */
export async function storeActivity(activity) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ACTIVITIES, 'readwrite');
    tx.objectStore(STORE_ACTIVITIES).put(activity);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Returns all stored activity metadata entries.
 * @returns {Promise<Array>}
 */
export async function getAllActivities() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ACTIVITIES, 'readonly');
    const request = tx.objectStore(STORE_ACTIVITIES).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Removes a single activity metadata entry by name.
 * @param {string} name - Activity filename.
 */
export async function removeActivity(name) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ACTIVITIES, 'readwrite');
    tx.objectStore(STORE_ACTIVITIES).delete(name);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Clears all activity metadata entries.
 */
export async function clearAllActivities() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ACTIVITIES, 'readwrite');
    tx.objectStore(STORE_ACTIVITIES).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
