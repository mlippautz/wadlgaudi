import FitParser from 'fit-file-parser';
import { getAccessToken } from './google.js';
import { getRecordCoordinates } from '../utils/helpers.js';

/**
 * Downloads a binary file's raw content from Google Drive by its file ID.
 * @param {string} fileId - Unique Google Drive file ID.
 * @returns {Promise<ArrayBuffer>} The file data as an ArrayBuffer.
 */
export async function downloadFileContent(fileId) {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Access token not found. User is not authenticated.');
  }

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to download binary file (Status ${response.status})`);
  }
  
  return await response.arrayBuffer();
}

/**
 * Parses Garmin FIT file binary data to extract session distance and route GPS coordinates.
 * @param {ArrayBuffer} arrayBuffer - The raw FIT binary data.
 * @returns {Promise<{distanceMeters: number|null, coordinates: Array<[number, number]>, startTime: Date|null, sport: string|null}|null>}
 */
export function parseFitData(arrayBuffer) {
  return new Promise((resolve) => {
    try {
      const fitParser = new FitParser({
        force: true,
        speedUnit: 'km/h',
        lengthUnit: 'm',
      });
      
      fitParser.parse(arrayBuffer, (error, data) => {
        if (error || !data) {
          console.error('FIT parse error:', error);
          resolve(null);
        } else {
          // Extract distance
          let distanceMeters = null;
          if (data.sessions && data.sessions.length > 0) {
            distanceMeters = data.sessions[0].total_distance;
          } else if (data.records && data.records.length > 0) {
            for (let i = data.records.length - 1; i >= 0; i--) {
              if (data.records[i].distance !== undefined) {
                distanceMeters = data.records[i].distance;
                break;
              }
            }
          }

          // Extract GPS coordinate path
          const coordinates = [];
          if (data.records) {
            data.records.forEach(rec => {
              const coords = getRecordCoordinates(rec);
              if (coords) {
                coordinates.push(coords);
              }
            });
          }

          // Extract activity date and sport type from session
          const startTime = (data.sessions && data.sessions.length > 0 && data.sessions[0].start_time)
            ? new Date(data.sessions[0].start_time)
            : null;
          const sport = (data.sessions && data.sessions.length > 0)
            ? (data.sessions[0].sport || null)
            : null;

          resolve({ distanceMeters, coordinates, startTime, sport });
        }
      });
    } catch (err) {
      console.error('FIT parser synchronous exception:', err);
      resolve(null);
    }
  });
}
