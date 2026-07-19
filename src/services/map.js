/**
 * Leaflet Map Service wrapper.
 * Interacts with the global `L` Leaflet instance loaded via script tags.
 */

let map = null;
let pathGroup = null;
let colorIndex = 0;

const neonColors = [
  '#39FF14', // Neon Green
  '#00F3FF', // Neon Cyan
  '#FF007F', // Neon Pink
  '#FF5F00', // Neon Orange
  '#E0FF00', // Neon Yellow
  '#8A2BE2'  // Neon Violet
];

/**
 * Initializes the Leaflet map in the specified HTML container element.
 * @param {string} elementId - The ID of the div container.
 */
export function initMap(elementId = 'map') {
  if (map) return; // Map already loaded

  // Create Leaflet map container
  map = L.map(elementId).setView([47.0, 11.0], 7); // Default zoom center (European Alps / generic)

  // Load a sleek, premium dark theme from CartoDB mapping tiles
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);

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

  // Adjust map camera bounds to fit all coordinate paths
  map.fitBounds(pathGroup.getBounds(), { padding: [40, 40] });
}
