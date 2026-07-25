import { formatDistance } from '../utils/helpers.js';

let map = null;
let heatmapOverlay = null;
let currentActivities = [];
let initialized = false;

// Heatmap settings (thinnest line = 1 as default)
let currentTheme = 'orange';
let baseWeight = 1;
let blurEnabled = true;

const THEME_COLORS = {
  orange:  '#ff5500',
  cyan:    '#00f3ff',
  magenta: '#ff007f',
  lime:    '#39ff14',
};

/**
 * Syncs JS module settings from current DOM control inputs.
 */
function syncSettingsFromDOM() {
  const themeSelect = document.getElementById('heatmap-theme');
  const weightSlider = document.getElementById('heatmap-weight');
  const blurCheckbox = document.getElementById('heatmap-blur');

  if (themeSelect) currentTheme = themeSelect.value;
  if (weightSlider) baseWeight = parseInt(weightSlider.value, 10) || 1;
  if (blurCheckbox) blurEnabled = blurCheckbox.checked;
}

/**
 * Computes zoom-dependent stroke width and opacity.
 */
function getScaledStyle() {
  const zoom = map ? map.getZoom() : 10;
  // Scaled weight increases with zoom (baseWeight=1 renders thin precise paths)
  const weight = Math.max(1, Math.round(baseWeight * Math.pow(1.12, zoom - 10)));
  // Opacity for thin glowing lines
  const opacity = Math.max(0.06, Math.min(0.45, 0.28 - (zoom - 10) * 0.015));

  return {
    color: THEME_COLORS[currentTheme] || THEME_COLORS.orange,
    weight: weight,
    opacity: opacity,
  };
}

/**
 * Custom Leaflet Layer for rendering additive polyline heatmaps on HTML5 Canvas.
 */
const HeatmapOverlay = L.Layer.extend({
  onAdd: function (mapInstance) {
    this._map = mapInstance;
    if (!this._canvas) {
      this._canvas = L.DomUtil.create('canvas', 'leaflet-heatmap-layer');
      this._canvas.style.position = 'absolute';
      this._canvas.style.top = '0';
      this._canvas.style.left = '0';
      this._canvas.style.pointerEvents = 'none';
    }
    mapInstance.getPanes().overlayPane.appendChild(this._canvas);
    mapInstance.on('move moveend zoomend resize', this.redraw, this);
    this.redraw();
  },

  onRemove: function (mapInstance) {
    if (this._canvas && this._canvas.parentNode) {
      this._canvas.parentNode.removeChild(this._canvas);
    }
    mapInstance.off('move moveend zoomend resize', this.redraw, this);
  },

  redraw: function () {
    if (!this._map || !this._canvas) return;

    const size = this._map.getSize();
    if (size.x <= 0 || size.y <= 0) return;

    // Align canvas dimensions and position to map pane offset
    this._canvas.width = size.x;
    this._canvas.height = size.y;
    
    const topLeft = this._map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(this._canvas, topLeft);

    const ctx = this._canvas.getContext('2d');
    ctx.clearRect(0, 0, size.x, size.y);

    if (!currentActivities || currentActivities.length === 0) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    if (blurEnabled) {
      const zoom = this._map.getZoom();
      const blurRadius = Math.max(1, Math.round(1.2 * Math.pow(1.06, zoom - 10)));
      ctx.filter = `blur(${blurRadius}px)`;
    } else {
      ctx.filter = 'none';
    }

    const style = getScaledStyle();
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.weight;
    ctx.globalAlpha = style.opacity;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    currentActivities.forEach((activity) => {
      if (!activity.coordinates || activity.coordinates.length < 2) return;

      ctx.beginPath();
      let started = false;

      activity.coordinates.forEach((coord) => {
        const pt = this._map.latLngToContainerPoint(coord);
        if (!started) {
          ctx.moveTo(pt.x, pt.y);
          started = true;
        } else {
          ctx.lineTo(pt.x, pt.y);
        }
      });

      ctx.stroke();
    });

    ctx.restore();
  }
});

/**
 * Initializes the heatmap view map and controls.
 */
export function initHeatmap() {
  const container = document.getElementById('heatmap-map');
  if (!container) return;

  if (initialized && map) {
    map.invalidateSize({ animate: false });
    if (heatmapOverlay) heatmapOverlay.redraw();
    return;
  }

  initialized = true;

  // Initialize Leaflet Map
  map = L.map('heatmap-map', {
    zoomControl: true,
    attributionControl: true,
  }).setView([47.5, 11.5], 10);

  // Add CartoDB Dark Matter base tiles
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  // Create custom heatmap canvas overlay
  heatmapOverlay = new HeatmapOverlay();
  heatmapOverlay.addTo(map);

  // ResizeObserver ensures Leaflet updates size as container becomes visible
  const resizeObserver = new ResizeObserver(() => {
    if (map) {
      map.invalidateSize({ animate: false });
      if (heatmapOverlay) heatmapOverlay.redraw();
    }
  });
  resizeObserver.observe(container);

  // Bind UI controls
  setupControls();
}

/**
 * Sets up event listeners for the heatmap control panel.
 */
function setupControls() {
  const themeSelect = document.getElementById('heatmap-theme');
  const weightSlider = document.getElementById('heatmap-weight');
  const blurCheckbox = document.getElementById('heatmap-blur');

  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
      currentTheme = e.target.value;
      if (heatmapOverlay) heatmapOverlay.redraw();
    });
  }

  if (weightSlider) {
    weightSlider.addEventListener('input', (e) => {
      baseWeight = parseInt(e.target.value, 10) || 1;
      if (heatmapOverlay) heatmapOverlay.redraw();
    });
  }

  if (blurCheckbox) {
    blurCheckbox.addEventListener('change', (e) => {
      blurEnabled = e.target.checked;
      if (heatmapOverlay) heatmapOverlay.redraw();
    });
  }
}

/**
 * Renders the heatmap paths for the given list of activities.
 * @param {Array} activities - Filtered activity objects.
 */
export function renderHeatmap(activities) {
  currentActivities = activities || [];

  if (!initialized || !map) {
    initHeatmap();
  }

  syncSettingsFromDOM();

  if (map) {
    map.invalidateSize({ animate: false });
  }

  let totalDistanceMeters = 0;
  let trackCount = 0;
  const bounds = L.latLngBounds([]);

  currentActivities.forEach((activity) => {
    if (!activity.coordinates || activity.coordinates.length < 2) return;

    totalDistanceMeters += activity.distanceMeters || 0;
    trackCount++;

    bounds.extend(activity.coordinates);
  });

  // Update Stats Overlay
  const statsContainer = document.getElementById('heatmap-overlay-stats');
  const countEl = document.getElementById('heatmap-activity-count');
  const distEl = document.getElementById('heatmap-total-distance');

  if (statsContainer && countEl && distEl) {
    if (trackCount > 0) {
      statsContainer.classList.remove('hidden');
      countEl.textContent = `${trackCount} ${trackCount === 1 ? 'activity' : 'activities'}`;
      distEl.textContent = formatDistance(totalDistanceMeters);
    } else {
      statsContainer.classList.add('hidden');
    }
  }

  // Auto-fit bounds if tracks exist
  if (bounds.isValid() && map) {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }

  if (heatmapOverlay) {
    heatmapOverlay.redraw();
  }

  // Trigger double frame check to ensure overlay aligns perfectly when switching views
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (map) map.invalidateSize({ animate: false });
      if (heatmapOverlay) heatmapOverlay.redraw();
    });
  });
}
