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
 * Parses a free-form search query to extract ID, date filters, sport filters, and text filters.
 * Date patterns like "2026", "2026-07", or "2026-07-12" are detected and separated from text queries.
 * @param {string} query - The raw search input.
 * @returns {{ id: string|null, date: string|null, sport: string|null, text: string|null }} Parsed filter components.
 */
export function parseSearchQuery(query) {
  if (!query || !query.trim()) return { id: null, date: null, sport: null, text: null };
  
  const trimmed = query.trim();
  let id = null;
  let date = null;
  let sport = null;
  let remaining = trimmed;
  
  // 1. Match and extract ID pattern: id=123, id:123, id="some name.fit", id:'some name.fit'
  // Supports quoted values (to handle filenames with spaces/dots) and bare alphanumeric tokens.
  const idMatch = remaining.match(/\bid[=:]\s*(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_.%-]+))/i);
  if (idMatch) {
    id = idMatch[1] ?? idMatch[2] ?? idMatch[3];
    // Remove the match and clean up extra whitespace
    remaining = remaining.replace(idMatch[0], '').replace(/\s+/g, ' ').trim();
  }

  // 2. Match sport pattern: sport=running, sport:cycling, sport="skiing"
  const sportMatch = remaining.match(/\bsport[=:]\s*["']?([A-Za-z0-9_-]+)["']?/i);
  if (sportMatch) {
    sport = sportMatch[1].toLowerCase();
    remaining = remaining.replace(sportMatch[0], '').replace(/\s+/g, ' ').trim();
  }

  // 3. Match date patterns: YYYY, YYYY-MM, or YYYY-MM-DD
  const dateMatch = remaining.match(/\b(\d{4}(?:-\d{2}(?:-\d{2})?)?)\b/);
  if (dateMatch) {
    date = dateMatch[1];
    // Remove the date part from the remaining text
    remaining = remaining.replace(dateMatch[0], '').replace(/\s+/g, ' ').trim();
  }
  
  const text = remaining.length > 0 ? remaining : null;
  return { id, date, sport, text };
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


/**
 * Temporarily removes the id= token from a query so that other manipulations
 * (date/sport) do not accidentally match content inside the filename.
 * @param {string} query
 * @returns {{ idToken: string|null, remaining: string }}
 */
export function extractIdToken(query) {
  const idRegex = /\bid[=:]\s*(?:"[^"]*"|'[^']*'|[A-Za-z0-9_.%-]+)/i;
  const match = query.match(idRegex);
  if (match) {
    const remaining = query.replace(match[0], '').replace(/\s+/g, ' ').trim();
    return { idToken: match[0], remaining };
  }
  return { idToken: null, remaining: query };
}

/**
 * Updates a search query string to add, replace, or toggle a sport filter parameter.
 * @param {string} query - The current search query.
 * @param {string|null} targetSport - The sport to set (running, cycling, skiing, or null to clear).
 * @returns {string} The updated search query.
 */
export function updateSearchQueryWithSport(query, targetSport) {
  // Shield the id= token so its value is never matched by the sport regex.
  const { idToken, remaining: base } = extractIdToken(query);

  const sportRegex = /\bsport[=:]\s*["']?([A-Za-z0-9_-]+)["']?/i;
  const match = base.match(sportRegex);

  let result;
  if (targetSport === null) {
    result = match ? base.replace(sportRegex, '').replace(/\s+/g, ' ').trim() : base.trim();
  } else if (match) {
    // If the active sport matches, toggle it off by removing it
    if (match[1].toLowerCase() === targetSport.toLowerCase()) {
      result = base.replace(sportRegex, '').replace(/\s+/g, ' ').trim();
    } else {
      // Otherwise, replace it with the new sport
      result = base.replace(sportRegex, `sport=${targetSport}`).trim();
    }
  } else {
    // Append new sport filter
    result = base.trim() ? `${base.trim()} sport=${targetSport}` : `sport=${targetSport}`;
  }

  return idToken ? (result ? `${result} ${idToken}` : idToken) : result;
}

/**
 * Updates a search query string to add, replace, or toggle a date filter parameter.
 * @param {string} query - The current search query.
 * @param {string|null} targetDate - The date string to set (YYYY, YYYY-MM, or null to clear).
 * @returns {string} The updated search query.
 */
export function updateSearchQueryWithDate(query, targetDate) {
  // Shield the id= token so its value is never matched by the date regex.
  const { idToken, remaining: base } = extractIdToken(query);

  const dateRegex = /\b(\d{4}(?:-\d{2}(?:-\d{2})?)?)\b/;
  const match = base.match(dateRegex);

  let result;
  if (targetDate === null) {
    result = match ? base.replace(dateRegex, '').replace(/\s+/g, ' ').trim() : base.trim();
  } else if (match) {
    // If the active date matches, toggle it off by removing it
    if (match[1] === targetDate) {
      result = base.replace(dateRegex, '').replace(/\s+/g, ' ').trim();
    } else {
      // Otherwise, replace it with the new date
      result = base.replace(dateRegex, targetDate).trim();
    }
  } else {
    // Append new date filter
    result = base.trim() ? `${base.trim()} ${targetDate}` : targetDate;
  }

  return idToken ? (result ? `${result} ${idToken}` : idToken) : result;
}
