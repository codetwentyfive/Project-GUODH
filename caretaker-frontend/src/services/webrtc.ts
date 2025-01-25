'use client';

import { socketService } from './socket';
import { userManager } from './userManager';
import { mediaManager } from './mediaManager';

type ConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';
type ConnectionStateChangeCallback = (state: ConnectionState) => void;

interface ConnectionStats {
  packetsLost: number;
  jitter: number;
  roundTripTime: number;
  audioLevel: number;
}

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private currentCallId: string | null = null;
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

  async startCall(targetId: string): Promise<void> {
    try {
      // Initialize media first
      await mediaManager.initialize({ audio: true });
      
      this.currentCallId = targetId;
      console.log('[WebRTC] Starting call with:', targetId);
      
      // Set up peer connection
      this.setupPeerConnection();
      
      // Add local tracks
      const localStream = mediaManager.getLocalStream();
      if (localStream) {
        localStream.getTracks().forEach(track => {
          this.peerConnection?.addTrack(track, localStream);
        });
      }
      
      // Create and set local description
      const offer = await this.peerConnection?.createOffer();
      await this.peerConnection?.setLocalDescription(offer);
      
      // Send offer
      socketService.sendOffer(targetId, offer!);
      console.log('[WebRTC] Call offer sent');
    } catch (error) {
      console.error('[WebRTC] Error starting call:', error);
      this.cleanup();
      throw error;
    }
  }

  async handleCallAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    try {
      if (!this.peerConnection) {
        throw new Error('No peer connection available');
      }
      
      await this.peerConnection.setRemoteDescription(answer);
      console.log('[WebRTC] Call answer processed');
    } catch (error) {
      console.error('[WebRTC] Error handling call answer:', error);
      this.cleanup();
      throw error;
    }
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      await this.peerConnection?.addIceCandidate(candidate);
      console.log('[WebRTC] ICE candidate added');
    } catch (error) {
      console.error('[WebRTC] Error adding ICE candidate:', error);
      throw error;
    }
  }

  endCall(): void {
    console.log('[WebRTC] Ending call');
    this.cleanup();
  }

  private cleanup(): void {
    console.log('[WebRTC] Cleaning up resources');
    
    // Clean up media
    mediaManager.cleanup();
    
    if (this.peerConnection) {
      // Close all transceivers
      this.peerConnection.getTransceivers().forEach(transceiver => {
        if (transceiver.stop) {
          transceiver.stop();
        }
      });

      // Close the connection
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.audioElement) {
      this.audioElement.srcObject = null;
    }

    this.currentCallId = null;
    
    // Update user status
    userManager.updateUserStatus('online');
  }

  onConnectionStateChange(callback: ConnectionStateChangeCallback): void {
    this.connectionStateChangeCallbacks.push(callback);
  }

  async getConnectionStats(): Promise<ConnectionStats | null> {
    if (!this.peerConnection) {
      return null;
    }

    try {
      const stats = await this.peerConnection.getStats();
      const result: ConnectionStats = {
        packetsLost: 0,
        jitter: 0,
        roundTripTime: 0,
        audioLevel: 0
      };

      stats.forEach(report => {
        if (report.type === 'inbound-rtp' && report.kind === 'audio') {
          result.packetsLost = report.packetsLost;
          result.jitter = report.jitter;
        } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          result.roundTripTime = report.currentRoundTripTime;
        } else if (report.type === 'media-source' && report.kind === 'audio') {
          result.audioLevel = report.audioLevel;
        }
      });

      return result;
    } catch (error) {
      console.error('[WebRTC] Error getting connection stats:', error);
      return null;
    }
  }
}

export const webRTCService = new WebRTCService(); 