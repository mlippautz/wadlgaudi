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

/**
 * Formats a distance in meters to a human-readable km string.
 * @param {number|null} meters - Distance in meters.
 * @returns {string} Formatted string like "142.35 km" or "-".
 */
export function formatDistance(meters) {
  if (meters === null || meters === undefined) return '-';
  return (meters / 1000).toFixed(2) + ' km';
}

/**
 * Formats a Date object into a month/year header string.
 * @param {Date} date - The date to format.
 * @returns {string} e.g. "July 2026"
 */
export function formatMonth(date) {
  if (!date || !(date instanceof Date)) return 'Unknown';
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Simple case-insensitive substring match.
 * @param {string} query - The search query.
 * @param {string} text - The text to search in.
 * @returns {boolean} True if query is a substring of text (case-insensitive).
 */
export function matchesFuzzy(query, text) {
  if (!query || !text) return false;
  return text.toLowerCase().includes(query.toLowerCase());
}

/**
 * Parses a free-form search query to extract ID, date filters, and text filters.
 * Date patterns like "2026", "2026-07", or "2026-07-12" are detected and separated from text queries.
 * @param {string} query - The raw search input.
 * @returns {{ id: string|null, date: string|null, text: string|null }} Parsed filter components.
 */
export function parseSearchQuery(query) {
  if (!query || !query.trim()) return { id: null, date: null, text: null };
  
  const trimmed = query.trim();
  let id = null;
  let date = null;
  let remaining = trimmed;
  
  // 1. Match and extract ID pattern: id=123, id:123, id="123", id:'123'
  const idMatch = remaining.match(/\bid[=:]\s*["']?([A-Za-z0-9_-]+)["']?/i);
  if (idMatch) {
    id = idMatch[1];
    // Remove the match and clean up extra whitespace
    remaining = remaining.replace(idMatch[0], '').replace(/\s+/g, ' ').trim();
  }

  // 2. Match date patterns: YYYY, YYYY-MM, or YYYY-MM-DD
  const dateMatch = remaining.match(/\b(\d{4}(?:-\d{2}(?:-\d{2})?)?)\b/);
  if (dateMatch) {
    date = dateMatch[1];
    // Remove the date part from the remaining text
    remaining = remaining.replace(dateMatch[0], '').replace(/\s+/g, ' ').trim();
  }
  
  const text = remaining.length > 0 ? remaining : null;
  return { id, date, text };
}

/**
 * Clean activity filename if it matches <date>_<description>.<format>.
 * Date matches YYYY-MM-DD, YYYYMMDD, YYYY.MM.DD, or YYYY_MM_DD.
 * Optionally matches timestamp/time suffix.
 * Returns only the <description>.
 * @param {string} name - The original filename.
 * @returns {string} The cleaned activity name description.
 */
export function cleanActivityName(name) {
  if (!name) return '';
  const regex = /^(\d{4}[-._]?\d{2}[-._]?\d{2})(?:[_\s-](?:\d{2}[:-]\d{2}[:-]\d{2}|\d{6}|\d{2}[_]\d{2}[_]\d{2}))?_(.+)\.([^.]+)$/;
  const match = name.match(regex);
  if (match) {
    return match[2];
  }
  return name;
}

