'use client';

import { socketService } from './socket';

type ConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';
type ConnectionStateChangeCallback = (state: ConnectionState) => void;

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private currentCallId: string | null = null;
  private pendingOffer: RTCSessionDescriptionInit | null = null;
  private connectionStateChangeCallbacks: ConnectionStateChangeCallback[] = [];

  constructor() {
    this.setupAudioElement();
  }

  private setupAudioElement() {
    if (typeof window !== 'undefined') {
      this.audioElement = new Audio();
      this.audioElement.autoplay = true;
      console.log('[WebRTC] Audio element created');
    }
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

      if (this.peerConnection?.iceConnectionState === 'failed') {
        console.log('[WebRTC] ICE connection failed, cleaning up');
        this.cleanup();
      }
    };
  }

  async handleIncomingCall(from: string, offer: RTCSessionDescriptionInit): Promise<void> {
    try {
      this.currentCallId = from;
      this.pendingOffer = offer;
      console.log('[WebRTC] Received call offer from:', from);

      this.setupPeerConnection();

      console.log('[WebRTC] Waiting for user to accept call');
    } catch (error) {
      console.error('[WebRTC] Error handling incoming call:', error);
      this.cleanup();
      throw error;
    }
  }

  async acceptCall(): Promise<void> {
    if (!this.pendingOffer || !this.currentCallId) {
      throw new Error('No pending call to accept');
    }

    try {
      if (!this.peerConnection) {
        this.setupPeerConnection();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => {
        if (this.peerConnection) {
          this.peerConnection.addTrack(track, stream);
        }
      });

      await this.peerConnection?.setRemoteDescription(this.pendingOffer);
      console.log('[WebRTC] Remote description set');

      const answer = await this.peerConnection?.createAnswer();
      if (!answer) throw new Error('Failed to create answer');
      
      await this.peerConnection?.setLocalDescription(answer);
      console.log('[WebRTC] Local description set');

      socketService.sendAnswer(this.currentCallId, answer);
      console.log('[WebRTC] Answer sent to caretaker');
      
      this.pendingOffer = null;
    } catch (error) {
      console.error('[WebRTC] Error accepting call:', error);
      this.cleanup();
      throw error;
    }
  }

  async rejectCall(): Promise<void> {
    if (this.currentCallId) {
      console.log('[WebRTC] Rejecting call from:', this.currentCallId);
      this.cleanup();
    }
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      if (!this.peerConnection) {
        throw new Error('No active peer connection');
      }
      
      if (this.peerConnection.remoteDescription === null) {
        console.log('[WebRTC] Queuing ICE candidate - remote description not set');
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
    console.log('[WebRTC] Ending call');
    this.cleanup();
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
    this.pendingOffer = null;
    this.connectionStateChangeCallbacks = [];
  }
}

export const webRTCService = new WebRTCService(); 