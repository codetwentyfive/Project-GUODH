import { Socket } from 'socket.io-client';

export interface MediaConstraints {
  audio: {
    echoCancellation: boolean;
    noiseSuppression: boolean;
    autoGainControl: boolean;
    sampleRate?: number;
    channelCount?: number;
  };
  video: {
    width: { min: number; ideal: number; max: number };
    height: { min: number; ideal: number; max: number };
    frameRate: { min: number; ideal: number; max: number };
    facingMode: string;
  };
}

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private mediaStream: MediaStream | null = null;
  private socket: Socket;
  private statsInterval: ReturnType<typeof setInterval> | null = null;

  constructor(socket: Socket) {
    this.socket = socket;
  }

  private readonly defaultConstraints: MediaConstraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 48000,
      channelCount: 2
    },
    video: {
      width: { min: 640, ideal: 1280, max: 1920 },
      height: { min: 480, ideal: 720, max: 1080 },
      frameRate: { min: 15, ideal: 30, max: 60 },
      facingMode: 'user'
    }
  };

  async initializeCall(peerId: string, onTrack: (stream: MediaStream) => void): Promise<MediaStream | null> {
    try {
      // Check device availability
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideo = devices.some(device => device.kind === 'videoinput');
      const hasAudio = devices.some(device => device.kind === 'audioinput');

      if (!hasVideo && !hasAudio) {
        throw new Error('No camera or microphone found');
      }

      // Get media stream
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: hasVideo ? this.defaultConstraints.video : false,
        audio: hasAudio ? this.defaultConstraints.audio : false
      });

      // Create peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' }
        ],
        iceTransportPolicy: 'all',
        bundlePolicy: 'balanced',
        rtcpMuxPolicy: 'require',
        iceCandidatePoolSize: 10
      });

      // Add tracks to peer connection
      this.mediaStream.getTracks().forEach(track => {
        if (this.mediaStream && this.peerConnection) {
          this.peerConnection.addTrack(track, this.mediaStream);
        }
      });

      // Set up event handlers
      this.setupPeerConnectionHandlers(peerId, onTrack);
      this.startStatsMonitoring();

      return this.mediaStream;
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  private setupPeerConnectionHandlers(peerId: string, onTrack: (stream: MediaStream) => void): void {
    if (!this.peerConnection) return;

    this.peerConnection.onicecandidate = ({ candidate }) => {
      if (candidate && this.socket?.connected) {
        try {
          this.socket.emit('ice-candidate', { targetId: peerId, candidate });
        } catch (error) {
          console.error('Failed to send ICE candidate:', error);
        }
      }
    };

    this.peerConnection.ontrack = (event) => {
      if (event.streams[0]) {
        onTrack(event.streams[0]);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', this.peerConnection?.iceConnectionState);
      if (this.peerConnection?.iceConnectionState === 'failed') {
        console.log('ICE connection failed, attempting restart...');
        this.peerConnection.restartIce();
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection?.connectionState);
      if (this.peerConnection?.connectionState === 'failed') {
        this.cleanup();
      }
    };
  }

  private startStatsMonitoring(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    this.statsInterval = setInterval(() => {
      if (this.peerConnection) {
        this.peerConnection.getStats().then(stats => {
          stats.forEach(report => {
            if (report.type === 'inbound-rtp' && report.kind === 'video') {
              console.log('Video stats:', {
                frameRate: report.framesPerSecond,
                packetsLost: report.packetsLost,
                bytesReceived: report.bytesReceived
              });
            }
          });
        });
      }
    }, 1000);
  }

  async createOffer(): Promise<RTCSessionDescriptionInit | null> {
    if (!this.peerConnection) return null;

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    return this.enhanceSessionDescription(offer);
  }

  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    if (!this.peerConnection) return null;

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return this.enhanceSessionDescription(answer);
  }

  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async handleIceCandidate(candidate: RTCIceCandidate): Promise<void> {
    if (this.peerConnection?.remoteDescription) {
      await this.peerConnection.addIceCandidate(candidate);
    }
  }

  private enhanceSessionDescription(sd: RTCSessionDescriptionInit): RTCSessionDescriptionInit {
    if (sd.sdp) {
      // Set bandwidth limits
      sd.sdp = sd.sdp.replace(/a=mid:video\r\n/g, 'a=mid:video\r\nb=AS:2000\r\n');
      // Add other SDP modifications as needed
    }
    return sd;
  }

  cleanup(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }
} 