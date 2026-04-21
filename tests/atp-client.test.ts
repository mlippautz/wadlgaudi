import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AtpClient } from '../src/lib/atp-client';

// Mock the oauth client since it requires browser environment
vi.mock('@atproto/oauth-client-browser', () => {
    return {
        BrowserOAuthClient: class {
            init() { return Promise.resolve({ session: { did: 'did:plc:test1234' } }); }
            signIn() { return Promise.resolve(); }
        }
    };
});

// Mock the Agent
vi.mock('@atproto/api', () => {
    return {
        Agent: class {
            com = {
                atproto: {
                    repo: {
                        putRecord: vi.fn().mockResolvedValue({ data: { uri: 'at://test' } }),
                        uploadBlob: vi.fn().mockResolvedValue({ data: { blob: { $type: 'blob', ref: { toString: () => 'cid123' } } } })
                    }
                }
            };
        }
    };
});

describe('AtpClient Data Layer', () => {
    let client: AtpClient;

    beforeEach(async () => {
        client = new AtpClient();
        await client.initialize();
    });

    it('should initialize and set the session DID', () => {
        expect(client.sessionDid).toBe('did:plc:test1234');
        expect(client.agent).toBeDefined();
    });

    it('should publish a public key record', async () => {
        const response = await client.publishPublicKey({
            publicKey: 'base64keyhere',
            createdAt: new Date().toISOString()
        });
        expect((response as any).data.uri).toBe('at://test');
    });

    it('should upload an activity blob', async () => {
        const data = new Uint8Array([1, 2, 3]);
        const blob = await client.uploadActivityBlob(data);
        expect((blob as any).$type).toBe('blob');
    });

    it('should publish an activity record', async () => {
        const response = await client.publishActivityRecord('random-rkey', {
            createdAt: new Date().toISOString(),
            activityBlob: { $type: 'blob' },
            accessList: { 'did:plc:friend': 'encryptedKey' }
        });
        expect((response as any).data.uri).toBe('at://test');
    });
});
