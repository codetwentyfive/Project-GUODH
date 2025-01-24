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
    };
  }

  async startCall(targetId: string): Promise<void> {
    try {
      this.currentCallId = targetId;
      this.setupPeerConnection();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => {
        this.peerConnection?.addTrack(track, stream);
      });

      const offer = await this.peerConnection?.createOffer();
      if (!offer) throw new Error('Failed to create offer');

      await this.peerConnection?.setLocalDescription(offer);
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
      await this.peerConnection.setRemoteDescription(answer);
      console.log('[WebRTC] Remote description set');
    } catch (error) {
      console.error('[WebRTC] Error handling answer:', error);
      throw error;
    }
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      if (!this.peerConnection) {
        throw new Error('No active call to handle ICE candidate');
      }
      await this.peerConnection.addIceCandidate(candidate);
      console.log('[WebRTC] ICE candidate added');
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