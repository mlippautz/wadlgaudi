import { describe, it, expect } from 'vitest';
import { AccessControlManager } from '../src/lib/access-control';

describe('Access Control & Soft Revocation', () => {
    it('should encrypt an activity and build an access list', async () => {
        const manager = new AccessControlManager();
        const rawBlob = new Uint8Array([10, 20, 30, 40]);
        const friends = {
            'did:plc:friend1': 'pubkey1',
            'did:plc:friend2': 'pubkey2'
        };

        const result = await manager.encryptActivity(rawBlob, friends);
        
        expect(result.aesKey).toBeDefined();
        expect(result.encryptedBlob).toBeDefined();
        expect(result.encryptedBlob).not.toEqual(rawBlob);
        expect(Object.keys(result.accessList)).toHaveLength(2);
        expect(result.accessList['did:plc:friend1']).toContain('pubkey1');
    });

    it('should softly revoke access and generate new encrypted payloads', async () => {
        const manager = new AccessControlManager();
        const rawBlob = new Uint8Array([10, 20, 30, 40]);
        const friends = {
            'did:plc:friend1': 'pubkey1',
            'did:plc:friend2': 'pubkey2'
        };

        // Initial encryption
        const initial = await manager.encryptActivity(rawBlob, friends);

        // Soft Revoke friend2
        const revoked = await manager.softRevoke(
            initial.encryptedBlob, 
            initial.aesKey, 
            friends, 
            'did:plc:friend2'
        );

        expect(revoked.aesKey).not.toBe(initial.aesKey); // New key generated
        expect(Object.keys(revoked.accessList)).toHaveLength(1);
        expect(revoked.accessList['did:plc:friend2']).toBeUndefined();
        expect(revoked.accessList['did:plc:friend1']).toBeDefined();
    });
});
