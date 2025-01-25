'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useCall } from '@/contexts/CallContext';
import { socketService } from '@/services/socket';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import toast from 'react-hot-toast';

interface CallScreenProps {
  peerId: string;
  isIncoming: boolean;
}

type CallbackData = {
  from?: string;
  targetId?: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  error?: string;
  roomId?: string;
  userId?: string;
};

export function CallScreen({ peerId, isIncoming }: CallScreenProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const { endCall } = useCall();

  useEffect(() => {
    let durationInterval: NodeJS.Timeout;
    let localStream: MediaStream;

    const checkMediaPermissions = async () => {
      try {
        // Check if we have the required permissions
        const permissions = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        permissions.getTracks().forEach(track => track.stop()); // Clean up check stream
        return true;
      } catch (error) {
        console.error('Media permissions error:', error);
        if ((error as Error).name === 'NotAllowedError') {
          toast.error('Please allow camera and microphone access to make calls');
        } else if ((error as Error).name === 'NotFoundError') {
          toast.error('No camera or microphone found');
        } else {
          toast.error('Failed to access media devices');
        }
        return false;
      }
    };

    const initializeCall = async () => {
      try {
        // First check permissions
        const hasPermissions = await checkMediaPermissions();
        if (!hasPermissions) {
          endCall();
          return;
        }

        // Get local media stream with constraints
        localStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          }
        });

        // Display local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }

        // Initialize WebRTC peer connection with STUN servers
        peerConnection.current = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
          ],
          iceCandidatePoolSize: 10
        });

        // Add local stream tracks to peer connection
        localStream.getTracks().forEach(track => {
          if (peerConnection.current) {
            console.log('Adding track:', track.kind);
            peerConnection.current.addTrack(track, localStream);
          }
        });

        // Handle connection state changes
        peerConnection.current.onconnectionstatechange = () => {
          console.log('Connection state:', peerConnection.current?.connectionState);
          if (peerConnection.current?.connectionState === 'failed') {
            toast.error('Call connection failed');
            endCall();
          }
        };

        // Handle ICE connection state changes
        peerConnection.current.oniceconnectionstatechange = () => {
          console.log('ICE connection state:', peerConnection.current?.iceConnectionState);
          if (peerConnection.current?.iceConnectionState === 'failed') {
            toast.error('Failed to establish peer connection');
            endCall();
          }
        };

        // Handle incoming tracks
        peerConnection.current.ontrack = (event) => {
          console.log('Received remote track:', event.track.kind);
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        // Handle ICE candidates
        peerConnection.current.onicecandidate = (event) => {
          if (event.candidate) {
            console.log('Sending ICE candidate');
            socketService.emit('ice-candidate', {
              targetId: peerId,
              candidate: event.candidate
            });
          }
        };

        // Create and send offer if not incoming call
        if (!isIncoming && peerConnection.current) {
          console.log('Creating offer');
          const offer = await peerConnection.current.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
          });
          await peerConnection.current.setLocalDescription(offer);
          socketService.emit('call-offer', {
            targetId: peerId,
            offer
          });
        }

        // Start call duration timer
        durationInterval = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);

      } catch (error) {
        console.error('Failed to initialize call:', error);
        toast.error('Failed to initialize call');
        endCall();
      }
    };

    initializeCall();

    // Clean up
    return () => {
      clearInterval(durationInterval);
      if (localStream) {
        localStream.getTracks().forEach(track => {
          track.stop();
          console.log('Stopped track:', track.kind);
        });
      }
      if (peerConnection.current) {
        peerConnection.current.close();
        console.log('Closed peer connection');
      }
    };
  }, [peerId, isIncoming, endCall]);

  // Handle incoming WebRTC signaling
  useEffect(() => {
    const handleAnswer = async (data: CallbackData) => {
      if (data.from === peerId && data.answer && peerConnection.current) {
        try {
          console.log('Setting remote description from answer');
          await peerConnection.current.setRemoteDescription(data.answer);
        } catch (error) {
          console.error('Error setting remote description:', error);
          toast.error('Failed to establish connection');
          endCall();
        }
      }
    };

    const handleIceCandidate = async (data: CallbackData) => {
      if (data.from === peerId && data.candidate && peerConnection.current) {
        try {
          console.log('Adding ICE candidate');
          await peerConnection.current.addIceCandidate(data.candidate);
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    };

    socketService.on('call-answer', handleAnswer);
    socketService.on('ice-candidate', handleIceCandidate);

    return () => {
      socketService.off('call-answer', handleAnswer);
      socketService.off('ice-candidate', handleIceCandidate);
    };
  }, [peerId, endCall]);

  const toggleMute = () => {
    const audioTracks = peerConnection.current
      ?.getSenders()
      .find(sender => sender.track?.kind === 'audio')
      ?.track;
    
    if (audioTracks) {
      audioTracks.enabled = !audioTracks.enabled;
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    const videoTracks = peerConnection.current
      ?.getSenders()
      .find(sender => sender.track?.kind === 'video')
      ?.track;
    
    if (videoTracks) {
      videoTracks.enabled = !videoTracks.enabled;
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm">
      <div className="container flex flex-col items-center justify-center h-full max-w-4xl gap-4">
        <Card className="w-full p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full rounded-lg bg-muted"
              />
              <Badge className="absolute top-2 left-2">You</Badge>
            </div>
            <div className="relative">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full rounded-lg bg-muted"
              />
              <Badge className="absolute top-2 left-2">Patient</Badge>
            </div>
          </div>
        </Card>

        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleMute}
          >
            {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleVideo}
          >
            {isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </Button>
          <Button
            variant="destructive"
            size="icon"
            onClick={endCall}
          >
            <PhoneOff className="h-4 w-4" />
          </Button>
          <Badge variant="secondary">
            {formatDuration(callDuration)}
          </Badge>
        </div>
      </div>
    </div>
  );
} 