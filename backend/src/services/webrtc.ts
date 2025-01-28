import * as mediasoup from 'mediasoup';
import { Server } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class WebRTCService {
  private io: Server;
  private worker: mediasoup.types.Worker | null = null;
  private rooms: Map<string, mediasoup.types.Router> = new Map();

  constructor(httpServer: HTTPServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST']
      }
    });
    this.initializeMediaSoup();
    this.handleConnections();
  }

  private async initializeMediaSoup() {
    this.worker = await mediasoup.createWorker({
      logLevel: 'warn',
      rtcMinPort: 10000,
      rtcMaxPort: 10100
    });

    console.log('MediaSoup worker created');
  }

  private async createRoom(roomId: string) {
    if (!this.worker) throw new Error('MediaSoup worker not initialized');

    const router = await this.worker.createRouter({
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2
        }
      ]
    });

    this.rooms.set(roomId, router);
    return router;
  }

  private async handleConnections() {
    this.io.on('connection', async (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('join-room', async ({ roomId, patientId }) => {
        try {
          let router = this.rooms.get(roomId);
          if (!router) {
            router = await this.createRoom(roomId);
          }

          // Create WebRTC transport for sending
          const transport = await router.createWebRtcTransport({
            listenIps: [{ ip: process.env.MEDIASOUP_LISTEN_IP || '127.0.0.1' }],
            enableUdp: true,
            enableTcp: true,
            preferUdp: true
          });

          socket.emit('transport-options', {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters
          });

          // Handle transport connection
          socket.on('connect-transport', async ({ dtlsParameters }) => {
            await transport.connect({ dtlsParameters });
          });

          // Handle producer creation (audio stream)
          socket.on('produce', async ({ kind, rtpParameters }) => {
            const producer = await transport.produce({ kind, rtpParameters });
            
            // Create call log entry
            const callLog = await prisma.callLog.create({
              data: {
                patientId,
                startTime: new Date(),
                isWebRTC: true
              }
            });

            producer.on('@close', async () => {
              await prisma.callLog.update({
                where: { id: callLog.id },
                data: { endTime: new Date() }
              });
            });

            socket.emit('producer-created', { id: producer.id });
          });

          socket.on('disconnect', () => {
            transport.close();
          });
        } catch (error) {
          console.error('Error in room connection:', error);
          socket.emit('connection-error', { error: 'Failed to setup connection' });
        }
      });
    });
  }
} 