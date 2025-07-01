import {
  type LocationData,
  type Tracker,
  getRandomColor,
} from '@live-tracker/shared';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

const NUMBER_OF_TRACKERS = 10;
const SIMULATION_INTERVAL_MS = 2000; // Update every 2 seconds

@Injectable()
export class TrackingService implements OnModuleInit {
  private readonly logger = new Logger(TrackingService.name);
  private readonly trackers = new Map<string, Tracker>();
  private readonly locations = new Map<string, LocationData>();
  private readonly locationHistory = new Map<string, LocationData[]>();

  // A function to be called by the gateway to emit updates
  public emitLocationUpdate: (payload: LocationData) => void = () => {};

  onModuleInit() {
    this.initializeTrackers();
    this.startSimulation();
    this.logger.log('Tracking service initialized and simulation started.');
  }

  private initializeTrackers() {
    for (let i = 1; i <= NUMBER_OF_TRACKERS; i++) {
      const trackerId = `tracker-${i}`;
      this.trackers.set(trackerId, {
        id: trackerId,
        name: `Vehicle ${i}`,
        color: getRandomColor(),
      });
      // Initial position (e.g., around a central point)
      const initialLocation = this.generateRandomLocation(trackerId);
      this.locations.set(trackerId, initialLocation);
      this.locationHistory.set(trackerId, [initialLocation]);
    }
  }

  private startSimulation() {
    setInterval(() => {
      this.trackers.forEach((tracker) => {
        const newLocation = this.generateRandomLocation(tracker.id);
        const oldLocation = this.locations.get(tracker.id);

        // Only update if position has changed significantly
        if (
          newLocation.lat !== oldLocation?.lat ||
          newLocation.lng !== oldLocation?.lng
        ) {
          this.locations.set(tracker.id, newLocation);
          this.locationHistory.get(tracker.id)?.push(newLocation);

          // Emit the update through the gateway
          if (this.emitLocationUpdate) {
            this.emitLocationUpdate(newLocation);
          }
        }
      });
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

  getInitialLocations(): Record<string, LocationData> {
    return Object.fromEntries(this.locations.entries());
  }

  getTrackerHistory(id: string): LocationData[] {
    return this.locationHistory.get(id) || [];
  }
}
