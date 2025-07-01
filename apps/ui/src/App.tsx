import "./App.css";
import L from "leaflet";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  formatTimestamp,
  WebSocketEvents,
  type InitialStatePayload,
  type LocationData,
  type LocationUpdatePayload,
  type Tracker,
} from "@live-tracker/shared";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

// Fix for default Leaflet icon not showing up in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

const BACKEND_URL = "http://localhost:3000";

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [locations, setLocations] = useState<Record<string, LocationData>>({});
  const [selectedTracker, setSelectedTracker] = useState<Tracker | null>(null);

  useEffect(() => {
    // Establish WebSocket connection with auth token
    const newSocket = io(BACKEND_URL, {
      query: { token: "secret-auth-token" },
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Connected to WebSocket server");
      setIsConnected(true);
      newSocket.emit(WebSocketEvents.REQUEST_INITIAL_STATE);
    });

    newSocket.on("disconnect", () => {
      console.log("Disconnected from WebSocket server");
      setIsConnected(false);
    });

    newSocket.on(
      WebSocketEvents.INITIAL_STATE,
      (payload: InitialStatePayload) => {
        console.log("Received initial state:", payload);
        setTrackers(payload.trackers);
        setLocations(payload.locations);
      }
    );

    newSocket.on(
      WebSocketEvents.LOCATION_UPDATE,
      (payload: LocationUpdatePayload) => {
        setLocations((prevLocations) => ({
          ...prevLocations,
          [payload.trackerId]: payload,
        }));
      }
    );

    return () => {
      newSocket.close();
    };
  }, []);

  const center: L.LatLngExpression = [-6.2607, 106.8107]; // Jakarta

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif" }}>
      <div
        style={{
          width: "300px",
          borderRight: "1px solid #ccc",
          padding: "10px",
          overflowY: "auto",
        }}
      >
        <h2>Live Trackers</h2>
        <p>
          Status:{" "}
          <span style={{ color: isConnected ? "green" : "red" }}>
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </p>
        <hr />
        <ul>
          {trackers.map((tracker) => (
            <li
              key={tracker.id}
              onClick={() => setSelectedTracker(tracker)}
              style={{
                padding: "8px",
                cursor: "pointer",
                backgroundColor:
                  selectedTracker?.id === tracker.id
                    ? "#e0e0e0"
                    : "transparent",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: "12px",
                  height: "12px",
                  backgroundColor: tracker.color,
                  marginRight: "8px",
                  borderRadius: "50%",
                }}
              ></span>
              {tracker.name}
            </li>
          ))}
        </ul>
      </div>
      <div style={{ flex: 1 }}>
        <MapContainer
          center={center}
          zoom={14}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {Object.values(locations).map((loc) => {
            const tracker = trackers.find((t) => t.id === loc.trackerId);
            if (!tracker) return null;
            return (
              <Marker key={loc.trackerId} position={[loc.lat, loc.lng]}>
                <Popup>
                  <b>{tracker.name}</b>
                  <br />
                  Lat: {loc.lat.toFixed(4)}, Lng: {loc.lng.toFixed(4)}
                  <br />
                  Last seen: {formatTimestamp(loc.timestamp)}
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}

export default App;
