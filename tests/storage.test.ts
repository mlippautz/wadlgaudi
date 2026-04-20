import { describe, it, expect, beforeEach, vi } from 'vitest';
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
    beforeEach(() => {
        clearActivities();
        vi.clearAllMocks();
    });

    it('should save and retrieve activities', () => {
        const mockActivity = {
            sportType: 'Biking',
            distance: 1000,
            duration: 360,
            polyline: 'abc'
        };

        const saved = saveActivity(mockActivity);
        expect(saved.id).toBe('test-uuid-0');
        expect(saved.sportType).toBe('Biking');

        const all = getActivities();
        expect(all.length).toBe(1);
        expect(all[0]).toEqual(saved);
    });

    it('should return empty array if no activities stored', () => {
        expect(getActivities()).toEqual([]);
    });

    it('should clear activities', () => {
        saveActivity({ sportType: 'Run', distance: 1, duration: 1, polyline: 'p' });
        clearActivities();
        expect(getActivities()).toEqual([]);
    });

    it('should delete a specific activity', () => {
        const a1 = saveActivity({ sportType: 'Run', distance: 1, duration: 1, polyline: 'p' });
        const a2 = saveActivity({ sportType: 'Bike', distance: 2, duration: 2, polyline: 'b' });
        
        deleteActivity(a1.id);
        const all = getActivities();
        expect(all.length).toBe(1);
        expect(all[0].id).toBe(a2.id);
    });
});
