import { LitElement, html } from 'lit';
import type { AtpClient } from '../lib/atp-client';
import { getActivities, deleteActivity, type StoredActivity } from '../lib/storage';
import { deriveMasterKey, decryptSymmetric } from '../lib/crypto';
import { getBlob, putBlob } from '../lib/blob-storage';
import './w-activity-card';

export class WFeed extends LitElement {
    static properties = {
        atpClient: { type: Object },
        activities: { type: Array },
    };

    private _atpClient?: AtpClient;
    declare activities: StoredActivity[];

    set atpClient(client: AtpClient | undefined) {
        const oldVal = this._atpClient;
        this._atpClient = client;
        this.requestUpdate('atpClient', oldVal);
        if (client) {
            this.sync();
        }
    }

    get atpClient() {
        return this._atpClient;
    }

    createRenderRoot() {
        return this;
    }

    constructor() {
        super();
        this.activities = getActivities();
    }

    async connectedCallback() {
        super.connectedCallback();
        
        // Listen for deletion
        this.addEventListener('delete-activity', async (e: any) => {
            const id = e.detail.id;
            if (id) {
                const activity = this.activities.find(a => a.id === id);
                
                if (activity?.atpRecordKey && this.atpClient?.agent) {
                    try {
                        console.log('Deleting record from AT Protocol:', activity.atpRecordKey);
                        await this.atpClient.deleteActivityRecord(activity.atpRecordKey);
                    } catch (err) {
                        console.error('Failed to delete from AT Protocol', err);
                        if (!confirm('Failed to delete from Bluesky. Delete locally anyway?')) {
                            return;
                        }
                    }
                }

                await deleteActivity(id);
                this.activities = getActivities();
            }
        });
    }

    private async sync() {
        if (this.atpClient?.agent) {
            try {
                console.log('[Feed] Syncing with AT Protocol...');
                const remoteRecords = await this.atpClient.listActivityRecords();
                const localActivities = getActivities();
                
                let phrase = localStorage.getItem('wadlgaudi_phrase');
                let masterKey: CryptoKey | null = null;
                
                if (!phrase && remoteRecords.length > 0) {
                    const hasEncrypted = remoteRecords.some(r => (r.value as any).encryptedSummary && (r.value as any).encryptedSummary !== "{}");
                    if (hasEncrypted) {
                        phrase = prompt('Enter recovery phrase to decrypt activity details from Bluesky:');
                        if (phrase) {
                            localStorage.setItem('wadlgaudi_phrase', phrase);
                        }
                    }
                }

                if (phrase) {
                    masterKey = await deriveMasterKey(phrase);
                }

                const remoteActivities: StoredActivity[] = [];
                
                for (const r of remoteRecords) {
                    const val = r.value as any;
                    let polyline = val.polyline || '';
                    let encryptionKey = undefined;

                    if (masterKey && val.encryptedSummary && val.encryptedSummary !== "{}") {
                        try {
                            const encryptedBytes = new Uint8Array(atob(val.encryptedSummary).split('').map(c => c.charCodeAt(0)));
                            const decryptedBytes = await decryptSymmetric(masterKey, encryptedBytes);
                            const summaryObj = JSON.parse(new TextDecoder().decode(decryptedBytes));
                            polyline = summaryObj.polyline || polyline;
                            encryptionKey = summaryObj.activityKey;
                        } catch (err) {
                            console.warn(`[Feed] Failed to decrypt summary for ${r.uri}:`, err);
                        }
                    }

                    remoteActivities.push({
                        id: r.uri.split('/').pop() || r.cid,
                        atpRecordKey: r.uri.split('/').pop(),
                        sportType: val.sportType || 'Activity',
                        distance: val.distance || 0,
                        duration: val.duration || 0,
                        polyline: polyline,
                        maxSpeed: val.maxSpeed || 0,
                        calories: val.calories || 0,
                        encryptionKey: encryptionKey,
                        createdAt: val.createdAt || new Date().toISOString()
                    });
                }
                
                for (const remote of remoteActivities) {
                    const existingBlob = await getBlob(remote.id);
                    if (!existingBlob && this.atpClient) {
                        const record = remoteRecords.find(r => r.uri.endsWith(remote.id));
                        const blobRef = (record?.value as any)?.activityBlob?.ref;
                        if (blobRef) {
                            try {
                                console.log(`[Feed] Syncing blob for activity ${remote.id}...`);
                                const blobData = await this.atpClient.downloadBlob(this.atpClient.sessionDid!, blobRef.toString());
                                await putBlob(remote.id, blobData);
                            } catch (err) {
                                console.error(`[Feed] Failed to download blob for ${remote.id}:`, err);
                            }
                        }
                    }
                }

                const merged = [...localActivities];
                remoteActivities.forEach(remote => {
                    const exists = merged.find(local => local.atpRecordKey === remote.atpRecordKey);
                    if (!exists) {
                        merged.push(remote);
                    } else if (remote.encryptionKey && !exists.encryptionKey) {
                        exists.encryptionKey = remote.encryptionKey;
                        exists.polyline = remote.polyline;
                    }
                });

                merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                localStorage.setItem('wadlgaudi_activities', JSON.stringify(merged));
                this.activities = merged;
            } catch (err) {
                console.error('[Feed] Failed to sync with AT Protocol:', err);
            }
        }
    }

    render() {
        console.log('[Feed] Rendering UI with', this.activities.length, 'activities');
        
        const activitiesHtml = this.activities.length > 0 
            ? this.activities.map(act => html`
                <w-activity-card 
                    id="${act.id}"
                    sport="${act.sportType}" 
                    distance="${act.distance}" 
                    duration="${act.duration}" 
                    polyline="${act.polyline || ''}"
                    date="${new Date(act.createdAt).toLocaleDateString()} ${new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}"
                ></w-activity-card>
            `)
            : html`<p style="text-align: center; color: var(--text-muted); margin-top: 2rem;">No activities yet. Upload one to get started!</p>`;

        return html`
            <div class="section-title">
                Activity Feed
            </div>
            
            <div class="feed-list">
                ${activitiesHtml}
            </div>
        `;
    }
}

customElements.define('w-feed', WFeed);
