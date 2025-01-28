"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webRTCConfig = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.webRTCConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        {
            urls: process.env.TURN_SERVER_URL,
            username: process.env.TURN_SERVER_USERNAME,
            credential: process.env.TURN_SERVER_CREDENTIAL
        }
    ].filter(server => !server.urls || typeof server.urls === 'string'),
    iceTransportPolicy: 'all',
    bundlePolicy: 'balanced',
    rtcpMuxPolicy: 'require',
    iceCandidatePoolSize: 10,
    mediaConstraints: {
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        },
        video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
        }
    },
    timeouts: {
        callRequest: 30000, // 30 seconds for call request
        iceGathering: 5000, // 5 seconds for ICE gathering
        connectionAttempt: 10000 // 10 seconds for connection attempt
    }
};
