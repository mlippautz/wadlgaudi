import { Agent } from '@atproto/api';
import { BrowserOAuthClient } from '@atproto/oauth-client-browser';
import type { WadlgaudiCrypto, WadlgaudiActivity } from './lexicons';

// Configure the OAuth client for local development
let url = typeof window !== 'undefined' ? window.location.origin + '/' : 'http://127.0.0.1:5173/';
if (url.includes('http://localhost')) {
    url = url.replace('http://localhost', 'http://127.0.0.1');
}
const encUrl = encodeURIComponent(url);

const oauthClient = new BrowserOAuthClient({
    handleResolver: 'https://bsky.social',
    clientMetadata: {
        // The atproto OAuth client strictly expects `http://localhost` for loopback client IDs
        // For loopback clients without a hosted metadata file, we must include scopes in the client_id
        client_id: `http://localhost?redirect_uri=${encUrl}&scope=${encodeURIComponent('atproto blob:application/octet-stream repo:app.wadlgaudi.activity?action=create repo:app.wadlgaudi.activity?action=delete repo:app.wadlgaudi.activity?action=update atproto:rpc:app.bsky.actor.getProfile')}`, 
        client_name: 'Wadlgaudi Activity Tracker',
        client_uri: url,
        redirect_uris: [url],
        scope: 'atproto blob:application/octet-stream repo:app.wadlgaudi.activity?action=create repo:app.wadlgaudi.activity?action=delete repo:app.wadlgaudi.activity?action=update atproto:rpc:app.bsky.actor.getProfile',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        application_type: 'web',
        dpop_bound_access_tokens: true,
    }
});

export class AtpClient {
    public agent?: Agent;
    public sessionDid?: string;
    public handle?: string;

    /**
     * Initializes the OAuth client and checks for an existing session.
     */
    async initialize(): Promise<boolean> {
        console.log('[Bluesky] Initializing OAuth client...');
        const result = await oauthClient.init();
        if (result) {
            console.log('[Bluesky] Session found:', result.session);
            this.agent = new Agent(result.session);
            this.sessionDid = result.session.did;
            // Try different possible locations for the handle
            this.handle = (result.session as any).handle || (result.session as any).preferred_username;
            console.log('[Bluesky] Initial handle check:', this.handle);
            
            // If handle is missing or set to 'handle.invalid', fetch it from the profile
            if ((!this.handle || this.handle === 'handle.invalid') && this.sessionDid && this.agent) {
                try {
                    console.log('[Bluesky] Fetching profile via Agent for DID:', this.sessionDid);
                    const response = await this.agent.app.bsky.actor.getProfile({ actor: this.sessionDid });
                    this.handle = response.data.handle;
                    console.log('[Bluesky] Handle resolved via Agent (getProfile):', this.handle);
                } catch (e) {
                    console.warn('[Bluesky] Failed to fetch profile via Agent, trying describeRepo...', e);
                    try {
                        const repo = await this.agent.com.atproto.repo.describeRepo({ repo: this.sessionDid });
                        this.handle = repo.data.handle;
                        console.log('[Bluesky] Handle resolved via Agent (describeRepo):', this.handle);
                    } catch (e2) {
                        console.error('[Bluesky] Failed all handle resolution attempts:', e2);
                    }
                }
            }
            return true;
        }
        console.log('[Bluesky] No active session found.');
        return false;
    }

    /**
     * Redirects the browser to sign in via the user's PDS.
     */
    async login(handle: string) {
        console.log('[Bluesky] Initiating login for handle:', handle);
        await oauthClient.signIn(handle);
    }

    /**
     * Logs the user out.
     */
    async logout() {
        if (this.sessionDid) {
            console.log('[Bluesky] Revoking session for DID:', this.sessionDid);
            await oauthClient.revoke(this.sessionDid);
        }
        this.agent = undefined;
        this.sessionDid = undefined;
        this.handle = undefined;
    }

    /**
     * Publishes the user's public X25519 key to their repository.
     */
    async publishPublicKey(cryptoRecord: Omit<WadlgaudiCrypto, '$type'>) {
        if (!this.agent || !this.sessionDid) throw new Error("Not authenticated");
        return await this.agent.com.atproto.repo.putRecord({
            repo: this.sessionDid,
            collection: 'app.wadlgaudi.crypto',
            rkey: 'self',
            record: {
                $type: 'app.wadlgaudi.crypto',
                ...cryptoRecord
            }
        });
    }

    /**
     * Uploads an encrypted activity payload as an AT Protocol Blob.
     */
    async uploadActivityBlob(data: Uint8Array, mimeType: string = 'application/octet-stream') {
        if (!this.agent) throw new Error("Not authenticated");
        console.log('[Bluesky] Uploading blob (size:', data.length, 'bytes)...');
        const response = await this.agent.com.atproto.repo.uploadBlob(data, {
            encoding: mimeType
        });
        console.log('[Bluesky] Blob uploaded successfully. CID:', response.data.blob.ref.toString());
        return response.data.blob;
    }

    /**
     * Downloads a blob from the AT Protocol.
     */
    async downloadBlob(did: string, cid: string): Promise<Uint8Array> {
        if (!this.agent) throw new Error("Not authenticated");
        console.log(`[Bluesky] Downloading blob ${cid} for DID ${did}...`);
        const response = await this.agent.com.atproto.sync.getBlob({ did, cid });
        return response.data;
    }

    /**
     * Publishes the Activity Record pointing to the blob and containing the Access List.
     */
    async publishActivityRecord(rkey: string, record: Omit<WadlgaudiActivity, '$type'>) {
        if (!this.agent || !this.sessionDid) throw new Error("Not authenticated");
        console.log('[Bluesky] Publishing activity record to collection app.wadlgaudi.activity with rkey:', rkey);
        const response = await this.agent.com.atproto.repo.putRecord({
            repo: this.sessionDid,
            collection: 'app.wadlgaudi.activity',
            rkey,
            record: {
                $type: 'app.wadlgaudi.activity',
                ...record
            }
        });
        console.log('[Bluesky] Activity record published. URI:', response.data.uri);
        return response;
    }

    /**
     * Deletes an Activity Record from the user's repository.
     */
    async deleteActivityRecord(rkey: string) {
        if (!this.agent || !this.sessionDid) throw new Error("Not authenticated");
        console.log('[Bluesky] Deleting activity record with rkey:', rkey);
        const response = await this.agent.com.atproto.repo.deleteRecord({
            repo: this.sessionDid,
            collection: 'app.wadlgaudi.activity',
            rkey
        });
        console.log('[Bluesky] Activity record deleted.');
        return response;
    }

    /**
     * Lists all Activity Records in the user's repository.
     */
    async listActivityRecords() {
        if (!this.agent || !this.sessionDid) throw new Error("Not authenticated");
        console.log('[Bluesky] Listing activity records...');
        const response = await this.agent.com.atproto.repo.listRecords({
            repo: this.sessionDid,
            collection: 'app.wadlgaudi.activity'
        });
        console.log('[Bluesky] Found', response.data.records.length, 'records.');
        return response.data.records;
    }
}
