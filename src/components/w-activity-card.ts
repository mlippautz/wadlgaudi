export class WActivityCard extends HTMLElement {
    static get observedAttributes() {
        return ['sport', 'distance', 'duration', 'date'];
    }

    connectedCallback() {
        this.render();
        this.querySelector('.delete-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this activity?')) {
                this.dispatchEvent(new CustomEvent('delete-activity', {
                    bubbles: true,
                    composed: true,
                    detail: { id: this.getAttribute('id') }
                }));
            }
        });
    }

    attributeChangedCallback() {
        this.render();
    }

    render() {
        const sport = this.getAttribute('sport') || 'Activity';
        const distance = this.getAttribute('distance') || '0';
        const duration = this.getAttribute('duration') || '0';
        const date = this.getAttribute('date') || new Date().toLocaleDateString();

        const distanceKm = (Number(distance) / 1000).toFixed(2);
        
        // Simple duration formatter (seconds to HH:MM:SS)
        const d = Number(duration);
        const h = Math.floor(d / 3600);
        const m = Math.floor(d % 3600 / 60);
        const s = Math.floor(d % 3600 % 60);
        const durationFmt = h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;

        this.innerHTML = `
            <style>
                .card {
                    padding: 1.5rem;
                    margin-bottom: 1rem;
                    transition: all 0.2s ease;
                    position: relative;
                    border: 1px solid var(--surface-border);
                }
                .card:hover {
                    transform: translateY(-2px);
                    border-color: rgba(255, 255, 255, 0.4);
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }
                .sport-badge {
                    background: rgba(255, 255, 255, 0.1);
                    color: #ffffff;
                    padding: 0.25rem 0.75rem;
                    border-radius: 4px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                }
                .date {
                    color: var(--text-muted);
                    font-size: 0.8rem;
                }
                .delete-btn {
                    background: transparent;
                    border: none;
                    color: var(--text-muted);
                    cursor: pointer;
                    font-size: 1.2rem;
                    padding: 0 0.5rem;
                    transition: color 0.2s ease;
                    margin-left: 0.5rem;
                }
                .delete-btn:hover {
                    color: #ef4444;
                }
                .stats {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                    margin-top: 1rem;
                }
                .stat-block .label {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                }
                .stat-block .value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: var(--text-main);
                }
            </style>
            <a href="#/activity/${this.getAttribute('id')}" style="text-decoration: none; color: inherit; display: block;">
                <div class="glass-panel card">
                    <div class="header">
                        <span class="sport-badge">${sport}</span>
                        <div style="display: flex; align-items: center;">
                            <span class="date">${date}</span>
                            <button class="delete-btn" title="Delete Activity">&times;</button>
                        </div>
                    </div>
                    <div class="stats">
                        <div class="stat-block">
                            <div class="label">Distance</div>
                            <div class="value">${distanceKm} <span style="font-size:1rem;font-weight:normal">km</span></div>
                        </div>
                        <div class="stat-block">
                            <div class="label">Time</div>
                            <div class="value">${durationFmt}</div>
                        </div>
                    </div>
                </div>
            </a>
        `;
    }
}

customElements.define('w-activity-card', WActivityCard);
