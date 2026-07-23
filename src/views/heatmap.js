let initialized = false;

/**
 * Initializes the heatmap view. Safe to call multiple times.
 */
export function initHeatmap() {
  if (initialized) return;
  initialized = true;

  const container = document.getElementById('view-heatmap');
  if (!container) return;

  container.innerHTML = `
    <div class="heatmap-placeholder">
      <div class="heatmap-placeholder-icon">🗓️</div>
      <p class="heatmap-placeholder-text">Heatmap coming soon</p>
    </div>
  `;
}

/**
 * Renders the heatmap for the given set of activities.
 * @param {Array} _activities - Filtered activity objects (unused until implemented).
 */
export function renderHeatmap(_activities) {
  // Placeholder — full implementation will go here.
}
