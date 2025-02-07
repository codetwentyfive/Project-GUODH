'use client';

import { socketService } from './socket';
import { userManager } from './userManager';
import { mediaManager } from './mediaManager';

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
    if (this.peerConnection) {
      console.log('[WebRTC] Cleaning up existing peer connection');
      this.cleanup();
    }

    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
      iceTransportPolicy: 'all',
      bundlePolicy: 'balanced',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 0
    } as const;

    this.peerConnection = new RTCPeerConnection(configuration);
    console.log('[WebRTC] Peer connection created');

    this.peerConnection.ontrack = ({ streams: [stream] }) => {
      console.log('[WebRTC] Received remote stream');
      if (this.audioElement) {
        this.audioElement.srcObject = stream;
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('[WebRTC] Connection state changed:', state);
      
      if (state === 'connected') {
        userManager.updateUserStatus('in-call');
      } else if (state === 'failed' || state === 'disconnected') {
        console.log('[WebRTC] Connection lost, cleaning up');
        userManager.updateUserStatus('online');
        this.cleanup();
      }
      
      this.connectionStateChangeCallbacks.forEach(callback => callback(state as ConnectionState));
    };

    this.peerConnection.onicecandidate = ({ candidate }) => {
      if (candidate && this.currentCallId) {
        console.log('[WebRTC] New ICE candidate');
        socketService.sendIceCandidate(this.currentCallId, candidate);
      }
    };

    this.peerConnection.onicegatheringstatechange = () => {
      console.log('[WebRTC] ICE gathering state:', this.peerConnection?.iceGatheringState);
    };

    this.peerConnection.onsignalingstatechange = () => {
      console.log('[WebRTC] Signaling state:', this.peerConnection?.signalingState);
      if (this.peerConnection?.signalingState === 'closed') {
        this.cleanup();
      }
    };
  }

  async handleIncomingCall(from: string, offer: RTCSessionDescriptionInit): Promise<void> {
    try {
      // Initialize media first
      await mediaManager.initialize({ audio: true });
      
      this.currentCallId = from;
      this.pendingOffer = offer;
      console.log('[WebRTC] Received call offer from:', from);
      
      // Set up peer connection
      this.setupPeerConnection();
      
      // Add local tracks
      const localStream = mediaManager.getLocalStream();
      if (localStream) {
        localStream.getTracks().forEach(track => {
          this.peerConnection?.addTrack(track, localStream);
        });
      }
      
      // Set remote description
      await this.peerConnection?.setRemoteDescription(offer);
      console.log('[WebRTC] Remote description set for incoming call');
    } catch (error) {
      console.error('[WebRTC] Error handling incoming call:', error);
      this.cleanup();
      throw error;
    }
  }

  async acceptCall(): Promise<void> {
    if (!this.pendingOffer || !this.currentCallId || !this.peerConnection) {
      console.error('[WebRTC] Cannot accept call: no pending call or connection');
      throw new Error('No pending call to accept');
    }

    try {
      console.log('[WebRTC] Accepting call from:', this.currentCallId);
      
      // Create and set local description
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      // Send answer
      socketService.sendAnswer(this.currentCallId, answer);
      console.log('[WebRTC] Call accepted and answer sent');
      
      // Clear pending offer
      this.pendingOffer = null;
    } catch (error) {
      console.error('[WebRTC] Error accepting call:', error);
          throw error;

    }
  }

  async rejectCall(): Promise<void> {
    if (this.currentCallId) {
      console.log('[WebRTC] Rejecting call from:', this.currentCallId);
      socketService.sendReject(this.currentCallId);
    }
  }

  endCall(): void {
    console.log('[WebRTC] Ending call');
  }


  onConnectionStateChange(callback: ConnectionStateChangeCallback): void {
    this.connectionStateChangeCallbacks.push(callback);
  }
}

export const webRTCService = new WebRTCService();