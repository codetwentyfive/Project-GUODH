declare module 'mediasoup-client' {
  export class Device {
    load(options: { routerRtpCapabilities: any }): Promise<void>;
    createSendTransport(options: any): Transport;
  }

  export interface Transport {
    on(event: 'connect', callback: (params: { dtlsParameters: any }, callback: () => void, errback: (error: Error) => void) => void): void;
    on(event: 'produce', callback: (params: { kind: string; rtpParameters: any }, callback: (params: { id: string }) => void, errback: (error: Error) => void) => void): void;
    produce(options: { track: MediaStreamTrack }): Promise<Producer>;
    close(): void;
  }

  export interface Producer {
    close(): void;
  }

  export namespace types {
    export interface Producer {
      close(): void;
    }
  }
}

interface TransportOptions {
  id: string;
  iceParameters: any;
  iceCandidates: any[];
  dtlsParameters: any;
  routerRtpCapabilities: any;
} 