import {
    WebSocketGateway,
    SubscribeMessage,
    WebSocketServer,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
  } from '@nestjs/websockets';
  import { Server, Socket } from 'socket.io';
  import { Logger } from '@nestjs/common';
  import { TrackingService } from './tracking.service';
  import { WebSocketEvents, type InitialStatePayload, type LocationUpdatePayload } from '@live-tracker/shared';
  
  @WebSocketGateway({ cors: { origin: '*' } })
  export class TrackingGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;
  
    private readonly logger = new Logger(TrackingGateway.name);
  
    constructor(private readonly trackingService: TrackingService) {
      // Connect the service's emit function to the server's broadcast
      this.trackingService.emitLocationUpdate = (payload: LocationUpdatePayload) => {
        this.server.emit(WebSocketEvents.LOCATION_UPDATE, payload);
      };
    }
  
    afterInit() {
      this.logger.log('WebSocket Gateway Initialized');
    }
  
    handleConnection(client: Socket) {
      // Basic auth check
      const token = client.handshake.query.token;
      if (token !== 'secret-auth-token') {
        this.logger.warn(`Client connection rejected due to invalid token: ${client.id}`);
        client.disconnect();
        return;
      }
      this.logger.log(`Client connected: ${client.id}`);
    }
  
    handleDisconnect(client: Socket) {
      this.logger.log(`Client disconnected: ${client.id}`);
    }
  
    @SubscribeMessage(WebSocketEvents.REQUEST_INITIAL_STATE)
    handleInitialStateRequest(client: Socket): void {
      const initialState: InitialStatePayload = {
        trackers: this.trackingService.getAllTrackers(),
        locations: this.trackingService.getInitialLocations(),
      };
      client.emit(WebSocketEvents.INITIAL_STATE, initialState);
    }
  }