export interface Tracker {
  id: string;
  name: string;
  color: string; // A color to represent the tracker on the map
}

export interface LocationData {
  trackerId: string;
  lat: number;
  lng: number;
  timestamp: number; // Unix timestamp
}

// WebSocket Event Payloads
export const WebSocketEvents = {
  LOCATION_UPDATE: "locationUpdate",
  TRACKER_HISTORY: "trackerHistory",
  INITIAL_STATE: "initialState",
  REQUEST_INITIAL_STATE: "requestInitialState",
};

export interface LocationUpdatePayload extends LocationData {}

export interface InitialStatePayload {
  trackers: Tracker[];
  locations: Record<string, LocationData>; // A map of trackerId to their last known location
}
