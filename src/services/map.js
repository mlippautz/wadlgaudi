/**
 * Leaflet Map Service wrapper.
 * Interacts with the global `L` Leaflet instance loaded via script tags.
 */

let map = null;
let pathGroup = null;
let colorIndex = 0;

let currentBaseKey = 'dark';
let activeBaseLayer = null;
const activeOverlays = {};

const neonColors = [
  '#39FF14', // Neon Green
  '#00F3FF', // Neon Cyan
  '#FF007F', // Neon Pink
  '#FF5F00', // Neon Orange
  '#E0FF00', // Neon Yellow
  '#8A2BE2'  // Neon Violet
];

// Configuration of available base layers
const BASE_LAYERS = {
  dark: {
    name: 'Dark Matter',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    options: {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
      zIndex: 1
    }
  },
  osm: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      zIndex: 1
    }
  },
  topo: {
    name: 'OpenTopoMap',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    options: {
      attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
      maxZoom: 17,
      zIndex: 1
    }
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      maxZoom: 18,
      zIndex: 1
    }
  }
};

// Configuration of extra base layers accessible via dropdown picker
const EXTRA_LAYERS = {
  positron: {
    name: 'CartoDB Positron',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    options: {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
      zIndex: 1
    }
  },
  hot: {
    name: 'OSM Humanitarian',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    options: {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by Humanitarian OpenStreetMap Team',
      maxZoom: 19,
      zIndex: 1
    }
  },
  cyclosm: {
    name: 'CyclOSM (Cycling)',
    url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    options: {
      attribution: '&copy; CyclOSM &copy; OpenStreetMap',
      maxZoom: 20,
      zIndex: 1
    }
  },
  mtbmap: {
    name: 'MtbMap (MTB)',
    url: 'http://tile.mtbmap.cz/mtbmap_tiles/{z}/{x}/{y}.png',
    options: {
      attribution: '&copy; OpenStreetMap contributors &amp; USGS',
      maxZoom: 18,
      zIndex: 1
    }
  }
};

// Configuration of overlays (drawn on top of the base layers)
const OVERLAY_LAYERS = {
  hiking: {
    name: 'Hiking Trails',
    url: 'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png',
    options: {
      attribution: 'Map data &copy; <a href="https://waymarkedtrails.org">Waymarked Trails</a>',
      maxZoom: 18,
      zIndex: 5
    }
  },
  cycling: {
    name: 'Cycling Trails',
    url: 'https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png',
    options: {
      attribution: 'Map data &copy; <a href="https://waymarkedtrails.org">Waymarked Trails</a>',
      maxZoom: 18,
      zIndex: 5
    }
  }
};

/**
 * Changes the active base layer tile layer.
 * @param {string} key - Key of the layer in BASE_LAYERS or EXTRA_LAYERS.
 */
function setBaseLayer(key) {
  if (activeBaseLayer) {
    map.removeLayer(activeBaseLayer);
  }
  
  let config = BASE_LAYERS[key] || EXTRA_LAYERS[key];
  if (!config) {
    key = 'dark';
    config = BASE_LAYERS[key];
  }
  
  activeBaseLayer = L.tileLayer(config.url, config.options);
  activeBaseLayer.addTo(map);
  currentBaseKey = key;
  localStorage.setItem('wadlgaudi_base_layer', key);
}

/**
 * Toggles an overlay layer on or off.
 * @param {string} key - Key of the layer in OVERLAY_LAYERS.
 * @param {boolean} enable - Whether to enable or disable the overlay.
 */
function toggleOverlay(key, enable) {
  const isCurrentlyActive = !!activeOverlays[key];
  if (enable && !isCurrentlyActive) {
    const config = OVERLAY_LAYERS[key];
    if (config) {
      const layer = L.tileLayer(config.url, config.options);
      layer.addTo(map);
      activeOverlays[key] = layer;
    }
  } else if (!enable && isCurrentlyActive) {
    map.removeLayer(activeOverlays[key]);
    delete activeOverlays[key];
  }
  
  const activeKeys = Object.keys(activeOverlays);
  localStorage.setItem('wadlgaudi_active_overlays', JSON.stringify(activeKeys));
}

// Custom Leaflet Control for selecting base maps and overlays
const MapSelector = L.Control.extend({
  options: {
    position: 'topright'
  },
  onAdd: function (mapInstance) {
    const container = L.DomUtil.create('div', 'map-selector-control');
    
    // Disable click/scroll propagation so interactions don't affect the map itself
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
    
    // Toggle button with custom SVG icon
    const toggleButton = L.DomUtil.create('button', 'map-selector-toggle-btn', container);
    toggleButton.setAttribute('title', 'Map Layers');
    toggleButton.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
        <polyline points="2 17 12 22 22 17"></polyline>
        <polyline points="2 12 12 17 22 12"></polyline>
      </svg>
    `;
    
    // Collapsible Panel container
    const panel = L.DomUtil.create('div', 'map-selector-panel hidden', container);
    
    // Panel Header
    const header = L.DomUtil.create('div', 'map-selector-header', panel);
    header.innerHTML = '<h4>Map Layers</h4>';
    
    // Base Maps Grid
    L.DomUtil.create('div', 'map-selector-section-title', panel).textContent = 'Base Maps';
    const presetGrid = L.DomUtil.create('div', 'map-selector-grid', panel);
    
    const baseCards = {};
    Object.entries(BASE_LAYERS).forEach(([key, config]) => {
      const card = L.DomUtil.create('button', `map-selector-card ${key === currentBaseKey ? 'active' : ''}`, presetGrid);
      card.innerHTML = `
        <span class="map-selector-card-indicator"></span>
        <span class="map-selector-card-label">${config.name}</span>
      `;
      baseCards[key] = card;
      
      L.DomEvent.on(card, 'click', () => {
        Object.values(baseCards).forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        moreSelect.value = ''; // Reset the picker dropdown
        setBaseLayer(key);
      });
    });
    
    // More Open Maps Dropdown Selector
    L.DomUtil.create('div', 'map-selector-section-title', panel).textContent = 'More Open Maps';
    const moreSelect = L.DomUtil.create('select', 'map-selector-select', panel);
    
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.text = '-- Select a map style --';
    moreSelect.appendChild(defaultOpt);
    
    Object.entries(EXTRA_LAYERS).forEach(([key, config]) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.text = config.name;
      if (key === currentBaseKey) {
        opt.selected = true;
        Object.values(baseCards).forEach(c => c.classList.remove('active'));
      }
      moreSelect.appendChild(opt);
    });
    
    L.DomEvent.on(moreSelect, 'change', (e) => {
      const val = e.target.value;
      if (val) {
        Object.values(baseCards).forEach(c => c.classList.remove('active'));
        setBaseLayer(val);
      }
    });
    
    // Overlays Section (Hiking, Cycling trails)
    L.DomUtil.create('div', 'map-selector-section-title', panel).textContent = 'Overlays';
    const overlaysContainer = L.DomUtil.create('div', 'map-selector-overlays', panel);
    
    Object.entries(OVERLAY_LAYERS).forEach(([key, config]) => {
      const row = L.DomUtil.create('label', 'map-selector-overlay-row', overlaysContainer);
      const active = !!activeOverlays[key];
      row.innerHTML = `
        <span class="map-selector-overlay-label">${config.name}</span>
        <div class="map-selector-switch-container">
          <input type="checkbox" class="map-selector-switch-checkbox" ${active ? 'checked' : ''} data-key="${key}">
          <span class="map-selector-switch-slider"></span>
        </div>
      `;
      
      const checkbox = row.querySelector('input');
      L.DomEvent.on(checkbox, 'change', (e) => {
        toggleOverlay(key, e.target.checked);
      });
    });
    
    // Action handler to collapse/expand
    L.DomEvent.on(toggleButton, 'click', (e) => {
      panel.classList.toggle('hidden');
      toggleButton.classList.toggle('active');
    });
    
    // Close panel if clicked outside the control container
    L.DomEvent.on(document, 'click', (e) => {
      if (!container.contains(e.target)) {
        panel.classList.add('hidden');
        toggleButton.classList.remove('active');
      }
    });
    
    return container;
  }
});

/**
 * Initializes the Leaflet map in the specified HTML container element.
 * @param {string} elementId - The ID of the div container.
 */
export function initMap(elementId = 'map') {
  if (map) return; // Map already loaded

  // Create Leaflet map container
  map = L.map(elementId).setView([47.0, 11.0], 7); // Default zoom center (European Alps / generic)

  // Observe map element size changes (modern replacement for window resize listeners)
  const mapElement = document.getElementById(elementId);
  if (mapElement) {
    const resizeObserver = new ResizeObserver(() => {
      if (map) {
        map.invalidateSize();
      }
    });
    resizeObserver.observe(mapElement);
  }

  // Load the initial saved base map or fallback to dark
  currentBaseKey = localStorage.getItem('wadlgaudi_base_layer') || 'dark';
  setBaseLayer(currentBaseKey);

  // Load any previously active overlay states
  let savedOverlays = [];
  try {
    const raw = localStorage.getItem('wadlgaudi_active_overlays');
    if (raw) {
      savedOverlays = JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to parse saved overlays:', err);
  }
  
  savedOverlays.forEach(key => {
    toggleOverlay(key, true);
  });

  // Add the custom map layer selector control to the map
  new MapSelector().addTo(map);

  // Group to contain all polyline layers for bounding box zoom calculations
  pathGroup = L.featureGroup().addTo(map);
}

/**
 * Resets the path layers group and color selector index on map refresh.
 */
export function clearPaths() {
  if (pathGroup) {
    pathGroup.clearLayers();
  }
  colorIndex = 0;
}

/**
 * Recalculates map size to fix resizing layout issues after UI state changes.
 */
export function invalidateMapSize() {
  if (map) {
    map.invalidateSize();
  }
}

/**
 * Draws a polyline route path with a random neon color and optional tooltip.
 * @param {Array<[number, number]>} coordinates - GPS coordinates.
 * @param {number|null} distanceMeters - Distance of the route in meters.
 */
export function drawRoute(coordinates, distanceMeters) {
  if (!map || !pathGroup || !coordinates || coordinates.length <= 1) return;

  const pathColor = neonColors[colorIndex % neonColors.length];
  colorIndex++;

  const polyline = L.polyline(coordinates, {
    color: pathColor,
    weight: 3.5,
    opacity: 0.85
  }).addTo(pathGroup);

  // Add a clean tooltip showing the distance
  if (distanceMeters) {
    const distanceKm = (distanceMeters / 1000).toFixed(2);
    polyline.bindTooltip(`${distanceKm} km`, { sticky: true });
  }
}

/**
 * Fits the map view to the bounding box of all drawn routes.
 * Constraints prevent excessive zoom on short tracks or single-point paths.
 */
export function fitMapToRoutes() {
  if (!map || !pathGroup || pathGroup.getLayers().length === 0) return;
  
  map.fitBounds(pathGroup.getBounds(), {
    padding: [40, 40],
    maxZoom: 15,
    animate: true
  });
}
