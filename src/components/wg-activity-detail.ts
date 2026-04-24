import { LitElement, html, css, unsafeCSS, svg } from 'lit';
import { sharedStyles } from '../styles/shared-styles';
import leafletStyles from 'leaflet/dist/leaflet.css?inline';
import { getActivities, getPassphrase } from '../lib/storage';
import { extractTrackData, parseTcx } from '../lib/activity-parser';
import { decryptSymmetric, deriveMasterKey } from '../lib/crypto';
import { getBlob } from '../lib/blob-storage';
import L from 'leaflet';


export class WGActivityDetail extends LitElement {
    static properties = {
        activityId: { type: String, attribute: 'activity-id' },
        chartAreaPath: { type: String, state: true },
        chartLinePath: { type: String, state: true },
        showMarker: { type: Boolean, state: true },
        markerX: { type: Number, state: true },
        markerY: { type: Number, state: true },
        markerAlt: { type: Number, state: true },
        markerDist: { type: Number, state: true },
        minElev: { type: Number, state: true },
        maxElev: { type: Number, state: true },
        totalDist: { type: String, state: true }
    };

    declare activityId: string | null;
    private map: L.Map | null = null;
    private decodedCalories: number | undefined = undefined;
    private decodedMaxSpeed: number | undefined = undefined;
    private decodedAvgHeartRate: number | undefined = undefined;

    declare chartAreaPath: string;
    declare chartLinePath: string;
    declare showMarker: boolean;
    declare markerX: number;
    declare markerY: number;
    declare markerAlt: number;
    declare markerDist: number;
    declare minElev: number;
    declare maxElev: number;
    declare totalDist: string;
    private trackData: any[] = [];
    private mapMarker: L.Marker | null = null;

    constructor() {
        super();
        this.activityId = null;
        this.chartAreaPath = '';
        this.chartLinePath = '';
        this.showMarker = false;
        this.markerX = 0;
        this.markerY = 0;
        this.markerAlt = 0;
        this.markerDist = 0;
        this.minElev = 0;
        this.maxElev = 0;
        this.totalDist = '0';
    }

    static styles = [
        sharedStyles,
        css`${unsafeCSS(leafletStyles)}`,
        css`
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

            .elevation-card {
                background: #18181B;
                border: 1px solid #333;
                border-radius: 12px;
                padding: 20px 25px 35px 20px;
                color: #fff;
                font-family: 'Inter', sans-serif;
                margin-top: 1rem;
            }
            .elevation-card h3 {
                margin: 0 0 1rem 0;
                font-size: 0.9rem;
                color: #888;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            .chart-svg {
                width: 100%;
                height: 180px;
                overflow: visible;
                cursor: crosshair;
            }
            .axis {
                stroke: #444;
                stroke-width: 1;
            }
            .axis-label {
                fill: #777;
                font-size: 11px;
            }
            .elevation-line {
                stroke: #FFFFFF;
                stroke-width: 2;
                fill: none;
            }
            .elevation-fill {
                fill: rgba(255, 255, 255, 0.05);
            }
            .sync-high-vis-group {
                pointer-events: none;
            }
            .sync-line-high-vis {
                stroke: rgba(255, 255, 255, 0.25);
                stroke-width: 1;
            }
            .sync-dot-overlay {
                position: absolute;
                width: 10px;
                height: 10px;
                background: #FF007F;
                border: 2px solid #FFFFFF;
                border-radius: 50%;
                transform: translate(-50%, -50%);
                pointer-events: none;
                box-shadow: 0 0 12px rgba(255, 0, 127, 0.8);
                z-index: 20;
            }

            .map-sync-marker {
                width: 14px;
                height: 14px;
                background: #FFFFFF;
                border: 3.5px solid #FF007F;
                border-radius: 50%;
                box-shadow: 
                    0 0 0 1.5px rgba(0, 0, 0, 1),
                    0 0 15px rgba(255, 0, 127, 0.6);
                position: relative;
                pointer-events: none;
            }
            .map-sync-marker::after {
                content: '';
                position: absolute;
                top: -3px; left: -3px; right: -3px; bottom: -3px;
                border-radius: 50%;
                border: 2px solid #FF007F;
                animation: sync-pulse 1.5s cubic-bezier(0.24, 0, 0.38, 1) infinite;
            }
            @keyframes sync-pulse {
                0% { transform: scale(1); opacity: 1; }
                100% { transform: scale(3.5); opacity: 0; }
            }

            .sync-tooltip {
                position: absolute;
                background: rgba(26, 26, 28, 0.95);
                border: 1px solid #444;
                border-radius: 4px;
                padding: 4px 8px;
                color: #fff;
                font-family: 'JetBrains Mono', monospace;
                font-size: 11px;
                pointer-events: none;
                transform: translate(-50%, -100%);
                margin-top: -10px;
                z-index: 25;
            }
        `
    ];

    updated(changedProperties: Map<string, any>) {
        if (changedProperties.has('activityId')) {
            this.initMapAndBlob();
        }
    }

    async initMapAndBlob() {
        const activity = getActivities().find(a => a.id === this.activityId);
        if (!activity) return;

        // Cleanup existing map if any
        if (this.map) {
            this.map.remove();
            this.map = null;
        }

        const blob = await getBlob(activity.id);
        const statusEl = this.renderRoot.querySelector('#blob-status');
        const actionsEl = this.renderRoot.querySelector('#blob-actions') as HTMLElement;
        const mapStatusEl = this.renderRoot.querySelector('#map-status') as HTMLElement;

        if (blob) {
            if (statusEl) statusEl.innerHTML = '<span style="color: var(--secondary-color)">✅ Available locally</span>';
            if (actionsEl) actionsEl.style.display = 'block';
            
            this.renderRoot.querySelector('#download-btn')?.addEventListener('click', () => this.downloadDecrypted(activity, blob));

            // Initialize Map
            this.initMap(activity, blob);
        } else {
            if (statusEl) (statusEl as HTMLElement).innerText = 'Not available locally';
            if (mapStatusEl) mapStatusEl.innerText = 'Track data not available locally.';
        }
    }

    render() {
        const activity = getActivities().find(a => a.id === this.activityId);

        if (!activity) {
            return html`<div class="glass-panel" style="padding: 2rem; text-align: center;">Activity not found.</div>`;
        }

        const distanceKm = (activity.distance / 1000).toFixed(2);
        const d = activity.duration;
        const h = Math.floor(d / 3600);
        const m = Math.floor(d % 3600 / 60);
        const s = Math.floor(d % 3600 % 60);
        const durationFmt = h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
        const dateFmt = new Date(activity.createdAt).toLocaleString();
        const maxSpeedKmh = this.decodedMaxSpeed !== undefined 
            ? (this.decodedMaxSpeed * 3.6).toFixed(1) 
            : '--';

        return html`
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
                <div id="map" style="height: 400px; width: 100%; margin: 1.5rem 0; z-index: 1;"></div>

                ${this.chartLinePath ? html`
                  <div class="elevation-card">
                    <h3>Elevation Profile</h3>
                    <div style="position: relative;">
                      <svg class="chart-svg" viewBox="0 0 1000 200" preserveAspectRatio="none"
                           @mousemove="${this._handleChartMove}" @mouseleave="${this._handleChartLeave}">
                        <line x1="50" y1="50" x2="1000" y2="50" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
                        <line x1="50" y1="100" x2="1000" y2="100" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
                        <line x1="50" y1="150" x2="1000" y2="150" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
                        <line x1="50" y1="10" x2="50" y2="180" class="axis" />
                        <text x="45" y="15" text-anchor="end" class="axis-label">${Math.round(this.maxElev)}m</text>
                        <text x="45" y="180" text-anchor="end" class="axis-label">${Math.round(this.minElev)}m</text>
                        <line x1="50" y1="180" x2="1000" y2="180" class="axis" />
                        <text x="50" y="198" text-anchor="start" class="axis-label">0 km</text>
                        <text x="1000" y="198" text-anchor="end" class="axis-label">${this.totalDist} km</text>
                        <path d="${this.chartAreaPath}" class="elevation-fill" />
                        <path d="${this.chartLinePath}" class="elevation-line" />
                        ${this.showMarker ? svg`
                          <g class="sync-high-vis-group">
                            <line x1="${this.markerX}" y1="10" x2="${this.markerX}" y2="180" class="sync-line-high-vis" />
                          </g>
                        ` : ''}
                      </svg>
                      ${this.showMarker ? html`
                        <div class="sync-dot-overlay" 
                             style="left: ${this.markerX / 10}%; top: ${this.markerY / 2}%;">
                        </div>
                        <div class="sync-tooltip"
                             style="left: ${this.markerX / 10}%; top: ${this.markerY / 2}%;">
                          ${Math.round(this.markerAlt)}m | ${(this.markerDist / 1000).toFixed(2)}km
                        </div>
                      ` : ''}
                    </div>
                  </div>
                ` : ''}

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
                            <span class="detail-value">${this.decodedCalories || '--'} kcal</span>
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
                            <span class="detail-label">Average Heart Rate</span>
                            <span class="detail-value">${this.decodedAvgHeartRate || '--'} bpm</span>
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
    }

    private async getActivityKey(activity: any): Promise<CryptoKey> {
        const passphrase = getPassphrase();
        if (!passphrase) {
            throw new Error("Passphrase not found in settings.");
        }
        const masterKey = await deriveMasterKey(passphrase);
        
        const encryptedActivityKeyBytes = Uint8Array.from(atob(activity.encryptedActivityKey), c => c.charCodeAt(0));
        const activityKeyBytes = await decryptSymmetric(masterKey, encryptedActivityKeyBytes);
        
        return crypto.subtle.importKey(
            'raw',
            activityKeyBytes as BufferSource,
            { name: 'AES-GCM' },
            true,
            ['encrypt', 'decrypt']
        );
    }

    async initMap(activity: any, encryptedBlob: Uint8Array) {
        try {
            const key = await this.getActivityKey(activity);
            const decryptedBytes = await decryptSymmetric(key, encryptedBlob);
            const tcxString = new TextDecoder().decode(decryptedBytes);
            
            const summary = parseTcx(tcxString);
            this.decodedCalories = summary.calories;
            this.decodedMaxSpeed = summary.maxSpeed;
            this.decodedAvgHeartRate = summary.averageHeartRate;
            this.requestUpdate();
            
            const trackData = extractTrackData(tcxString);
            this.trackData = trackData;
            
            const coordinates = trackData.map(pt => [pt.lat, pt.lng] as [number, number]);
            if (coordinates.length === 0) {
                const mapStatusEl = this.renderRoot.querySelector('#map-status') as HTMLElement;
                if (mapStatusEl) mapStatusEl.innerText = 'No GPS coordinates found in track.';
                return;
            }

            // Calculate chart paths
            const validPoints = trackData.filter(pt => pt.alt !== undefined && (pt.distance !== undefined || pt.timeOffset !== undefined));
            if (validPoints.length > 1) {
                const getXVal = (pt: any) => pt.distance !== undefined ? pt.distance : pt.timeOffset!;
                const minAlt = Math.min(...validPoints.map(p => p.alt!));
                const maxAlt = Math.max(...validPoints.map(p => p.alt!));
                const maxX = getXVal(validPoints[validPoints.length - 1]);
                this.minElev = minAlt;
                this.maxElev = maxAlt;
                this.totalDist = (maxX / 1000).toFixed(2);
                
                const svgWidth = 950;
                const mapX = (x: number) => maxX > 0 ? 50 + (x / maxX) * svgWidth : 50;
                const mapY = (a: number) => {
                    const range = maxAlt - minAlt || 1;
                    return 180 - ((a - minAlt) / range) * 170;
                };

                let lineD = validPoints.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${mapX(getXVal(pt))} ${mapY(pt.alt!)}`).join(' ');
                this.chartLinePath = lineD;
                this.chartAreaPath = `${lineD} L 1000 180 L 50 180 Z`;
            } else {
                this.chartLinePath = '';
                this.chartAreaPath = '';
            }

            const mapEl = this.renderRoot.querySelector('#map') as HTMLElement;
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
                lineJoin: 'round',
                interactive: false
            }).addTo(this.map);

            // Add track polyline
            const track = L.polyline(coordinates, {
                color: '#00d2ff',
                weight: 4,
                opacity: 1,
                lineJoin: 'round',
                interactive: false // Let hit area handle events
            }).addTo(this.map);

            // Add transparent hit-area for better hover detection
            const hitArea = L.polyline(coordinates, {
                color: 'transparent',
                weight: 50,
                opacity: 0,
                interactive: true
            }).addTo(this.map);

            hitArea.on('mousemove', (e: L.LeafletMouseEvent) => {
                this._syncChartFromMap(e.latlng.lat, e.latlng.lng);
            });
            hitArea.on('mouseout', () => {
                this.showMarker = false;
                this.requestUpdate();
                if (this.mapMarker && this.map) {
                    this.map.removeLayer(this.mapMarker);
                    this.mapMarker = null;
                }
            });

            // Add start/end markers
            L.circleMarker(coordinates[0], {
                radius: 6,
                fillColor: '#10b981',
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 1,
                interactive: false
            }).addTo(this.map);

            L.circleMarker(coordinates[coordinates.length - 1], {
                radius: 6,
                fillColor: '#ef4444',
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 1,
                interactive: false
            }).addTo(this.map);

            // Fit bounds
            this.map.fitBounds(track.getBounds(), { padding: [30, 30] });

            // Remove status message
            this.renderRoot.querySelector('#map-status')?.remove();
        } catch (err) {
            console.error('Map initialization failed', err);
            const mapStatusEl = this.renderRoot.querySelector('#map-status') as HTMLElement;
            if (mapStatusEl) mapStatusEl.innerText = 'Failed to load map track.';
        }
    }

    async downloadDecrypted(activity: any, encryptedBlob: Uint8Array) {
        if (!activity.encryptedActivityKey) {
            alert('No encryption key found for this activity.');
            return;
        }

        try {
            const key = await this.getActivityKey(activity);
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

    private _handleChartMove(e: MouseEvent) {
        if (!this.trackData || this.trackData.length === 0) return;
        const svg = e.currentTarget as SVGSVGElement;
        const rect = svg.getBoundingClientRect();
        
        const clickX = e.clientX - rect.left;
        const viewBoxX = (clickX / rect.width) * 1000;
        
        let chartX = viewBoxX;
        if (chartX < 50) chartX = 50;
        if (chartX > 1000) chartX = 1000;
        
        const ratio = (chartX - 50) / 950;
        
        const validPoints = this.trackData.filter(pt => pt.alt !== undefined && (pt.distance !== undefined || pt.timeOffset !== undefined));
        if (validPoints.length === 0) return;
        const getXVal = (pt: any) => pt.distance !== undefined ? pt.distance : pt.timeOffset!;
        
        const maxX = getXVal(validPoints[validPoints.length - 1]);
        const targetX = ratio * maxX;
        
        let closestIdx = 0;
        let minDiff = Infinity;
        validPoints.forEach((pt, idx) => {
            const diff = Math.abs(getXVal(pt) - targetX);
            if (diff < minDiff) {
                minDiff = diff;
                closestIdx = idx;
            }
        });
        
        const pt = validPoints[closestIdx];
        const minAlt = Math.min(...validPoints.map(p => p.alt!));
        const maxAlt = Math.max(...validPoints.map(p => p.alt!));
        
        const svgWidth = 950;
        const mapX = (x: number) => maxX > 0 ? 50 + (x / maxX) * svgWidth : 50;
        const mapY = (a: number) => {
            const range = maxAlt - minAlt || 1;
            return 180 - ((a - minAlt) / range) * 170;
        };
        
        this.markerX = mapX(getXVal(pt));
        this.markerY = mapY(pt.alt!);
        this.markerAlt = pt.alt!;
        this.markerDist = getXVal(pt);
        this.showMarker = true;
        this.requestUpdate();

        if (this.map) {
            if (!this.mapMarker) {
                this.mapMarker = L.marker([pt.lat, pt.lng], {
                    interactive: false,
                    icon: L.divIcon({
                        className: 'map-sync-marker',
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    })
                }).addTo(this.map);
            } else {
                this.mapMarker.setLatLng([pt.lat, pt.lng]);
            }
        }
    }

    private _handleChartLeave() {
        this.showMarker = false;
        this.requestUpdate();
        if (this.map && this.mapMarker) {
            this.map.removeLayer(this.mapMarker);
            this.mapMarker = null;
        }
    }

    private _syncChartFromMap(lat: number, lng: number) {
        if (!this.trackData || this.trackData.length === 0) return;
        
        let minDiff = Infinity;
        let closestPt: any = null;
        this.trackData.forEach(pt => {
            if (pt.alt === undefined || (pt.distance === undefined && pt.timeOffset === undefined)) return;
            // Simple Euclidean distance in degrees is usually sufficient for picking a point
            const diff = Math.pow(pt.lat - lat, 2) + Math.pow(pt.lng - lng, 2);
            if (diff < minDiff) {
                minDiff = diff;
                closestPt = pt;
            }
        });
        
        if (closestPt) {
            const validPoints = this.trackData.filter(pt => pt.alt !== undefined && (pt.distance !== undefined || pt.timeOffset !== undefined));
            const getXVal = (pt: any) => pt.distance !== undefined ? pt.distance : pt.timeOffset!;
            const maxX = getXVal(validPoints[validPoints.length - 1]);
            const minAlt = Math.min(...validPoints.map(p => p.alt!));
            const maxAlt = Math.max(...validPoints.map(p => p.alt!));
            
            const svgWidth = 950;
            const mapX = (x: number) => maxX > 0 ? 50 + (x / maxX) * svgWidth : 50;
            const mapY = (a: number) => {
                const range = maxAlt - minAlt || 1;
                return 180 - ((a - minAlt) / range) * 170;
            };
            
            this.markerX = mapX(getXVal(closestPt));
            this.markerY = mapY(closestPt.alt!);
            this.markerAlt = closestPt.alt!;
            this.markerDist = getXVal(closestPt);
            this.showMarker = true;
            this.requestUpdate();

            if (this.map) {
                if (!this.mapMarker) {
                    this.mapMarker = L.marker([closestPt.lat, closestPt.lng], {
                        interactive: false,
                        icon: L.divIcon({
                            className: 'map-sync-marker',
                            iconSize: [20, 20],
                            iconAnchor: [10, 10]
                        })
                    }).addTo(this.map);
                } else {
                    this.mapMarker.setLatLng([closestPt.lat, closestPt.lng]);
                }
            }
        }
    }
}

customElements.define('wg-activity-detail', WGActivityDetail);
