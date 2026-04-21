import { LitElement, html, css } from 'lit';
import { sharedStyles } from '../styles/shared-styles';
import polyline from '@mapbox/polyline';

export class WActivityCard extends LitElement {
    static properties = {
        sport: { type: String },
        distance: { type: String },
        duration: { type: String },
        date: { type: String },
        polyline: { type: String },
        id: { type: String },
    };

    declare sport: string;
    declare distance: string;
    declare duration: string;
    declare date: string;
    declare polyline: string;
    declare id: string;

    constructor() {
        super();
        this.sport = 'Activity';
        this.distance = '0';
        this.duration = '0';
        this.date = new Date().toLocaleDateString();
        this.polyline = '';
        this.id = '';
    }

    static styles = [
        sharedStyles,
        css`
            .card {
                padding: 1.25rem 1.5rem;
                margin-bottom: 1rem;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                position: relative;
                border: 1px solid var(--surface-border);
                display: flex;
                flex-direction: column;
            }
            .card:hover {
                transform: translateY(-4px);
                border-color: rgba(255, 255, 255, 0.3);
                box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
            }
            .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 0.75rem;
            }
            .sport-badge {
                background: rgba(255, 255, 255, 0.08);
                color: #ffffff;
                padding: 0.2rem 0.6rem;
                border-radius: 4px;
                font-size: 0.65rem;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.1em;
            }
            .date {
                color: var(--text-muted);
                font-size: 0.75rem;
            }
            .main-content {
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
                gap: 1.5rem;
            }
            .stats {
                display: flex;
                gap: 2rem;
            }
            .stat-block .label {
                font-size: 0.65rem;
                color: var(--text-muted);
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin-bottom: 0.25rem;
            }
            .stat-block .value {
                font-size: 1.75rem;
                font-weight: 800;
                color: var(--text-main);
                line-height: 1;
            }
            .stat-block .unit {
                font-size: 0.9rem;
                font-weight: 400;
                color: var(--text-muted);
            }
            .mini-map {
                width: 120px;
                height: 60px;
                opacity: 0.7;
                filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.2));
            }
            .mini-map polyline {
                stroke: #ffffff;
                stroke-width: 2.5;
                stroke-linecap: round;
                stroke-linejoin: round;
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
                opacity: 0.5;
            }
            .delete-btn:hover {
                color: #ef4444;
                opacity: 1;
            }
        `
    ];

    render() {
        const distanceKm = (Number(this.distance) / 1000).toFixed(2);
        const d = Number(this.duration);
        const h = Math.floor(d / 3600);
        const m = Math.floor(d % 3600 / 60);
        const s = Math.floor(d % 3600 % 60);
        const durationFmt = h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;

        return html`
            <a href="#/activity/${this.id}" style="text-decoration: none; color: inherit; display: block;">
                <div class="glass-panel card">
                    <div class="header">
                        <span class="sport-badge">${this.sport}</span>
                        <div style="display: flex; align-items: center;">
                            <span class="date">${this.date}</span>
                            <button class="delete-btn" title="Delete Activity" @click="${this.onDelete}">&times;</button>
                        </div>
                    </div>
                    <div class="main-content">
                        <div class="stats">
                            <div class="stat-block">
                                <div class="label">Distance</div>
                                <div class="value">${distanceKm}<span class="unit">km</span></div>
                            </div>
                            <div class="stat-block">
                                <div class="label">Time</div>
                                <div class="value">${durationFmt}</div>
                            </div>
                        </div>
                        ${this.renderMiniMap(this.polyline)}
                    </div>
                </div>
            </a>
        `;
    }

    onDelete(e: Event) {
        e.preventDefault(); // Prevent navigation to detail view
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this activity?')) {
            this.dispatchEvent(new CustomEvent('delete-activity', {
                bubbles: true,
                composed: true,
                detail: { id: this.id }
            }));
        }
    }

    private renderMiniMap(polylineStr: string) {
        if (!polylineStr || polylineStr === '""') return '';
        
        try {
            const pts = polyline.decode(polylineStr);
            if (pts.length < 2) return '';

            const lats = pts.map(p => p[0]);
            const lngs = pts.map(p => p[1]);
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);
            const minLng = Math.min(...lngs);
            const maxLng = Math.max(...lngs);

            const width = 120;
            const height = 60;
            const padding = 6;

            const scale = (val: number, min: number, max: number, size: number) => {
                if (max === min) return size / 2;
                return padding + (val - min) / (max - min) * (size - 2 * padding);
            };

            const svgPts = pts.map(p => {
                const x = scale(p[1], minLng, maxLng, width);
                const y = height - scale(p[0], minLat, maxLat, height);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
            }).join(' ');

            return html`
                <div class="mini-map">
                    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
                        <polyline points="${svgPts}" fill="none" />
                    </svg>
                </div>
            `;
        } catch (e) {
            console.error('Failed to render mini-map', e);
            return '';
        }
    }
}

customElements.define('w-activity-card', WActivityCard);
