'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { mockUserService } from '@/services/mockUsers';
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

  useEffect(() => {
    // Start local video stream
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      })
      .catch(error => {
        console.error('Failed to get media devices:', error);
        toast.error('Failed to access camera or microphone');
      });

    return () => {
      // Cleanup media streams
      const localVideo = localVideoRef.current;
      const remoteVideo = remoteVideoRef.current;
      
      if (localVideo?.srcObject) {
        const stream = localVideo.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      if (remoteVideo?.srcObject) {
        const stream = remoteVideo.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      if (durationRef.current) {
        clearInterval(durationRef.current);
      }
    };
  }, []);

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