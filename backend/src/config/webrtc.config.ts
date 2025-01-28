import dotenv from 'dotenv';
dotenv.config();

export const webRTCConfig = {
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
    callRequest: 30000,      // 30 seconds for call request
    iceGathering: 5000,      // 5 seconds for ICE gathering
    connectionAttempt: 10000  // 10 seconds for connection attempt
  }
}; 