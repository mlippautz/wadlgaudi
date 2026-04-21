import { LitElement, html, css } from 'lit';
import { sharedStyles } from '../styles/shared-styles';
import { AtpClient } from '../lib/atp-client';
import { clearActivities } from '../lib/storage';
import './w-login';
import './w-feed';
import './w-upload';
import './w-activity-detail';

export class WApp extends LitElement {
    static properties = {
        currentView: { type: String },
        currentActivityId: { type: String },
    };

    private atpClient = new AtpClient();
    declare currentView: 'login' | 'feed' | 'upload' | 'activity-detail';
    declare currentActivityId: string | null;

    constructor() {
        super();
        this.currentView = 'login';
        this.currentActivityId = null;
    }

    static styles = [
        sharedStyles,
        css`
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
                font-size: var(--font-size-logo);
                font-weight: 800;
                color: #ffffff;
                text-decoration: none;
                letter-spacing: -0.04em;
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
            .btn-primary {
                background: var(--primary-color);
                color: #000;
            }
            
            main {
                margin-top: 1rem;
            }

            @media (max-width: 600px) {
                .app-header { padding: 0.75rem 1rem; }
                .logo { font-size: 1.25rem; }
                .btn-text { display: none; } /* Hide text on small screens */
                .btn-icon { padding: 0.5rem; }
            }

            .app-footer {
                margin-top: 4rem;
                padding: 3rem 1rem;
                border-top: 1px solid var(--surface-border);
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 1rem;
            }
            .footer-actions {
                display: flex;
                gap: 1rem;
            }
        `
    ];

    async connectedCallback() {
        super.connectedCallback();
        
        // 1. First, check if we are returning from an OAuth flow
        const isLoggedIn = await this.atpClient.initialize();

        // 2. Initial route handling
        this.handleRoute();

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

        this.addEventListener('action-clear', async () => {
            if (confirm('Clear all local activities? This will NOT delete them from Bluesky.')) {
                await clearActivities();
                if (this.currentView === 'feed') this.handleRoute();
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
    }

    render() {
        return html`
            ${this.currentView !== 'login' ? html`
                <header class="app-header">
                    <div class="header-content">
                        <div style="display: flex; align-items: baseline; gap: 1rem;">
                            <a href="#/feed" class="logo">Wadlgaudi</a>
                            <span class="user-handle">
                                ${this.atpClient.handle 
                                    ? `@${this.atpClient.handle}` 
                                    : (this.atpClient.sessionDid ? 'Authenticated' : 'Offline Mode')}
                            </span>
                        </div>
                        <div class="actions">
                            <button id="add-btn" class="btn-primary" @click="${() => window.location.hash = '#/upload'}">
                                <span>+</span> <span class="btn-text">New</span>
                            </button>
                            <button id="logout-btn" class="btn-icon" @click="${() => this.dispatchEvent(new CustomEvent('action-logout'))}">
                                <span class="btn-text">${this.atpClient.sessionDid ? 'Logout' : 'Sign In'}</span>
                            </button>
                        </div>
                    </div>
                </header>
            ` : ''}
            <main>
                ${this.currentView === 'login' 
                    ? html`<w-login .atpClient="${this.atpClient}"></w-login>` 
                    : this.currentView === 'upload'
                        ? html`<w-upload id="upload-view" .atpClient="${this.atpClient}" .friendsList="${[
                            { did: 'did:plc:alice', handle: 'alice.bsky.social' },
                            { did: 'did:plc:bob', handle: 'bob.bsky.social' }
                        ]}"></w-upload>`
                        : this.currentView === 'activity-detail'
                            ? html`<w-activity-detail activity-id="${this.currentActivityId}"></w-activity-detail>`
                            : html`<w-feed id="feed-view" .atpClient="${this.atpClient}"></w-feed>`
                }
            </main>
            ${this.currentView !== 'login' ? html`
                <footer class="app-footer">
                    <div class="footer-actions">
                        <button id="debug-btn" class="btn-tertiary" @click="${() => this.dispatchEvent(new CustomEvent('action-debug'))}">List issues on Bluesky</button>
                        <button id="clear-btn" class="btn-tertiary" @click="${() => this.dispatchEvent(new CustomEvent('action-clear'))}">Clear local storage</button>
                    </div>
                </footer>
            ` : ''}
        `;
    }
}

customElements.define('w-app', WApp);
