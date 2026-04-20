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
                
                // Map remote records to StoredActivity format
                const remoteActivities: StoredActivity[] = remoteRecords.map(r => {
                    const val = r.value as any;
                    return {
                        id: r.uri.split('/').pop() || r.cid, // Use rkey as local ID
                        atpRecordKey: r.uri.split('/').pop(),
                        sportType: val.sportType || 'Activity',
                        distance: val.distance || 0,
                        duration: val.duration || 0,
                        polyline: val.polyline || '',
                        createdAt: val.createdAt || new Date().toISOString()
                    };
                });

                // Merge with local activities, avoiding duplicates by ATP record key
                const merged = [...localActivities];
                remoteActivities.forEach(remote => {
                    const exists = merged.find(local => local.atpRecordKey === remote.atpRecordKey);
                    if (!exists) {
                        merged.push(remote);
                    }
                });

                // Sort by date descending
                merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                // Save back to local storage and re-render
                localStorage.setItem('wadlgaudi_activities', JSON.stringify(merged));
                this.render(merged);
                console.log('[Feed] Sync complete. Found', remoteActivities.length, 'remote records.');
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
                .feed-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                }
                .feed-header h2 {
                    font-weight: 600;
                }
                #upload-btn {
                    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
                    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
                    padding: 0.75rem 1.5rem;
                    border-radius: var(--border-radius-md);
                    font-weight: 600;
                    cursor: pointer;
                }
                #upload-btn:hover {
                    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.5);
                    opacity: 0.9;
                }
                #clear-btn {
                    background: transparent;
                    border: 1px solid var(--surface-border);
                    padding: 0.75rem 1rem;
                    border-radius: var(--border-radius-md);
                    font-size: 0.8rem;
                    color: var(--text-muted);
                    cursor: pointer;
                    margin-right: 0.5rem;
                }
                #clear-btn:hover {
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                    border-color: rgba(239, 68, 68, 0.2);
                }
            </style>
            <div class="feed-header">
                <h2>Activity Feed</h2>
            </div>
            
            <div class="feed-list">
                ${activitiesHtml}
            </div>
        `;
        
        this.attachListeners();
    }
}

customElements.define('w-feed', WFeed);
