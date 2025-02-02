'use client';

import { socketService } from './socket';

type ConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';
type ConnectionStateChangeCallback = (state: ConnectionState) => void;

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private currentCallId: string | null = null;
  private connectionStateChangeCallbacks: ConnectionStateChangeCallback[] = [];

  constructor() {
    this.setupAudioElement();
    this.setupSocketHandlers();
  }

  private setupAudioElement() {
    if (typeof window !== 'undefined') {
      this.audioElement = new Audio();
      this.audioElement.autoplay = true;
      console.log('[WebRTC] Audio element created');
    }
  }

  private setupSocketHandlers() {
    socketService.on('call-answered', async ({ from, answer }) => {
      console.log('[WebRTC] Received call answer from:', from);
      if (answer) {
        await this.handleAnswer(answer);
      }
    });

    socketService.on('ice-candidate', async ({ from, candidate }) => {
      console.log('[WebRTC] Received ICE candidate from:', from);
      if (candidate) {
        await this.handleIceCandidate(candidate);
      }
    });

    socketService.on('call-ended', ({ from }) => {
      console.log('[WebRTC] Call ended by:', from);
      this.cleanup();
    });
  }

  private setupPeerConnection() {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };

    this.peerConnection = new RTCPeerConnection(configuration);
    console.log('[WebRTC] Peer connection created');

    this.peerConnection.ontrack = ({ streams: [stream] }) => {
      console.log('[WebRTC] Received remote stream');
      if (this.audioElement) {
        this.audioElement.srcObject = stream;
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState as ConnectionState;
      console.log('[WebRTC] Connection state changed:', state);
      this.connectionStateChangeCallbacks.forEach(callback => callback(state));

      // Auto cleanup on failure
      if (state === 'failed' || state === 'closed') {
        console.log('[WebRTC] Connection failed or closed, cleaning up');
        this.cleanup();
      }
    };

    this.peerConnection.onicecandidate = ({ candidate }) => {
      if (candidate && this.currentCallId) {
        console.log('[WebRTC] Sending ICE candidate');
        socketService.sendIceCandidate(this.currentCallId, candidate);
      }
    };

    this.peerConnection.onicegatheringstatechange = () => {
      console.log('[WebRTC] ICE gathering state:', this.peerConnection?.iceGatheringState);
    };

    this.peerConnection.onsignalingstatechange = () => {
      console.log('[WebRTC] Signaling state:', this.peerConnection?.signalingState);
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', this.peerConnection?.iceConnectionState);
      
      // Auto cleanup on ICE failure
      if (this.peerConnection?.iceConnectionState === 'failed') {
        console.log('[WebRTC] ICE connection failed, cleaning up');
        this.cleanup();
      }
    };
  }

  async startCall(targetId: string): Promise<void> {
    try {
      this.currentCallId = targetId;
      this.setupPeerConnection();

      // Get user media first to ensure we have microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => {
        if (this.peerConnection) {
          this.peerConnection.addTrack(track, stream);
        }
      });

      // Create and set local description (the offer)
      const offer = await this.peerConnection?.createOffer();
      if (!offer) throw new Error('Failed to create offer');

      await this.peerConnection?.setLocalDescription(offer);
      console.log('[WebRTC] Local description set');

      // Send offer to patient
      socketService.sendOffer(targetId, offer);
      console.log('[WebRTC] Call offer sent to:', targetId);
    } catch (error) {
      console.error('[WebRTC] Error starting call:', error);
      this.cleanup();
      throw error;
    }
  }

  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    try {
      if (!this.peerConnection) {
        throw new Error('No active call to handle answer');
      }

      if (this.peerConnection.signalingState === 'stable') {
        console.log('[WebRTC] Answer already processed');
        return;
      }

      await this.peerConnection.setRemoteDescription(answer);
      console.log('[WebRTC] Remote description set');
    } catch (error) {
      console.error('[WebRTC] Error handling answer:', error);
      this.cleanup();
      throw error;
    }
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      if (!this.peerConnection) {
        throw new Error('No active peer connection');
      }
      
      if (this.peerConnection.remoteDescription === null) {
        console.log('[WebRTC] Queuing ICE candidate - remote description not set');
        // Could implement ICE candidate queue here if needed
        return;
      }

      await this.peerConnection.addIceCandidate(candidate);
      console.log('[WebRTC] ICE candidate added successfully');
    } catch (error) {
      console.error('[WebRTC] Error adding ICE candidate:', error);
      throw error;
    }
  }

  onConnectionStateChange(callback: ConnectionStateChangeCallback): void {
    this.connectionStateChangeCallbacks.push(callback);
  }

  endCall(): void {
    if (this.currentCallId) {
      socketService.endCall(this.currentCallId);
      this.cleanup();
    }
  }

  private cleanup(): void {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.audioElement) {
      this.audioElement.srcObject = null;
    }
    this.currentCallId = null;
    this.connectionStateChangeCallbacks = [];
  }
}

export const webRTCService = new WebRTCService(); 