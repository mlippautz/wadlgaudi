import { LitElement, html, css } from 'lit';
import { sharedStyles } from '../styles/shared-styles';
import { getPassphrase, setPassphrase, clearActivities } from '../lib/storage';
import { generateRecoveryPhrase } from '../lib/crypto';
import type { AtpClient } from '../lib/atp-client';

export class WGSettings extends LitElement {
    static properties = {
        passphrase: { type: String },
        showPassphrase: { type: Boolean },
        atpClient: { type: Object },
    };

    declare passphrase: string;
    declare showPassphrase: boolean;
    declare atpClient?: AtpClient;

    constructor() {
        super();
        this.passphrase = getPassphrase() || '';
        this.showPassphrase = false;
    }

    static styles = [
        sharedStyles,
        css`
            .settings-container {
                animation: fadeIn 0.3s ease;
                max-width: 600px;
                margin: 0 auto;
                padding: 2rem;
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: scale(0.98); }
                to { opacity: 1; transform: scale(1); }
            }
            .back-link {
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                color: var(--text-muted);
                text-decoration: none;
                font-size: 0.9rem;
                margin-bottom: 2rem;
                transition: color 0.2s ease;
            }
            .back-link:hover {
                color: var(--primary-color);
            }
            .header-section {
                margin-bottom: 2rem;
            }
            h2 { font-size: 2.5rem; margin-bottom: 0.5rem; }
            .description { color: var(--text-muted); margin-bottom: 1.5rem; }
            
            .form-group {
                margin-bottom: 1.5rem;
            }
            .form-group label {
                display: block;
                font-size: 0.75rem;
                color: var(--text-muted);
                text-transform: uppercase;
                letter-spacing: 0.1em;
                margin-bottom: 0.5rem;
            }
            .input-wrapper {
                display: flex;
                gap: 0.5rem;
                align-items: center;
            }
            .input-wrapper input {
                flex: 1;
            }
            .actions {
                display: flex;
                gap: 1rem;
                margin-top: 2rem;
            }
            .btn-primary {
                background: var(--primary-color);
                color: #000;
            }
        `
    ];

    render() {
        return html`
            <div class="settings-container">
                <a href="#/feed" class="back-link">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                    Back to Feed
                </a>

                <div class="header-section">
                    <h2>Settings</h2>
                    <p class="description">Manage your cryptographic keys and passphrases.</p>
                </div>

                <div class="glass-panel" style="padding: 2rem;">
                    <div class="form-group">
                        <label for="passphrase">Synchronous Key Passphrase</label>
                        <div class="input-wrapper">
                            <input 
                                id="passphrase" 
                                type="${this.showPassphrase ? 'text' : 'password'}" 
                                .value="${this.passphrase}"
                                @input="${this.handleInput}"
                                placeholder="Enter your BIP39 phrase or generate one"
                            />
                            <button class="btn-icon" @click="${this.toggleShow}">
                                ${this.showPassphrase ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </div>

                    <div class="actions">
                        <button class="btn-primary" @click="${this.handleSave}">Save</button>
                        <button class="btn-tertiary" @click="${this.handleGenerate}">Generate New</button>
                    </div>
                </div>

                <div class="glass-panel" style="padding: 2rem; margin-top: 2rem;">
                    <h4>Management</h4>
                    <p class="description" style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem;">Debug actions and storage management.</p>
                    <div class="actions">
                        <button class="btn-tertiary" @click="${this.handleDebug}">List issues on Bluesky</button>
                        <button class="btn-tertiary" @click="${this.handleClear}">Clear local storage</button>
                    </div>
                </div>
            </div>
        `;
    }

    handleInput(e: Event) {
        const input = e.target as HTMLInputElement;
        this.passphrase = input.value;
    }

    toggleShow() {
        this.showPassphrase = !this.showPassphrase;
    }

    handleSave() {
        setPassphrase(this.passphrase);
        alert('Passphrase saved successfully!');
    }

    handleGenerate() {
        if (this.passphrase && !confirm('This will overwrite your current passphrase. Are you sure?')) {
            return;
        }
        this.passphrase = generateRecoveryPhrase();
        this.showPassphrase = true; // Show it so they can copy it
        this.requestUpdate();
    }

    async handleDebug() {
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
                alert('Failed to list records: ' + (err as Error).message);
            }
        } else {
            alert('Not logged in or ATP client not available.');
        }
    }

    async handleClear() {
        if (confirm('Clear all local activities? This will NOT delete them from Bluesky.')) {
            await clearActivities();
            alert('Local activities cleared.');
        }
    }
}

customElements.define('wg-settings', WGSettings);
