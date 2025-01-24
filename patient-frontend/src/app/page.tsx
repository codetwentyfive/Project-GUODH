'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { webRTCService } from '@/services/webrtc';
import { socketService } from '@/services/socket';

interface CallerInfo {
  id: string;
  name: string;
}

const CARETAKERS: Record<string, string> = {
  'caretaker-1': 'Dr. Smith'
};

export default function Home() {
  const [callStatus, setCallStatus] = useState<'idle' | 'incoming' | 'connected'>('idle');
  const [caller, setCaller] = useState<CallerInfo | null>(null);

  useEffect(() => {
    // Initialize services
    socketService.connect();
    socketService.register('patient-1');

    // Handle incoming calls
    socketService.on('call-offer', async ({ from, offer }) => {
      console.log('Incoming call from:', from);
      if (from && offer) {
        setCaller({
          id: from,
          name: CARETAKERS[from] || 'Unknown Caretaker'
        });
        setCallStatus('incoming');
        await webRTCService.handleIncomingCall(from, offer);
      }
    });

    // Handle call ended
    socketService.on('call-ended', () => {
      console.log('Call ended');
      setCallStatus('idle');
      setCaller(null);
      webRTCService.endCall();
    });

    // Handle connection state changes
    webRTCService.onConnectionStateChange((state) => {
      console.log('Connection state changed:', state);
      if (state === 'connected') {
        setCallStatus('connected');
      } else if (state === 'disconnected' || state === 'failed') {
        setCallStatus('idle');
        setCaller(null);
      }
    });

    return () => {
      socketService.disconnect();
    };
  }, []);

  const handleAcceptCall = async () => {
    try {
      await webRTCService.acceptCall();
      setCallStatus('connected');
    } catch (error) {
      console.error('Failed to accept call:', error);
      setCallStatus('idle');
      setCaller(null);
    }
  };

  const handleRejectCall = async () => {
    try {
      await webRTCService.rejectCall();
      setCallStatus('idle');
      setCaller(null);
    } catch (error) {
      console.error('Failed to reject call:', error);
    }
  };

  const handleEndCall = async () => {
    try {
      await webRTCService.endCall();
      setCallStatus('idle');
      setCaller(null);
    } catch (error) {
      console.error('Failed to end call:', error);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="p-6">
          {callStatus === 'idle' ? (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
                <span className="text-2xl">👤</span>
              </div>
              <h1 className="text-xl font-semibold">Ready for Calls</h1>
              <p className="text-sm text-muted-foreground">
                Your caretaker can call you anytime
              </p>
            </div>
          ) : callStatus === 'incoming' ? (
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <div className="w-24 h-24 rounded-full bg-primary/10 mx-auto flex items-center justify-center animate-pulse">
                  <span className="text-4xl">👤</span>
                </div>
                <h2 className="text-2xl font-semibold">Incoming Call</h2>
                <p className="text-muted-foreground">from {caller?.name}</p>
              </div>
              <div className="flex justify-center gap-4">
                <Button
                  variant="destructive"
                  size="lg"
                  className="rounded-full w-16 h-16"
                  onClick={handleRejectCall}
                >
                  ❌
                </Button>
                <Button
                  variant="default"
                  size="lg"
                  className="rounded-full w-16 h-16 bg-green-500 hover:bg-green-600"
                  onClick={handleAcceptCall}
                >
                  📞
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <div className="w-24 h-24 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
                  <span className="text-4xl">👤</span>
                </div>
                <h2 className="text-2xl font-semibold">On Call</h2>
                <p className="text-muted-foreground">with {caller?.name}</p>
              </div>
              <div className="flex justify-center">
                <Button
                  variant="destructive"
                  size="lg"
                  className="rounded-full w-16 h-16"
                  onClick={handleEndCall}
                >
                  📞
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
