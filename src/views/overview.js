import { initMap, clearPaths, drawRoute, invalidateMapSize, fitMapToRoutes } from '../services/map.js';

let initialized = false;

/**
 * Initializes the overview (map) view. Safe to call multiple times — only
 * runs once. Must be called after the map container is visible in the DOM.
 */
export function initOverview() {
  if (initialized) {
    // Re-invalidate map size in case the container was hidden/shown.
    invalidateMapSize();
    return;
  }
  initMap();
  invalidateMapSize();
  initialized = true;
}

/**
 * Renders routes on the map for the given set of activities.
 * @param {Array} activities - Filtered activity objects.
 */
export function renderOverview(activities) {
  clearPaths();
  activities.forEach(activity => {
    if (activity.coordinates && activity.coordinates.length > 1) {
      drawRoute(activity.coordinates, activity.distanceMeters);
    }
  });
  fitMapToRoutes();
}
