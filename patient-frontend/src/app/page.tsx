'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { socketService } from '@/services/socket';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CallScreen } from '@/components/CallScreen';

export default function PatientPage() {
  const searchParams = useSearchParams();
  const patientId = searchParams.get('patientId');
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [callState, setCallState] = useState<{
    isIncoming: boolean;
    callerId?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) {
      setError('No patient ID provided');
      setConnectionState('error');
      return;
    }

    let isInitializing = true;
    let retryTimeout: NodeJS.Timeout;

    const initializeConnection = async () => {
      try {
        await socketService.connect();
        await socketService.register(patientId);
        if (isInitializing) {
          setConnectionState('connected');
          setError(null);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to connect. Please refresh the page.';
        if (isInitializing) {
          setError(message);
          setConnectionState('error');
        }
      }
    };

    // Handle socket events
    socketService.on('registration-success', () => {
      setConnectionState('connected');
      setError(null);
    });

    socketService.on('registration-error', (data) => {
      setError(data.error || 'Registration failed');
      setConnectionState('error');
    });

    socketService.on('call-offer', (data) => {
      console.log('Received call offer:', data);
      setCallState({
        isIncoming: true,
        callerId: data.from
      });
    });

    socketService.on('call-ended', () => {
      console.log('Call ended');
      setCallState(null);
    });

    socketService.on('call-failed', (data) => {
      console.log('Call failed:', data);
      setError(data.error || 'Call failed');
      setCallState(null);
    });

    initializeConnection();

    return () => {
      isInitializing = false;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      socketService.disconnect();
    };
  }, [patientId]);

  const handleAcceptCall = () => {
    if (callState?.callerId) {
      // Accept call logic will be handled by CallScreen component
      setCallState(prev => prev ? { ...prev, isIncoming: false } : null);
    }
  };

  const handleRejectCall = () => {
    if (callState?.callerId) {
      socketService.sendReject(callState.callerId);
      setCallState(null);
    }
  };

  if (error) {
    return (
      <Card className="fixed inset-0 m-auto w-80 h-40 flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">{error}</p>
        </div>
      </Card>
    );
  }

  if (connectionState === 'connecting') {
    return (
      <Card className="fixed inset-0 m-auto w-80 h-40 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4">
            <div className="w-12 h-12 rounded-full bg-muted animate-pulse mx-auto" />
          </div>
          <p>Connecting...</p>
        </div>
      </Card>
    );
  }

  if (callState?.isIncoming) {
    return (
      <Card className="fixed bottom-4 right-4 p-4 w-80 shadow-lg bg-white">
        <div className="text-center">
          <p className="mb-4">Incoming call from caretaker</p>
          <div className="flex justify-center gap-4">
            <Button onClick={handleAcceptCall} variant="default">
              Accept
            </Button>
            <Button onClick={handleRejectCall} variant="destructive">
              Reject
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (callState && !callState.isIncoming) {
    return <CallScreen peerId={callState.callerId!} onCallEnd={() => setCallState(null)} />;
  }

  return (
    <Card className="fixed inset-0 m-auto w-80 h-40 flex items-center justify-center">
      <div className="text-center">
        <p>Ready for calls</p>
      </div>
    </Card>
  );
}
