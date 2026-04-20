import { describe, it, expect } from 'vitest';
import { parseTcx } from '../src/lib/activity-parser';
import { generateAESKey, encryptSymmetric, decryptSymmetric } from '../src/lib/crypto';
import tcxString from './assets/dummy.tcx?raw';

describe('Local Encrypt & Decrypt Workflow', () => {
    it('should parse, encrypt, and decrypt a real TCX file correctly', async () => {
        // 1. Read real TCX file (imported statically via Vite ?raw)
        
        // 2. Parse it to verify it's valid
        const summary = parseTcx(tcxString);
        expect(summary.sportType).toBeDefined();
        
        // 3. Encrypt it
        const key = await generateAESKey();
        const dataBytes = new TextEncoder().encode(tcxString);
        
        const startTime = performance.now();
        const encryptedPayload = await encryptSymmetric(key, dataBytes);
        const encryptTime = performance.now() - startTime;
        
        expect(encryptedPayload).toBeDefined();
        expect(encryptedPayload.length).toBeGreaterThan(0);
        console.log(`Encrypted ${dataBytes.length} bytes to ${encryptedPayload.length} bytes in ${encryptTime.toFixed(2)}ms`);
        
        // 4. Decrypt it
        const decryptStartTime = performance.now();
        const decryptedBytes = await decryptSymmetric(key, encryptedPayload);
        const decryptTime = performance.now() - decryptStartTime;
        
        const decryptedString = new TextDecoder().decode(decryptedBytes);
        console.log(`Decrypted in ${decryptTime.toFixed(2)}ms`);
        
        // 5. Verify match
        expect(decryptedString.length).toEqual(tcxString.length);
        
        // Re-parse the decrypted string to ensure XML is uncorrupted
        const decryptedSummary = parseTcx(decryptedString);
        expect(decryptedSummary.sportType).toEqual(summary.sportType);
        expect(decryptedSummary.distance).toEqual(summary.distance);
    });
});
