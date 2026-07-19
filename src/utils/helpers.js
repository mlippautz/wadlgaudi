/**
 * Formats a size in bytes into a human-readable string.
 * @param {number|string} bytes - The number of bytes.
 * @param {number} decimals - Number of decimal places.
 * @returns {string} Formatted byte size string.
 */
export function formatBytes(bytes, decimals = 1) {
  if (bytes === undefined || bytes === null || bytes === '-') return '-';
  const numBytes = parseInt(bytes);
  if (isNaN(numBytes)) return '-';
  if (numBytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(numBytes) / Math.log(k));
  
  return parseFloat((numBytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Escapes characters in a string to construct safe HTML content.
 * @param {string} str - The string to escape.
 * @returns {string} The escaped HTML string.
 */
export function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Parses and validates raw position coordinates. Converted from semicircles if needed.
 * @param {object} record - The record object containing Garmin semicircles or decimal position data.
 * @returns {[number, number]|null} [latitude, longitude] or null if invalid.
 */
export function getRecordCoordinates(record) {
  let lat = record.position_lat;
  let lng = record.position_long;
  
  if (lat === undefined || lng === undefined) return null;
  
  // Convert Garmin semicircles to standard decimal degrees if needed
  if (Number.isInteger(lat) && Math.abs(lat) > 180) {
    lat = lat * (180 / 2147483648);
  }
  if (Number.isInteger(lng) && Math.abs(lng) > 180) {
    lng = lng * (180 / 2147483648);
  }
  
  // Verify valid bounds
  if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
    return [lat, lng];
  }
  return null;
}
