import type { AtpClient } from '../lib/atp-client';
import { getActivities, deleteActivity, type StoredActivity } from '../lib/storage';

export class WFeed extends HTMLElement {
    private _atpClient?: AtpClient;

    set atpClient(client: AtpClient | undefined) {
        this._atpClient = client;
        if (client) {
            this.sync();
        }
    }

    get atpClient() {
        return this._atpClient;
    }

    async connectedCallback() {
        // Initial render from local storage
        const localActivities = getActivities();
        this.render(localActivities);
        
        // Listen for deletion (this one is on 'this', so it's fine)
        this.addEventListener('delete-activity', async (e: any) => {
            const id = e.detail.id;
            if (id) {
                const activities = getActivities();
                const activity = activities.find(a => a.id === id);
                
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
                const updated = getActivities();
                this.render(updated);
            }
        });
    }

    private async sync() {
        // 1. If authenticated, sync with the AT Protocol
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
                    const { deriveMasterKey } = await import('../lib/crypto');
                    masterKey = await deriveMasterKey(phrase);
                }

                // Map remote records to StoredActivity format
                const remoteActivities: StoredActivity[] = [];
                
                for (const r of remoteRecords) {
                    const val = r.value as any;
                    let polyline = val.polyline || '';
                    let encryptionKey = undefined;

                    // Try to decrypt summary if we have a master key
                    if (masterKey && val.encryptedSummary && val.encryptedSummary !== "{}") {
                        try {
                            const { decryptSymmetric } = await import('../lib/crypto');
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

                // 2. Download missing blobs
                const { getBlob, putBlob } = await import('../lib/blob-storage');
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

                // 3. Merge with local activities
                const merged = [...localActivities];
                remoteActivities.forEach(remote => {
                    const exists = merged.find(local => local.atpRecordKey === remote.atpRecordKey);
                    if (!exists) {
                        merged.push(remote);
                    } else if (remote.encryptionKey && !exists.encryptionKey) {
                        // Update local record if we just recovered the key
                        exists.encryptionKey = remote.encryptionKey;
                        exists.polyline = remote.polyline;
                    }
                });

                merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                localStorage.setItem('wadlgaudi_activities', JSON.stringify(merged));
                this.render(merged);
            } catch (err) {
                console.error('[Feed] Failed to sync with AT Protocol:', err);
            }
        }
    }

    private attachListeners() {
        // (Moved to WApp header)
    }

    render(activities: StoredActivity[]) {
        console.log('[Feed] Rendering UI with', activities.length, 'activities');
        const activitiesHtml = activities.length > 0 
            ? activities.map(act => `
                <w-activity-card 
                    id="${act.id}"
                    sport="${act.sportType}" 
                    distance="${act.distance}" 
                    duration="${act.duration}" 
                    date="${new Date(act.createdAt).toLocaleDateString()} ${new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}"
                ></w-activity-card>
            `).join('')
            : '<p style="text-align: center; color: var(--text-muted); margin-top: 2rem;">No activities yet. Upload one to get started!</p>';

        this.innerHTML = `
            <style>
            </style>
            <div class="section-title">
                Activity Feed
            </div>
            
            <div class="feed-list">
                ${activitiesHtml}
            </div>
        `;
        
        this.attachListeners();
    }
}

customElements.define('w-feed', WFeed);
