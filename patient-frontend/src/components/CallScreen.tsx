'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { socketService } from '@/services/socket';

interface CallScreenProps {
  peerId: string;
  onCallEnd: () => void;
}

export function CallScreen({ peerId, onCallEnd }: CallScreenProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  useEffect(() => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peerConnection.current = pc;

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.sendIceCandidate(peerId, event.candidate);
      }
    };

    // Handle incoming tracks
    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Set up local media
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
      })
      .catch(console.error);

    // Handle socket events
    socketService.on('ice-candidate', async (data) => {
      if (data.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error('Error adding received ice candidate:', err);
        }
      }
    });

    socketService.on('call-ended', () => {
      onCallEnd();
    });

    return () => {
      // Cleanup
      if (localVideoRef.current?.srcObject) {
        const tracks = (localVideoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
      pc.close();
    };
  }, [peerId, onCallEnd]);

  const toggleMute = () => {
    const stream = localVideoRef.current?.srcObject as MediaStream;
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    const stream = localVideoRef.current?.srcObject as MediaStream;
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const handleEndCall = () => {
    socketService.endCall(peerId);
    onCallEnd();
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      <div className="flex-1 relative">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute bottom-4 right-4 w-48 h-36 object-cover rounded-lg shadow-lg"
        />
      </div>
      <Card className="p-4 flex justify-center gap-4">
        <Button
          onClick={toggleMute}
          variant={isMuted ? "destructive" : "default"}
        >
          {isMuted ? "Unmute" : "Mute"}
        </Button>
        <Button
          onClick={toggleVideo}
          variant={isVideoEnabled ? "default" : "destructive"}
        >
          {isVideoEnabled ? "Disable Video" : "Enable Video"}
        </Button>
        <Button onClick={handleEndCall} variant="destructive">
          End Call
        </Button>
      </Card>
    </div>
  );
} 