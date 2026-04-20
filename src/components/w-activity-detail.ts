import { getActivities } from '../lib/storage';
import { extractCoordinates } from '../lib/activity-parser';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export class WActivityDetail extends HTMLElement {
    static get observedAttributes() {
        return ['activity-id'];
    }

    private map: L.Map | null = null;

    connectedCallback() {
        this.render();
    }

    attributeChangedCallback() {
        this.render();
    }

    render() {
        const id = this.getAttribute('activity-id');
        const activity = getActivities().find(a => a.id === id);

        if (!activity) {
            this.innerHTML = `<div class="glass-panel" style="padding: 2rem; text-align: center;">Activity not found.</div>`;
            return;
        }

        // Cleanup existing map if any
        if (this.map) {
            this.map.remove();
            this.map = null;
        }

        const distanceKm = (activity.distance / 1000).toFixed(2);
        const d = activity.duration;
        const h = Math.floor(d / 3600);
        const m = Math.floor(d % 3600 / 60);
        const s = Math.floor(d % 3600 % 60);
        const durationFmt = h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
        const dateFmt = new Date(activity.createdAt).toLocaleString();

        // Convert max speed from m/s to km/h
        const maxSpeedKmh = ((activity.maxSpeed || 0) * 3.6).toFixed(1);

        this.innerHTML = `
            <style>
                .detail-container {
                    animation: fadeIn 0.3s ease;
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
                .hero-stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 1.5rem;
                    margin: 2rem 0;
                }
                .stat-card {
                    padding: 1.5rem;
                    text-align: center;
                    border: 1px solid var(--surface-border);
                }
                .stat-card .label {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    margin-bottom: 0.5rem;
                }
                .stat-card .value {
                    font-size: 2rem;
                    font-weight: 800;
                    color: var(--text-main);
                }
                .stat-card .unit {
                    font-size: 1rem;
                    font-weight: 400;
                    color: var(--text-muted);
                }
                .header-section {
                    margin-bottom: 2rem;
                }
                .sport-tag {
                    display: inline-block;
                    padding: 0.25rem 0.75rem;
                    background: rgba(255,255,255,0.1);
                    border-radius: 4px;
                    font-weight: 700;
                    text-transform: uppercase;
                    font-size: 0.8rem;
                    margin-bottom: 1rem;
                }
                h2 { font-size: 2.5rem; margin-bottom: 0.5rem; }
                .timestamp { color: var(--text-muted); }
                
                #map-status {
                    padding: 1.5rem;
                    text-align: center;
                    color: var(--text-muted);
                    background: rgba(255,255,255,0.05);
                    border-radius: var(--border-radius-lg);
                    margin: 1.5rem 0;
                }

                .more-details {
                    margin-top: 3rem;
                    padding-top: 2rem;
                    border-top: 1px solid var(--surface-border);
                }
                .detail-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }
                .detail-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 0.75rem 0;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }
                .detail-label { color: var(--text-muted); }
                .detail-value { font-weight: 600; }
            </style>
            <div class="detail-container">
                <a href="#/feed" class="back-link">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                    Back to Feed
                </a>

                <div class="header-section">
                    <span class="sport-tag">${activity.sportType}</span>
                    <h2>Activity Summary</h2>
                    <p class="timestamp">${dateFmt}</p>
                </div>

                <div id="map-status">Loading track...</div>
                <div id="map"></div>

                <div class="hero-stats">
                    <div class="stat-card glass-panel">
                        <div class="label">Distance</div>
                        <div class="value">${distanceKm} <span class="unit">km</span></div>
                    </div>
                    <div class="stat-card glass-panel">
                        <div class="label">Duration</div>
                        <div class="value">${durationFmt}</div>
                    </div>
                </div>

                <div class="more-details">
                    <h3>Deep Dive</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Calories</span>
                            <span class="detail-value">${activity.calories || '--'} kcal</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Max Speed</span>
                            <span class="detail-value">${maxSpeedKmh} km/h</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Average Pace</span>
                            <span class="detail-value">${this.calculatePace(activity.duration, activity.distance)} min/km</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Data Points</span>
                            <span class="detail-value" id="blob-status">Checking local storage...</span>
                        </div>
                    </div>
                    <div id="blob-actions" style="margin-top: 1.5rem; display: none;">
                        <button id="download-btn" class="btn-icon" style="width: 100%; justify-content: center; background: rgba(16, 185, 129, 0.1); border-color: var(--secondary-color); color: var(--secondary-color);">
                            Download Decrypted TCX
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.checkBlob(activity);
    }

    async checkBlob(activity: any) {
        const { getBlob } = await import('../lib/blob-storage');
        const blob = await getBlob(activity.id);
        const statusEl = this.querySelector('#blob-status');
        const actionsEl = this.querySelector('#blob-actions') as HTMLElement;
        const mapStatusEl = this.querySelector('#map-status') as HTMLElement;

        if (blob) {
            if (statusEl) statusEl.innerHTML = '<span style="color: var(--secondary-color)">✅ Available locally</span>';
            if (actionsEl) actionsEl.style.display = 'block';
            
            this.querySelector('#download-btn')?.addEventListener('click', () => this.downloadDecrypted(activity, blob));

            // Initialize Map
            this.initMap(activity, blob);
        } else {
            if (statusEl) (statusEl as HTMLElement).innerText = 'Not available locally';
            if (mapStatusEl) mapStatusEl.innerText = 'Track data not available locally.';
        }
    }

    async initMap(activity: any, encryptedBlob: Uint8Array) {
        try {
            const { importKeyFromBase64, decryptSymmetric } = await import('../lib/crypto');
            const key = await importKeyFromBase64(activity.encryptionKey);
            const decryptedBytes = await decryptSymmetric(key, encryptedBlob);
            const tcxString = new TextDecoder().decode(decryptedBytes);
            
            const coordinates = extractCoordinates(tcxString);
            if (coordinates.length === 0) {
                const mapStatusEl = this.querySelector('#map-status') as HTMLElement;
                if (mapStatusEl) mapStatusEl.innerText = 'No GPS coordinates found in track.';
                return;
            }

            const mapEl = this.querySelector('#map') as HTMLElement;
            if (!mapEl) return;

            // Initialize Leaflet
            this.map = L.map(mapEl, {
                scrollWheelZoom: false // Better UX for scrolling pages
            });

            // OpenTopoMap layer
            L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                maxZoom: 17,
                attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
            }).addTo(this.map);

            // Add track halo (improves readability on complex topo details)
            L.polyline(coordinates, {
                color: '#000000',
                weight: 9,
                opacity: 0.4,
                lineJoin: 'round'
            }).addTo(this.map);

            // Add track polyline
            const track = L.polyline(coordinates, {
                color: '#ffffff',
                weight: 4,
                opacity: 1,
                lineJoin: 'round'
            }).addTo(this.map);

            // Add start/end markers
            L.circleMarker(coordinates[0], {
                radius: 6,
                fillColor: '#10b981',
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 1
            }).addTo(this.map);

            L.circleMarker(coordinates[coordinates.length - 1], {
                radius: 6,
                fillColor: '#ef4444',
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 1
            }).addTo(this.map);

            // Fit bounds
            this.map.fitBounds(track.getBounds(), { padding: [30, 30] });

            // Remove status message
            this.querySelector('#map-status')?.remove();
        } catch (err) {
            console.error('Map initialization failed', err);
            const mapStatusEl = this.querySelector('#map-status') as HTMLElement;
            if (mapStatusEl) mapStatusEl.innerText = 'Failed to load map track.';
        }
    }

    async downloadDecrypted(activity: any, encryptedBlob: Uint8Array) {
        if (!activity.encryptionKey) {
            alert('No encryption key found for this activity.');
            return;
        }

        try {
            const { importKeyFromBase64, decryptSymmetric } = await import('../lib/crypto');
            const key = await importKeyFromBase64(activity.encryptionKey);
            const decryptedBytes = await decryptSymmetric(key, encryptedBlob);
            const decryptedString = new TextDecoder().decode(decryptedBytes);

            const blob = new Blob([decryptedString], { type: 'application/vnd.garmin.tcx+xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `activity-${activity.id.substring(0, 8)}.tcx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Decryption failed', err);
            alert('Failed to decrypt activity: ' + (err as Error).message);
        }
    }

    calculatePace(duration: number, distance: number): string {
        if (!distance) return '--';
        const paceMin = (duration / 60) / (distance / 1000);
        const mins = Math.floor(paceMin);
        const secs = Math.floor((paceMin - mins) * 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

customElements.define('w-activity-detail', WActivityDetail);
