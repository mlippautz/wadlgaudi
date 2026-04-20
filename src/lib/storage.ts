import type { ActivitySummary } from './activity-parser';

export interface StoredActivity extends ActivitySummary {
    id: string;
    createdAt: string;
    atpRecordKey?: string;
    encryptionKey?: string; // Base64 encoded symmetric key
}

const STORAGE_KEY = 'wadlgaudi_activities';

/**
 * Saves a new activity to localStorage.
 */
export function saveActivity(summary: ActivitySummary, atpRecordKey?: string, encryptionKey?: string): StoredActivity {
    const activities = getActivities();
    const newActivity: StoredActivity = {
        ...summary,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        atpRecordKey,
        encryptionKey
    };
    
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
 * Deletes an activity from localStorage by ID.
 */
export function deleteActivity(id: string): void {
    const activities = getActivities();
    const filtered = activities.filter(a => a.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * Clears all activities from localStorage.
 */
export function clearActivities(): void {
    localStorage.removeItem(STORAGE_KEY);
}
