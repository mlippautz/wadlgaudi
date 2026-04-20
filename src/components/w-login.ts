import type { AtpClient } from '../lib/atp-client';

export class WLogin extends HTMLElement {
    public atpClient?: AtpClient;

    connectedCallback() {
        this.render();
        this.querySelector('form')?.addEventListener('submit', this.handleLogin.bind(this));
        this.querySelector('#skip-btn')?.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('login-success', { bubbles: true, composed: true }));
        });
    }

    async handleLogin(e: Event) {
        e.preventDefault();
        const handleInput = this.querySelector('#handle') as HTMLInputElement;
        const handle = handleInput.value.trim();

        if (handle && this.atpClient) {
            try {
                // Starts the OAuth flow (will redirect the browser)
                await this.atpClient.login(handle);
            } catch (err) {
                alert('Login failed. Please check console.');
                console.error(err);
            }
        }
    }

    render() {
        this.innerHTML = `
            <style>
                .login-container {
                    padding: 3rem 2rem;
                    text-align: center;
                    max-width: 450px;
                    margin: 4rem auto;
                }
                .brand-title {
                    font-size: 3rem;
                    font-weight: 800;
                    margin-bottom: 0.5rem;
                    color: #ffffff;
                }
                .brand-tagline {
                    color: var(--text-muted);
                    margin-bottom: 2.5rem;
                    font-size: 1.1rem;
                }
                .input-group {
                    margin-bottom: 1.5rem;
                    text-align: left;
                }
                label {
                    display: block;
                    margin-bottom: 0.75rem;
                    color: var(--text-muted);
                    font-size: 0.85rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .auth-btn { 
                    width: 100%; 
                    padding: 1rem;
                    font-size: 1rem;
                    border-radius: var(--border-radius-md);
                }
                .skip-btn {
                    margin-top: 1rem;
                    background: transparent;
                    border: 1px solid var(--surface-border);
                    color: var(--text-muted);
                    font-size: 0.9rem;
                }
                .skip-btn:hover {
                    color: var(--text-main);
                    border-color: var(--text-main);
                }
            </style>
            <div class="glass-panel login-container">
                <h1 class="brand-title">Wadlgaudi</h1>
                <p class="brand-tagline">Your Decentralized Activity Tracker</p>
                
                <form>
                    <div class="input-group">
                        <label for="handle">Bluesky Handle</label>
                        <input type="text" id="handle" required placeholder="yourname.bsky.social" spellcheck="false" />
                    </div>
                    <button type="submit" class="auth-btn">Connect with AT Protocol</button>
                    <button type="button" id="skip-btn" class="auth-btn skip-btn">Continue without login</button>
                </form>
            </div>
        `;
    }
}

customElements.define('w-login', WLogin);
