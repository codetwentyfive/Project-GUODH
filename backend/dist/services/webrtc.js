"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebRTCService = void 0;
const mediasoup = __importStar(require("mediasoup"));
const socket_io_1 = require("socket.io");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class WebRTCService {
    constructor(httpServer) {
        this.worker = null;
        this.rooms = new Map();
        this.io = new socket_io_1.Server(httpServer, {
            cors: {
                origin: process.env.FRONTEND_URL || 'http://localhost:3000',
                methods: ['GET', 'POST']
            }
        });
        this.initializeMediaSoup();
        this.handleConnections();
    }
    async initializeMediaSoup() {
        this.worker = await mediasoup.createWorker({
            logLevel: 'warn',
            rtcMinPort: 10000,
            rtcMaxPort: 10100
        });
        console.log('MediaSoup worker created');
    }
    async createRoom(roomId) {
        if (!this.worker)
            throw new Error('MediaSoup worker not initialized');
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
    async handleConnections() {
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
                }
                catch (error) {
                    console.error('Error in room connection:', error);
                    socket.emit('connection-error', { error: 'Failed to setup connection' });
                }
            });
        });
    }
}
exports.WebRTCService = WebRTCService;
