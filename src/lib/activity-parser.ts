import { XMLParser } from 'fast-xml-parser';
import polyline from '@mapbox/polyline';

export interface ActivitySummary {
    sportType: string;
    distance: number; // meters
    duration: number; // seconds
    polyline: string;
    calories?: number;
    maxSpeed?: number; // m/s
    averageHeartRate?: number; // bpm
}

export interface TrackPointData {
    lat: number;
    lng: number;
    alt?: number;
    distance?: number;
    timeOffset?: number; // seconds since start
}

/**
 * Extracts all track points with elevation and time data from a TCX XML string.
 */
export function extractTrackData(tcxString: string): TrackPointData[] {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const parsed = parser.parse(tcxString);

    const activity = parsed?.TrainingCenterDatabase?.Activities?.Activity;
    if (!activity) return [];

    const act = Array.isArray(activity) ? activity[0] : activity;
    const laps = Array.isArray(act.Lap) ? act.Lap : [act.Lap].filter(Boolean);
    
    const trackData: TrackPointData[] = [];
    let startTime: number | null = null;

    for (const lap of laps) {
        const tracks = Array.isArray(lap.Track) ? lap.Track : [lap.Track].filter(Boolean);
        for (const track of tracks) {
            const trackpoints = Array.isArray(track.Trackpoint) ? track.Trackpoint : [track.Trackpoint].filter(Boolean);
            for (const tp of trackpoints) {
                if (tp.Position && tp.Position.LatitudeDegrees && tp.Position.LongitudeDegrees) {
                    const lat = Number(tp.Position.LatitudeDegrees);
                    const lng = Number(tp.Position.LongitudeDegrees);
                    const alt = tp.AltitudeMeters !== undefined ? Number(tp.AltitudeMeters) : undefined;
                    const distance = tp.DistanceMeters !== undefined ? Number(tp.DistanceMeters) : undefined;
                    
                    let timeOffset = undefined;
                    if (tp.Time) {
                        const t = new Date(tp.Time).getTime();
                        if (startTime === null) startTime = t;
                        timeOffset = (t - startTime) / 1000;
                    }

                    trackData.push({ lat, lng, alt, distance, timeOffset });
                }
            }
        }
    }
    return trackData;
}

/**
 * Extracts all coordinates from a TCX XML string.
 */
export function extractCoordinates(tcxString: string): [number, number][] {
    return extractTrackData(tcxString).map(pt => [pt.lat, pt.lng]);
}

/**
 * Parses a TCX XML string and extracts the high-level summary and compressed polyline.
 */
export function parseTcx(tcxString: string): ActivitySummary {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const parsed = parser.parse(tcxString);

    const activity = parsed?.TrainingCenterDatabase?.Activities?.Activity;
    if (!activity) throw new Error("Invalid TCX: No Activity found");

    const act = Array.isArray(activity) ? activity[0] : activity;
    const sportType = act["@_Sport"] || "Unknown";
    const laps = Array.isArray(act.Lap) ? act.Lap : [act.Lap].filter(Boolean);
    
    let totalDistance = 0;
    let totalDuration = 0;
    let totalCalories = 0;
    let maxSpeed = 0;
    let totalHr = 0;
    let hrCount = 0;

    for (const lap of laps) {
        totalDistance += Number(lap.DistanceMeters || 0);
        totalDuration += Number(lap.TotalTimeSeconds || 0);
        totalCalories += Number(lap.Calories || 0);
        if (Number(lap.MaximumSpeed || 0) > maxSpeed) {
            maxSpeed = Number(lap.MaximumSpeed);
        }
        
        const tracks = Array.isArray(lap.Track) ? lap.Track : [lap.Track].filter(Boolean);
        for (const track of tracks) {
            const trackpoints = Array.isArray(track.Trackpoint) ? track.Trackpoint : [track.Trackpoint].filter(Boolean);
            for (const tp of trackpoints) {
                const hr = tp.HeartRateBpm?.Value;
                if (hr) {
                    totalHr += Number(hr);
                    hrCount++;
                }
            }
        }
    }
    const avgHeartRate = hrCount > 0 ? Math.round(totalHr / hrCount) : undefined;

    const coordinates = extractCoordinates(tcxString);

    // Downsample coordinates if too many (keep every Nth point to ensure polyline is small)
    const MAX_POINTS = 200;
    const step = Math.max(1, Math.floor(coordinates.length / MAX_POINTS));
    const downsampled = coordinates.filter((_, i) => i % step === 0);

    const encodedPolyline = polyline.encode(downsampled);

    return {
        sportType,
        distance: totalDistance,
        duration: totalDuration,
        polyline: encodedPolyline,
        calories: totalCalories,
        maxSpeed: maxSpeed,
        averageHeartRate: avgHeartRate
    };
}
