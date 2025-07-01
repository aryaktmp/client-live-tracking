import {
  type LocationData,
  type Tracker,
  getRandomColor,
  type PathPoint,
  type TrackerPath,
} from '@live-tracker/shared';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

const NUMBER_OF_TRACKERS = 10;
const SIMULATION_INTERVAL_MS = 2000;
const PATH_LENGTH = 10; // Number of points in each path
const PATH_RADIUS_KM = 0.05; // Radius for generating path points in kilometers

const JABODETABEK_BBOX = {
  minLat: -6.4371, // Southwest
  minLng: 106.6894,
  maxLat: -5.9441, // Northeast
  maxLng: 107.0717,
};

function getRandomPointInBbox() {
  const lat =
    Math.random() * (JABODETABEK_BBOX.maxLat - JABODETABEK_BBOX.minLat) +
    JABODETABEK_BBOX.minLat;
  const lng =
    Math.random() * (JABODETABEK_BBOX.maxLng - JABODETABEK_BBOX.minLng) +
    JABODETABEK_BBOX.minLng;
  return { lat, lng };
}

@Injectable()
export class TrackingService implements OnModuleInit {
  private readonly logger = new Logger(TrackingService.name);
  private readonly trackers = new Map<string, Tracker>();
  private readonly locations = new Map<string, LocationData>();
  private readonly locationHistory = new Map<string, LocationData[]>();
  private readonly paths = new Map<string, TrackerPath>();

  // A function to be called by the gateway to emit updates
  public emitLocationUpdate: (payload: LocationData) => void = () => {};
  public emitInitialState: (payload: any) => void = () => {};

  constructor(private configService: ConfigService) {}

  getOrsApiKey() {
    return this.configService.get<string>('ORS_API_KEY');
  }

  onModuleInit() {
    this.initializeTrackers();
    this.startSimulation();
    this.logger.log('Tracking service initialized and simulation started.');
  }

  private async generatePath(trackerId: string): Promise<TrackerPath> {
    const apiKey = this.getOrsApiKey();
    let lastError: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const start = getRandomPointInBbox();
      const end = getRandomPointInBbox();
      try {
        const response = await axios.post(
          'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
          {
            coordinates: [
              [start.lng, start.lat],
              [end.lng, end.lat],
            ],
          },
          {
            headers: {
              Authorization: apiKey,
              'Content-Type': 'application/json',
            },
          },
        );
        const coords =
          response.data.features[0].geometry.coordinates as [number, number][];
        const points: PathPoint[] = coords.map(([lng, lat]) => ({ lat, lng }));
        // Extract distance and duration if available
        const summary = response.data.features[0].properties?.summary || {};
        return {
          points,
          currentPointIndex: 0,
          distance: summary.distance, // in meters
          duration: summary.duration, // in seconds
        };
      } catch (error: any) {
        lastError = error;
        this.logger.error(
          `ORS route generation failed (attempt ${attempt}) for coords: start=(${start.lat},${start.lng}), end=(${end.lat},${end.lng}) - ${error}`,
        );
        if (!error.response || error.response.status !== 404) {
          break;
        }
      }
    }
    this.logger.error(
      `ORS route generation failed after 3 attempts, falling back to random path: ${lastError}`,
    );
    // fallback to old logic
    const baseLat = -6.2607; // Jakarta
    const baseLng = 106.8107;
    const currentLoc = this.locations.get(trackerId) || {
      lat: baseLat,
      lng: baseLng,
    };
    const points: PathPoint[] = [];
    let lastLat = currentLoc.lat;
    let lastLng = currentLoc.lng;
    for (let i = 0; i < PATH_LENGTH; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = (Math.random() * PATH_RADIUS_KM) / 111.32;
      const newLat = lastLat + Math.sin(angle) * distance;
      const newLng =
        lastLng +
        Math.cos(angle) * (distance / Math.cos(lastLat * (Math.PI / 180)));
      points.push({ lat: newLat, lng: newLng });
      lastLat = newLat;
      lastLng = newLng;
    }
    return {
      points,
      currentPointIndex: 0,
      distance: undefined,
      duration: undefined,
    };
  }

  private async initializeTrackers() {
    for (let i = 1; i <= NUMBER_OF_TRACKERS; i++) {
      const trackerId = `tracker-${i}`;
      this.trackers.set(trackerId, {
        id: trackerId,
        name: `Vehicle ${i}`,
        color: getRandomColor(),
      });
      // Generate initial path and position
      const initialPath = await this.generatePath(trackerId);
      this.paths.set(trackerId, initialPath);
      const initialLocation = this.getLocationFromPath(trackerId, 0);
      this.locations.set(trackerId, initialLocation);
      this.locationHistory.set(trackerId, [initialLocation]);
    }
  }

  private getLocationFromPath(
    trackerId: string,
    pointIndex: number,
  ): LocationData {
    const path = this.paths.get(trackerId);
    if (!path || !path.points[pointIndex]) {
      // If no path or invalid index, generate random location
      return this.generateRandomLocation(trackerId);
    }

    const point = path.points[pointIndex];
    return {
      trackerId,
      lat: point.lat,
      lng: point.lng,
      timestamp: Date.now(),
    };
  }

  private startSimulation() {
    setInterval(() => {
      (async () => {
        for (const tracker of this.trackers.values()) {
          const path = this.paths.get(tracker.id);
          if (!path) continue;
          // Move to next point in path
          path.currentPointIndex = path.currentPointIndex + 1;
          // If we've completed the path, generate a new one
          if (path.currentPointIndex >= path.points.length) {
            const newPath = await this.generatePath(tracker.id);
            this.paths.set(tracker.id, newPath);
            path.currentPointIndex = 0;
          }
          const newLocation = this.getLocationFromPath(
            tracker.id,
            path.currentPointIndex,
          );
          this.locations.set(tracker.id, newLocation);
          this.locationHistory.get(tracker.id)?.push(newLocation);
          // Emit the update
          if (this.emitLocationUpdate) {
            this.emitLocationUpdate(newLocation);
          }
        }
      })();
    }, SIMULATION_INTERVAL_MS);
  }

  private generateRandomLocation(trackerId: string): LocationData {
    const baseLat = -6.2607; // Jakarta
    const baseLng = 106.8107;
    const currentLoc = this.locations.get(trackerId);

    const lat = (currentLoc?.lat || baseLat) + (Math.random() - 0.5) * 0.005;
    const lng = (currentLoc?.lng || baseLng) + (Math.random() - 0.5) * 0.005;

    return {
      trackerId,
      lat,
      lng,
      timestamp: Date.now(),
    };
  }

  getAllTrackers(): Tracker[] {
    return Array.from(this.trackers.values());
  }

  getInitialState() {
    return {
      trackers: this.getAllTrackers(),
      locations: Object.fromEntries(this.locations.entries()),
      paths: Object.fromEntries(this.paths.entries()),
    };
  }

  getTrackerHistory(id: string): LocationData[] {
    return this.locationHistory.get(id) || [];
  }
}
