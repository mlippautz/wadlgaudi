import { agent, loginToBluesky } from './bsky-auth';

class BskyProfile extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.renderLogin();
  }

  renderLogin() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `
      <style>
        .card { padding: 20px; border: 1px solid #ddd; border-radius: 8px; max-width: 300px; }
        input { display: block; margin-bottom: 10px; width: 100%; padding: 8px; box-sizing: border-box; }
        button { background: #0085ff; color: white; border: none; padding: 10px; width: 100%; cursor: pointer; border-radius: 4px; }
      </style>
      <div class="card">
        <h3>Login to Bluesky</h3>
        <input type="text" id="handle" placeholder="handle.bsky.social">
        <input type="password" id="app-pass" placeholder="App Password">
        <button id="login-btn">Login</button>
      </div>
    `;

    this.shadowRoot.querySelector('#login-btn')?.addEventListener('click', async () => {
      const handle = (this.shadowRoot!.querySelector('#handle') as HTMLInputElement).value;
      const pass = (this.shadowRoot!.querySelector('#app-pass') as HTMLInputElement).value;

      const success = await loginToBluesky(handle, pass);
      if (success) {
        this.loadProfile();
      } else {
        alert('Login failed. Check console.');
      }
    });
  }

  async loadProfile() {
    // getProfile uses the authenticated session's DID
    const response = await agent.getProfile({ actor: agent.session?.did || '' });
    const profile = response.data;

    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = `
        <style>
          .profile { text-align: center; font-family: sans-serif; }
          img { width: 80px; height: 80px; border-radius: 50%; border: 2px solid #0085ff; }
          h2 { margin: 10px 0 5px; }
          p { color: #666; }
        </style>
        <div class="profile">
          <img src="${profile.avatar}" alt="avatar">
          <h2>${profile.displayName || profile.handle}</h2>
          <p>@${profile.handle}</p>
          <div>${profile.description || ''}</div>
          <hr>
          <strong>${profile.followersCount}</strong> followers |
          <strong>${profile.followsCount}</strong> following
        </div>
      `;
    }
  }
}

customElements.define('bsky-profile', BskyProfile);

