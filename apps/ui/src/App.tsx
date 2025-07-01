import "./App.css";
import L from "leaflet";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import {
  formatTimestamp,
  WebSocketEvents,
  type InitialStatePayload,
  type LocationData,
  type LocationUpdatePayload,
  type Tracker,
} from "@live-tracker/shared";
import { MapContainer, Marker, Popup, TileLayer, Polyline, useMap } from "react-leaflet";
import { FiMaximize, FiMap, FiZoomIn, FiZoomOut } from 'react-icons/fi';

// Fix for default Leaflet icon not showing up in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

const BACKEND_URL = "http://localhost:3000";

function TrackerPath({ trackerId, path, color, animatedIndex, animatedPosition }: { trackerId: string; path: any; color: string; animatedIndex: number; animatedPosition: [number, number] | null }) {
  const map = useMap();
  if (!path?.points?.length) return null;
  // Convert path points to latlng array
  const positions = path.points.map((p: any) => [p.lat, p.lng]);
  // Highlighted segment: from 0 to animatedIndex (or to animatedPosition if available)
  let highlightPositions = positions.slice(0, animatedIndex + 1);
  if (animatedPosition) {
    highlightPositions = [...highlightPositions, animatedPosition];
  }
  return (
    <>
      {/* Full path (dashed) */}
      <Polyline
        positions={positions}
        pathOptions={{
          color: color + '80', // faded
          weight: 3,
          opacity: 0.5,
          dashArray: '5, 5',
        }}
      />
      {/* Active segment (solid) */}
      {highlightPositions.length > 1 && (
        <Polyline
          positions={highlightPositions}
          pathOptions={{
            color,
            weight: 5,
            opacity: 0.9,
          }}
        />
      )}
    </>
  );
}

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [locations, setLocations] = useState<Record<string, LocationData>>({});
  const [paths, setPaths] = useState<Record<string, any>>({});
  const [selectedTracker, setSelectedTracker] = useState<Tracker | null>(null);
  const [filter, setFilter] = useState("");
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [animatedPositions, setAnimatedPositions] = useState<Record<string, { index: number; t: number; position: [number, number] }>>({});
  const animationRef = useRef<number | null>(null);
  const markerRefs = useRef<Record<string, L.Marker>>({});
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tileLayer, setTileLayer] = useState<'osm' | 'dark'>('osm');

  // Calculate online trackers count
  const onlineTrackersCount = trackers.filter(tracker =>
    locations[tracker.id] && (Date.now() - new Date(locations[tracker.id].timestamp).getTime()) < 5 * 60 * 1000
  ).length;

  useEffect(() => {
    setIsLoading(true);
    const newSocket = io(BACKEND_URL, {
      query: { token: "secret-auth-token" },
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Connected to WebSocket server");
      setIsConnected(true);
      setIsReconnecting(false);
      newSocket.emit(WebSocketEvents.REQUEST_INITIAL_STATE);
    });

    newSocket.on("disconnect", () => {
      console.log("Disconnected from WebSocket server");
      setIsConnected(false);
    });

    newSocket.on("reconnect_attempt", () => {
      setIsReconnecting(true);
    });
    newSocket.on("reconnect", () => {
      setIsReconnecting(false);
    });

    newSocket.on(
      WebSocketEvents.INITIAL_STATE,
      (payload: InitialStatePayload) => {
        console.log("Received initial state:", payload);
        setTrackers(payload.trackers);
        setLocations(payload.locations);
        setPaths(payload.paths || {});
        setIsLoading(false);
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

  // Animation effect
  useEffect(() => {
    if (isLoading) return;
    // Cancel previous animation
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    const animate = () => {
      setAnimatedPositions((prev) => {
        const updated: typeof prev = { ...prev };
        Object.entries(paths).forEach(([trackerId, path]) => {
          const loc = locations[trackerId];
          if (!path?.points?.length || !loc) return;
          // Find the closest segment
          let idx = path.points.findIndex((p: any) => Math.abs(p.lat - loc.lat) < 1e-6 && Math.abs(p.lng - loc.lng) < 1e-6);
          if (idx === -1) idx = path.currentPointIndex || 0;
          // Interpolate between idx-1 and idx
          const fromIdx = Math.max(0, idx - 1);
          const toIdx = idx;
          const from = path.points[fromIdx];
          const to = path.points[toIdx];
          // Calculate t based on time since last update (simulate smooth movement)
          const interval = 2000; // ms, should match backend
          const now = Date.now();
          const lastUpdate = loc.timestamp;
          const t = Math.min(1, Math.max(0, (now - lastUpdate) / interval));
          // Linear interpolation
          const lat = from.lat + (to.lat - from.lat) * t;
          const lng = from.lng + (to.lng - from.lng) * t;
          updated[trackerId] = { index: fromIdx, t, position: [lat, lng] };
        });
        return updated;
      });
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [paths, locations, isLoading]);

  // Open popup when selectedTracker changes
  useEffect(() => {
    if (selectedTracker && markerRefs.current[selectedTracker.id]) {
      markerRefs.current[selectedTracker.id].openPopup();
    }
  }, [selectedTracker]);

  const center: L.LatLngExpression = [-6.2607, 106.8107]; // Jakarta

  // Handle tracker selection and center map on it
  const handleTrackerSelect = (tracker: Tracker) => {
    setSelectedTracker(tracker);
    const loc = locations[tracker.id];
    if (loc && mapRef.current) {
      mapRef.current.flyTo([loc.lat, loc.lng], 15, {
        duration: 1,
        animate: true,
      });
    }
  };

  useEffect(() => {
    // Initialize map ref when map is ready
    if (mapRef.current) return;
    const handleMapReady = (e: any) => {
      mapRef.current = e.target;
    };
    
    const mapElement = document.querySelector('.leaflet-container');
    if (mapElement) {
      mapElement.addEventListener('load', handleMapReady);
      return () => {
        mapElement.removeEventListener('load', handleMapReady);
      };
    }
  }, []);

  // Fullscreen handlers
  const handleFullscreen = () => {
    const el = mapContainerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Layer switch handler
  const handleLayerSwitch = () => {
    setTileLayer((prev) => (prev === 'osm' ? 'dark' : 'osm'));
  };

  // Zoom handlers
  const handleZoomIn = () => {
    if (mapRef.current) mapRef.current.setZoom(mapRef.current.getZoom() + 1);
  };
  const handleZoomOut = () => {
    if (mapRef.current) mapRef.current.setZoom(mapRef.current.getZoom() - 1);
  };

  return (
    <div className="app-root no-sidebar">
      <header className="app-header">
        <h1>Live Tracker</h1>
        <div className="connection-status">
          <span className={`status-dot ${isConnected ? 'online' : isReconnecting ? 'reconnecting' : 'offline'}`}></span>
          <span className="status-text">
            {isConnected ? 'Connected' : isReconnecting ? 'Reconnecting...' : 'Disconnected'}
          </span>
        </div>
      </header>
      
      <main className="main-content centered-layout">
        <div className="tracker-list-card">
          <div className="tracker-list-header">
            <h2>Fleet Overview</h2>
            <span className="online-count">
              {onlineTrackersCount} of {trackers.length} online
            </span>
          </div>
          
          <div className="search-container">
            <input
              type="text"
              placeholder="Search trackers..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="tracker-search-input"
            />
            <span className="search-icon">🔍</span>
          </div>
          
          {isLoading ? (
            <div className="loading-trackers">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="tracker-item-skeleton">
                  <div className="skeleton-avatar"></div>
                  <div className="skeleton-details">
                    <div className="skeleton-line"></div>
                    <div className="skeleton-line short"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ul className="tracker-list">
              {trackers
                .filter(tracker =>
                  tracker.name.toLowerCase().includes(filter.toLowerCase()) ||
                  tracker.id.toLowerCase().includes(filter.toLowerCase())
                )
                .map((tracker) => {
                  const loc = locations[tracker.id];
                  const isSelected = selectedTracker?.id === tracker.id;
                  const isOnline = loc && (Date.now() - new Date(loc.timestamp).getTime()) < 5 * 60 * 1000;
                  const path = paths[tracker.id];
                  
                  return (
                    <li
                      key={tracker.id}
                      className={`tracker-item ${isSelected ? 'selected' : ''} ${isOnline ? 'online' : 'offline'}`}
                      onClick={() => handleTrackerSelect(tracker)}
                    >
                      <div className="tracker-status" style={{ backgroundColor: tracker.color }}></div>
                      <div className="tracker-info">
                        <div className="tracker-name">{tracker.name}</div>
                        {loc ? (
                          <div className="tracker-last-seen">
                            {isOnline ? 'Online' : 'Offline'} • {formatTimestamp(loc.timestamp)}
                          </div>
                        ) : (
                          <div className="tracker-last-seen">No location data</div>
                        )}
                        {/* Route info */}
                        {path?.distance && path?.duration && (
                          <div className="tracker-route-info">
                            <span>Distance: {(path.distance / 1000).toFixed(2)} km</span> • <span>ETA: {Math.round(path.duration / 60)} min</span>
                          </div>
                        )}
                      </div>
                      <div className="tracker-arrow">›</div>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
        
        <div className="map-container" ref={mapContainerRef}>
          {isLoading ? (
            <div className="map-loading">
              <div className="spinner"></div>
              <p>Loading map...</p>
            </div>
          ) : (
            <MapContainer
              center={center}
              zoom={14}
              style={{ height: "100%", width: "100%" }}
              zoomControl={false}
              // whenReady={(e: any) => { mapRef.current = e.target; }}
            >
              {tileLayer === 'osm' ? (
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
              ) : (
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> contributors'
                />
              )}
              
              {/* Render paths first (so they appear below markers) */}
              {Object.entries(paths).map(([trackerId, path]) => {
                const tracker = trackers.find(t => t.id === trackerId);
                if (!tracker) return null;
                const anim = animatedPositions[trackerId];
                return (
                  <TrackerPath
                    key={`path-${trackerId}`}
                    trackerId={trackerId}
                    path={path}
                    color={tracker.color}
                    animatedIndex={anim?.index || 0}
                    animatedPosition={anim?.position || null}
                  />
                );
              })}
              
              {/* Then render animated markers on top */}
              {Object.entries(animatedPositions).map(([trackerId, anim]) => {
                const tracker = trackers.find((t) => t.id === trackerId);
                const path = paths[trackerId];
                if (!tracker || !path) return null;
                const isOnline = locations[trackerId] && (Date.now() - new Date(locations[trackerId].timestamp).getTime()) < 5 * 60 * 1000;
                return (
                  <Marker
                    key={trackerId}
                    position={anim.position}
                    icon={L.divIcon({
                      html: `<div class="custom-marker" style="background-color: ${tracker.color}${!isOnline ? '80' : ''}"><div class="pulse"></div></div>`,
                      className: '',
                      iconSize: [24, 24],
                      iconAnchor: [12, 24]
                    })}
                    ref={ref => { if (ref) markerRefs.current[trackerId] = ref; }}
                  >
                    <Popup>
                      <div className="marker-popup">
                        <h4>{tracker.name}</h4>
                        <div className={`popup-status ${isOnline ? 'online' : 'offline'}`}>{isOnline ? 'Online' : 'Offline'}</div>
                        <div className="popup-coords">{anim.position[0].toFixed(6)}, {anim.position[1].toFixed(6)}</div>
                        <div className="popup-time">Last update: {locations[trackerId] ? formatTimestamp(locations[trackerId].timestamp) : ''}</div>
                        {/* Route info */}
                        {path?.distance && path?.duration && (
                          <div className="popup-route-info">
                            <span>Distance: {(path.distance / 1000).toFixed(2)} km</span> • <span>ETA: {Math.round(path.duration / 60)} min</span>
                          </div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          )}
          
          <div className="map-controls">
            <button className="map-control-btn" title="Fullscreen" onClick={handleFullscreen}>
              <FiMaximize className="icon" />
            </button>
            <button className="map-control-btn" title="Layers" onClick={handleLayerSwitch}>
              <FiMap className="icon" />
            </button>
            <div className="zoom-controls">
              <button className="zoom-btn" title="Zoom in" onClick={handleZoomIn}><FiZoomIn /></button>
              <button className="zoom-btn" title="Zoom out" onClick={handleZoomOut}><FiZoomOut /></button>
            </div>
          </div>
          
          <div className="map-attribution">
            &copy; OpenStreetMap contributors
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
