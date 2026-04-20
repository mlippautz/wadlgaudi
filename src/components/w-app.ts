import { AtpClient } from '../lib/atp-client';
import './w-login';
import './w-feed';
import './w-upload';
import './w-activity-detail';

export class WApp extends HTMLElement {
    private atpClient = new AtpClient();
    private currentView: 'login' | 'feed' | 'upload' | 'activity-detail' = 'login';
    private currentActivityId: string | null = null;

    async connectedCallback() {
        // 1. First, check if we are returning from an OAuth flow
        // This MUST happen before handleRoute to ensure the URL params are processed
        const isLoggedIn = await this.atpClient.initialize();

        // 2. Initial route handling
        this.handleRoute(); // This already calls render()

        // 3. Listen for browser navigation
        window.addEventListener('hashchange', () => {
            this.handleRoute();
        });

        // 4. Redirect to feed if already logged in and at login screen
        if (isLoggedIn && this.currentView === 'login') {
            window.location.hash = '#/feed';
        }

        // Listen for successful login events from <w-login>
        this.addEventListener('login-success', () => {
            window.location.hash = '#/feed';
        });

        // Listen for global actions from the header
        this.addEventListener('action-logout', async () => {
            await this.atpClient.logout();
            window.location.hash = '#/login';
        });

        this.addEventListener('action-clear', () => {
            if (confirm('Clear all local activities? This will NOT delete them from Bluesky.')) {
                import('../lib/storage').then(m => {
                    m.clearActivities();
                    // Force refresh current view if it's the feed
                    if (this.currentView === 'feed') this.handleRoute();
                });
            }
        });

        this.addEventListener('action-debug', async () => {
            if (this.atpClient?.agent) {
                try {
                    const records = await this.atpClient.listActivityRecords();
                    console.table(records.map(r => ({
                        uri: r.uri,
                        cid: r.cid,
                        sport: (r.value as any).sportType,
                        createdAt: (r.value as any).createdAt
                    })));
                    alert(`Found ${records.length} records on Bluesky. See console for details.`);
                } catch (err) {
                    console.error('Failed to list records', err);
                }
            } else {
                alert('Not logged in.');
            }
        });
    }

    handleRoute() {
        const hash = window.location.hash;
        console.log('[App] Navigating to:', hash || '#/login');
        if (hash === '#/feed') {
            this.currentView = 'feed';
        } else if (hash === '#/upload') {
            this.currentView = 'upload';
        } else if (hash.startsWith('#/activity/')) {
            this.currentView = 'activity-detail';
            this.currentActivityId = hash.replace('#/activity/', '');
        } else {
            this.currentView = 'login';
            if (!hash) window.location.hash = '#/login';
        }
        this.render();
        
        // Header action listeners
        this.querySelector('#logout-btn')?.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('action-logout', { bubbles: true, composed: true }));
        });
        this.querySelector('#clear-btn')?.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('action-clear', { bubbles: true, composed: true }));
        });
        this.querySelector('#debug-btn')?.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('action-debug', { bubbles: true, composed: true }));
        });
        this.querySelector('#add-btn')?.addEventListener('click', () => {
            window.location.hash = '#/upload';
        });
    }

    render() {
        this.innerHTML = `
            <style>
                .app-header {
                    position: sticky;
                    top: 0;
                    z-index: 100;
                    background: rgba(0, 0, 0, 0.8);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border-bottom: 1px solid var(--surface-border);
                    padding: 1rem 1.5rem;
                }
                .header-content {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    max-width: 1000px;
                    margin: 0 auto;
                }
                .logo {
                    font-size: 1.5rem;
                    font-weight: 800;
                    color: #ffffff;
                    text-decoration: none;
                    letter-spacing: -0.02em;
                }
                .user-handle {
                    font-size: 0.85rem;
                    color: var(--text-muted);
                    font-weight: 500;
                    letter-spacing: 0.02em;
                }
                .actions {
                    display: flex;
                    gap: 0.5rem;
                    align-items: center;
                }
                .btn-icon {
                    padding: 0.5rem 0.75rem;
                    font-size: 0.85rem;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid var(--surface-border);
                    border-radius: var(--border-radius-sm);
                    color: var(--text-main);
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .btn-icon:hover {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: var(--primary-color);
                }
                .btn-primary {
                    background: var(--primary-color);
                    border: none;
                    color: #000;
                    padding: 0.5rem 1rem;
                    font-weight: 700;
                }
                .btn-danger {
                    color: #ef4444;
                }
                .btn-danger:hover {
                    background: rgba(239, 68, 68, 0.1);
                    border-color: rgba(239, 68, 68, 0.2);
                }

                @media (max-width: 600px) {
                    .app-header { padding: 0.75rem 1rem; }
                    .logo { font-size: 1.25rem; }
                    .btn-text { display: none; } /* Hide text on small screens */
                    .btn-icon { padding: 0.5rem; }
                }
            </style>
            ${this.currentView !== 'login' ? `
                <header class="app-header">
                    <div class="header-content">
                        <div style="display: flex; align-items: baseline; gap: 1rem;">
                            <a href="#/feed" class="logo">Wadlgaudi</a>
                            <span class="user-handle">${this.atpClient.handle ? `@${this.atpClient.handle}` : 'Offline Mode'}</span>
                        </div>
                        <div class="actions">
                            <button id="debug-btn" class="btn-icon">
                                <span class="btn-text">Debug</span>
                            </button>
                            <button id="clear-btn" class="btn-icon btn-danger">
                                <span class="btn-text">Clear</span>
                            </button>
                            <button id="add-btn" class="btn-primary">
                                <span>+</span> <span class="btn-text">New</span>
                            </button>
                            <button id="logout-btn" class="btn-icon">
                                <span class="btn-text">${this.atpClient.sessionDid ? 'Logout' : 'Sign In'}</span>
                            </button>
                        </div>
                    </div>
                </header>
            ` : ''}
            <main>
                ${this.currentView === 'login' 
                    ? '<w-login></w-login>' 
                    : this.currentView === 'upload'
                        ? '<w-upload id="upload-view"></w-upload>'
                        : this.currentView === 'activity-detail'
                            ? `<w-activity-detail activity-id="${this.currentActivityId}"></w-activity-detail>`
                            : '<w-feed id="feed-view"></w-feed>'
                }
            </main>
        `;

        if (this.currentView === 'login') {
            const loginEl = this.querySelector('w-login');
            if (loginEl) (loginEl as any).atpClient = this.atpClient;
        } else if (this.currentView === 'feed') {
            const feedEl = this.querySelector('w-feed');
            if (feedEl) (feedEl as any).atpClient = this.atpClient;
        } else if (this.currentView === 'upload') {
            const uploadEl = this.querySelector('w-upload');
            if (uploadEl) (uploadEl as any).atpClient = this.atpClient;
            // Mock friends list for the UI
            if (uploadEl) (uploadEl as any).friendsList = [
                { did: 'did:plc:alice', handle: 'alice.bsky.social' },
                { did: 'did:plc:bob', handle: 'bob.bsky.social' }
            ];
        }
    }
}

customElements.define('w-app', WApp);
