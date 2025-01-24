import { Socket as BaseSocket } from 'socket.io-client';

interface ServerToClientEvents {
  'transport-options': (options: TransportOptions) => void;
  'producer-created': (params: { id: string }) => void;
  'connection-error': (params: { error: string }) => void;
}

interface ClientToServerEvents {
  'join-room': (params: { roomId: string; patientId: string }) => void;
  'connect-transport': (params: { dtlsParameters: any }) => void;
  'produce': (params: { kind: string; rtpParameters: any }) => void;
}

declare module 'socket.io-client' {
  export interface Socket extends BaseSocket<ServerToClientEvents, ClientToServerEvents> {}
} 