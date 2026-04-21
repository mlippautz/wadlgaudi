import type { ActivitySummary } from './activity-parser';
import * as blobStorage from './blob-storage';

export interface StoredActivity extends ActivitySummary {
    id: string;
    createdAt: string;
    atpRecordKey?: string;
    encryptedActivityKey?: string; // Base64 encoded activity key encrypted with master key
}

const STORAGE_KEY = 'wadlgaudi_activities';
const PASSPHRASE_KEY = 'wadlgaudi_passphrase';

/**
 * Saves a new activity to localStorage and its blob to IndexedDB.
 */
export async function saveActivity(
    summary: ActivitySummary, 
    atpRecordKey?: string, 
    encryptedActivityKey?: string,
    blob?: Uint8Array
): Promise<StoredActivity> {
    const activities = getActivities();
    const id = crypto.randomUUID();
    const newActivity: StoredActivity = {
        ...summary,
        id,
        createdAt: new Date().toISOString(),
        atpRecordKey,
        encryptedActivityKey
    };
    
    // Save blob if provided
    if (blob) {
        await blobStorage.putBlob(id, blob);
    }
    
    activities.unshift(newActivity); // Newest first
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
    return newActivity;
}

/**
 * Retrieves all saved activities from localStorage.
 */
export function getActivities(): StoredActivity[] {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    try {
        return JSON.parse(data);
    } catch (e) {
        console.error('Failed to parse activities from storage', e);
        return [];
    }
}

/**
 * Deletes an activity from localStorage and its blob from IndexedDB.
 */
export async function deleteActivity(id: string): Promise<void> {
    const activities = getActivities();
    const filtered = activities.filter(a => a.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    
    // Also clean up the blob
    await blobStorage.removeBlob(id);
}

/**
 * Clears all activities from localStorage and all blobs from IndexedDB.
 */
export async function clearActivities(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY);
    await blobStorage.removeAllBlobs();
}

/**
 * Retrieves the passphrase for the synchronous key from localStorage.
 */
export function getPassphrase(): string | null {
    return localStorage.getItem(PASSPHRASE_KEY);
}

/**
 * Saves the passphrase for the synchronous key to localStorage.
 */
export function setPassphrase(passphrase: string): void {
    localStorage.setItem(PASSPHRASE_KEY, passphrase);
}
