'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { mockUserService } from '@/services/mockUsers';
import { WebRTCService } from '@/services/webrtc.service';
import { socketService, type CallbackData } from '@/services/socket';
import toast from 'react-hot-toast';

interface CallScreenProps {
  peerId: string;
  isIncoming?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onEnd?: () => void;
}

export function CallScreen({ peerId, isIncoming = false, onAccept, onReject, onEnd }: CallScreenProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const [callDuration, setCallDuration] = useState(0);
  const durationRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const peerUser = mockUserService.getUser(peerId);
  const webrtcRef = useRef<WebRTCService | null>(null);

  useEffect(() => {
    const initializeCall = async () => {
      try {
        setCallStatus('connecting');
        
        // Initialize WebRTC service with the existing socket connection
        webrtcRef.current = new WebRTCService(socketService.getSocket());
        
        // Initialize the call and get media stream
        const localStream = await webrtcRef.current.initializeCall(peerId, (remoteStream) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
        });

        // Set local video stream
        if (localStream && localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }

        // Create and send offer if not incoming call
        if (!isIncoming) {
          const offer = await webrtcRef.current.createOffer();
          if (offer) {
            socketService.emit('call-offer', { targetId: peerId, offer });
          }
        }

        setCallStatus('connected');
      } catch (error) {
        console.error('Call initialization error:', error);
        let errorMessage = 'Failed to initialize call';
        
        if (error instanceof Error) {
          if (error.name === 'NotFoundError') {
            errorMessage = 'Camera or microphone not found. Please check your device connections.';
          } else if (error.name === 'NotAllowedError') {
            errorMessage = 'Please allow access to camera and microphone to make calls.';
          }
        }
        
        toast.error(errorMessage);
        setCallStatus('ended');
        if (onEnd) onEnd();
      }
    };

    initializeCall();

    // Cleanup function
    return () => {
      webrtcRef.current?.cleanup();
    };
  }, [peerId, isIncoming, onEnd]);

  // Handle incoming ICE candidates
  useEffect(() => {
    const handleIceCandidate = async (data: CallbackData) => {
      if (data.candidate) {
        await webrtcRef.current?.handleIceCandidate(data.candidate);
      }
    };

    socketService.on('ice-candidate', handleIceCandidate);
    return () => {
      socketService.off('ice-candidate', handleIceCandidate);
    };
  }, []);

  // Handle call negotiation
  useEffect(() => {
    const handleOffer = async (data: CallbackData) => {
      if (data.offer) {
        const answer = await webrtcRef.current?.handleOffer(data.offer);
        if (answer) {
          socketService.emit('call-answer', { targetId: peerId, answer });
        }
      }
    };

    const handleAnswer = async (data: CallbackData) => {
      if (data.answer) {
        await webrtcRef.current?.handleAnswer(data.answer);
      }
    };

    socketService.on('call-offer', handleOffer);
    socketService.on('call-answer', handleAnswer);

    return () => {
      socketService.off('call-offer', handleOffer);
      socketService.off('call-answer', handleAnswer);
    };
  }, [peerId]);

  useEffect(() => {
    if (callStatus === 'connected') {
      // Start call duration timer
      durationRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (durationRef.current) {
        clearInterval(durationRef.current);
      }
    };
  }, [callStatus]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMuteToggle = () => {
    if (localVideoRef.current?.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const handleVideoToggle = () => {
    if (localVideoRef.current?.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const handleEndCall = () => {
    setCallStatus('ended');
    onEnd?.();
  };

  if (isIncoming && callStatus === 'connecting') {
    return (
      <Card className="fixed bottom-4 right-4 p-6 w-96 shadow-lg bg-white">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-100 flex items-center justify-center">
            <Phone className="h-8 w-8 text-indigo-600 animate-pulse" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Incoming Call from {peerUser?.name || 'Unknown'}
          </h3>
          <div className="flex justify-center gap-4 mt-6">
            <Button
              onClick={onAccept}
              className="flex items-center gap-2"
              variant="default"
            >
              <Phone className="h-4 w-4" />
              Accept
            </Button>
            <Button
              onClick={onReject}
              className="flex items-center gap-2"
              variant="destructive"
            >
              <PhoneOff className="h-4 w-4" />
              Reject
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col">
      {/* Call Status Bar */}
      <div className="bg-white/10 backdrop-blur-sm p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant={callStatus === 'connected' ? 'success' : 'warning'}>
            {callStatus === 'connected' ? 'Connected' : 'Connecting...'}
          </Badge>
          {callStatus === 'connected' && (
            <span className="text-white text-sm">
              {formatDuration(callDuration)}
            </span>
          )}
        </div>
        <div className="text-white">
          {peerUser?.name || 'Unknown'} ({peerUser?.type || 'user'})
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        <div className="relative">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover rounded-lg"
          />
          <div className="absolute top-4 left-4">
            <Badge>Remote</Badge>
          </div>
        </div>
        <div className="relative">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover rounded-lg mirror"
          />
          <div className="absolute top-4 left-4">
            <Badge>You</Badge>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white/10 backdrop-blur-sm p-4">
        <div className="flex justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            className={`rounded-full ${isMuted ? 'bg-red-500 hover:bg-red-600' : ''}`}
            onClick={handleMuteToggle}
          >
            {isMuted ? (
              <MicOff className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </Button>
          <Button
            variant="destructive"
            size="icon"
            className="rounded-full"
            onClick={handleEndCall}
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={`rounded-full ${!isVideoEnabled ? 'bg-red-500 hover:bg-red-600' : ''}`}
            onClick={handleVideoToggle}
          >
            {isVideoEnabled ? (
              <Video className="h-5 w-5" />
            ) : (
              <VideoOff className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      <style jsx>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
} 