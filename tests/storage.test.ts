import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock blob-storage before importing storage
vi.mock('../src/lib/blob-storage', () => ({
    putBlob: vi.fn(() => Promise.resolve()),
    getBlob: vi.fn(() => Promise.resolve(null)),
    removeBlob: vi.fn(() => Promise.resolve()),
    removeAllBlobs: vi.fn(() => Promise.resolve())
}));

import { saveActivity, getActivities, clearActivities, deleteActivity } from '../src/lib/storage';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
        removeItem: vi.fn((key: string) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; })
    };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });
let uuidCounter = 0;
Object.defineProperty(globalThis, 'crypto', { value: { randomUUID: () => `test-uuid-${uuidCounter++}` } });

describe('Storage Module', () => {
    beforeEach(async () => {
        uuidCounter = 0;
        await clearActivities();
        vi.clearAllMocks();
    });

    it('should save and retrieve activities', async () => {
        const mockActivity = {
            sportType: 'Biking',
            distance: 1000,
            duration: 360,
            polyline: 'abc'
        };

        const saved = await saveActivity(mockActivity);
        expect(saved.id).toBe('test-uuid-0');
        expect(saved.sportType).toBe('Biking');

        const all = getActivities();
        expect(all.length).toBe(1);
        expect(all[0]).toEqual(saved);
    });

    it('should return empty array if no activities stored', () => {
        expect(getActivities()).toEqual([]);
    });

    it('should clear activities', async () => {
        await saveActivity({ sportType: 'Run', distance: 1, duration: 1, polyline: 'p' });
        await clearActivities();
        expect(getActivities()).toEqual([]);
    });

    it('should delete a specific activity', async () => {
        const a1 = await saveActivity({ sportType: 'Run', distance: 1, duration: 1, polyline: 'p' });
        const a2 = await saveActivity({ sportType: 'Bike', distance: 2, duration: 2, polyline: 'b' });
        
        await deleteActivity(a1.id);
        const all = getActivities();
        expect(all.length).toBe(1);
        expect(all[0].id).toBe(a2.id);
    });
});
