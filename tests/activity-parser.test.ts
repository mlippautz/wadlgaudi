import { describe, it, expect } from 'vitest';
import { parseTcx } from '../src/lib/activity-parser';

describe('Activity Parser', () => {
    it('should parse a standard TCX string correctly', () => {
        const tcxData = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase>
  <Activities>
    <Activity Sport="Biking">
      <Lap StartTime="2023-10-10T08:00:00Z">
        <TotalTimeSeconds>3600</TotalTimeSeconds>
        <DistanceMeters>25000</DistanceMeters>
        <Track>
          <Trackpoint>
            <Position>
              <LatitudeDegrees>47.2692</LatitudeDegrees>
              <LongitudeDegrees>11.4041</LongitudeDegrees>
            </Position>
          </Trackpoint>
          <Trackpoint>
            <Position>
              <LatitudeDegrees>47.2700</LatitudeDegrees>
              <LongitudeDegrees>11.4050</LongitudeDegrees>
            </Position>
          </Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

        const summary = parseTcx(tcxData);
        expect(summary.sportType).toBe('Biking');
        expect(summary.distance).toBe(25000);
        expect(summary.duration).toBe(3600);
        expect(summary.polyline).toBeDefined();
        // encoded polyline for those two points should be a non-empty string
        expect(summary.polyline.length).toBeGreaterThan(0);
    });

    it('should throw an error for invalid TCX', () => {
        expect(() => parseTcx('<InvalidXml></InvalidXml>')).toThrow('Invalid TCX: No Activity found');
    });
});
