import { describe, it, expect } from 'vitest';
import { parseTcx, extractTrackData } from '../src/lib/activity-parser';

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

    it('should extract elevation and time offset', () => {
        const tcxData = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase>
  <Activities>
    <Activity Sport="Biking">
      <Lap StartTime="2023-10-10T08:00:00Z">
        <Track>
          <Trackpoint>
            <Time>2023-10-10T08:00:00Z</Time>
            <Position>
              <LatitudeDegrees>47.2692</LatitudeDegrees>
              <LongitudeDegrees>11.4041</LongitudeDegrees>
            </Position>
            <AltitudeMeters>600.5</AltitudeMeters>
            <DistanceMeters>0</DistanceMeters>
          </Trackpoint>
          <Trackpoint>
            <Time>2023-10-10T08:00:10Z</Time>
            <Position>
              <LatitudeDegrees>47.2700</LatitudeDegrees>
              <LongitudeDegrees>11.4050</LongitudeDegrees>
            </Position>
            <AltitudeMeters>610.0</AltitudeMeters>
            <DistanceMeters>120.5</DistanceMeters>
          </Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;
        const data = extractTrackData(tcxData);
        expect(data.length).toBe(2);
        
        expect(data[0].alt).toBe(600.5);
        expect(data[0].timeOffset).toBe(0);
        expect(data[0].distance).toBe(0);

        expect(data[1].alt).toBe(610.0);
        expect(data[1].timeOffset).toBe(10);
        expect(data[1].distance).toBe(120.5);
    });

    it('should handle missing elevation and time offset gracefully', () => {
        const tcxData = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase>
  <Activities>
    <Activity Sport="Biking">
      <Lap StartTime="2023-10-10T08:00:00Z">
        <Track>
          <Trackpoint>
            <Position>
              <LatitudeDegrees>47.2692</LatitudeDegrees>
              <LongitudeDegrees>11.4041</LongitudeDegrees>
            </Position>
          </Trackpoint>
          <Trackpoint>
            <Time>2023-10-10T08:00:10Z</Time>
            <Position>
              <LatitudeDegrees>47.2700</LatitudeDegrees>
              <LongitudeDegrees>11.4050</LongitudeDegrees>
            </Position>
            <AltitudeMeters>610.0</AltitudeMeters>
          </Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;
        const data = extractTrackData(tcxData);
        expect(data.length).toBe(2);
        
        expect(data[0].alt).toBeUndefined();
        expect(data[0].timeOffset).toBeUndefined();

        expect(data[1].alt).toBe(610.0);
        expect(data[1].timeOffset).toBe(0); // This is the first trackpoint with time, so offset is 0
    });
});
