import { XMLParser } from 'fast-xml-parser';
import polyline from '@mapbox/polyline';

export interface ActivitySummary {
    sportType: string;
    distance: number; // meters
    duration: number; // seconds
    polyline: string;
    calories?: number;
    maxSpeed?: number; // m/s
}

/**
 * Parses a TCX XML string and extracts the high-level summary and compressed polyline.
 */
export function parseTcx(tcxString: string): ActivitySummary {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const parsed = parser.parse(tcxString);

    const activity = parsed?.TrainingCenterDatabase?.Activities?.Activity;
    if (!activity) throw new Error("Invalid TCX: No Activity found");

    // Can be an array or single object depending on fast-xml-parser behavior
    const act = Array.isArray(activity) ? activity[0] : activity;
    const sportType = act["@_Sport"] || "Unknown";
    
    // Laps can be an array or single object
    const laps = Array.isArray(act.Lap) ? act.Lap : [act.Lap].filter(Boolean);
    
    let totalDistance = 0;
    let totalDuration = 0;
    let totalCalories = 0;
    let maxSpeed = 0;
    const coordinates: [number, number][] = [];

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
                if (tp.Position && tp.Position.LatitudeDegrees && tp.Position.LongitudeDegrees) {
                    coordinates.push([
                        Number(tp.Position.LatitudeDegrees),
                        Number(tp.Position.LongitudeDegrees)
                    ]);
                }
            }
        }
    }

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
        maxSpeed: maxSpeed
    };
}
