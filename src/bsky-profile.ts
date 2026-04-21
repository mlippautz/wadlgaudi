import { LitElement, html, css } from 'lit';
import { agent, loginToBluesky } from './bsky-auth';

export class BskyProfile extends LitElement {
  static properties = {
    profile: { type: Object },
    loading: { type: Boolean },
  };

  profile: any = null;
  loading = false;

  constructor() {
    super();
  }

  static styles = css`
    .card { padding: 20px; border: 1px solid #ddd; border-radius: 8px; max-width: 300px; }
    input { display: block; margin-bottom: 10px; width: 100%; padding: 8px; box-sizing: border-box; }
    button { background: #0085ff; color: white; border: none; padding: 10px; width: 100%; cursor: pointer; border-radius: 4px; }
    .profile { text-align: center; font-family: sans-serif; }
    img { width: 80px; height: 80px; border-radius: 50%; border: 2px solid #0085ff; }
    h2 { margin: 10px 0 5px; }
    p { color: #666; }
  `;

  render() {
    if (this.profile) {
      return html`
        <div class="profile">
          <img src="${this.profile.avatar}" alt="avatar">
          <h2>${this.profile.displayName || this.profile.handle}</h2>
          <p>@${this.profile.handle}</p>
          <div>${this.profile.description || ''}</div>
          <hr>
          <strong>${this.profile.followersCount}</strong> followers |
          <strong>${this.profile.followsCount}</strong> following
        </div>
      `;
    }

    return html`
      <div class="card">
        <h3>Login to Bluesky</h3>
        <input type="text" id="handle" placeholder="handle.bsky.social">
        <input type="password" id="app-pass" placeholder="App Password">
        <button @click="${this.onLogin}">Login</button>
      </div>
    `;
  }

  async onLogin() {
    const handleInput = this.shadowRoot!.querySelector('#handle') as HTMLInputElement;
    const passInput = this.shadowRoot!.querySelector('#app-pass') as HTMLInputElement;
    
    const success = await loginToBluesky(handleInput.value, passInput.value);
    if (success) {
      this.loadProfile();
    } else {
      alert('Login failed. Check console.');
    }
  }

  async loadProfile() {
    this.loading = true;
    const response = await agent.getProfile({ actor: agent.session?.did || '' });
    this.profile = response.data;
    this.loading = false;
  }
}

customElements.define('bsky-profile', BskyProfile);
