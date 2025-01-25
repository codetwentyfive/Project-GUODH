'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { webRTCService } from '@/services/webrtc';
import { socketService } from '@/services/socket';
import type { CallbackData } from '@/services/socket';

interface CallerInfo {
  id: string;
  name: string;
}

// Map caretaker IDs to their display names
const CARETAKERS: Record<string, string> = {
  'caretaker-1': 'Dr. Smith',
  'caretaker-2': 'Dr. Jane Smith'
};

// Get patient ID from URL
const getPatientId = (): string => {
  if (typeof window === 'undefined') return '';
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get('patientId');
  if (!patientId) {
    throw new Error('Patient ID is required');
  }
  return patientId;
};

export default function Home() {
  const [callStatus, setCallStatus] = useState<'idle' | 'incoming' | 'connected'>('idle');
  const [caller, setCaller] = useState<CallerInfo | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCallOffer = useCallback(async (data: CallbackData) => {
    console.log('[Patient] DEBUG: Call offer received:', data);
    if (!data.from || !data.offer) {
      console.error('[Patient] Invalid call offer received');
      return;
    }

    try {
      console.log('[Patient] DEBUG: Processing call from:', data.from);
      console.log('[Patient] Setting caller and status...');
      
      console.log('[Patient] DEBUG: Current state before update:', {
        callStatus,
        currentCaller: caller,
        isRegistered
      });
      
      setCaller({
        id: data.from,
        name: CARETAKERS[data.from] || 'Unknown Caretaker'
      });
      setCallStatus('incoming');
      
      console.log('[Patient] DEBUG: State updated, passing to WebRTC service');
      
      await webRTCService.handleIncomingCall(data.from, data.offer);
      
      console.log('[Patient] DEBUG: WebRTC handling complete');
    } catch (err) {
      console.error('[Patient] Error handling call offer:', err);
      setError('Failed to process incoming call');
      setCallStatus('idle');
      setCaller(null);
    }
  }, [callStatus, caller, isRegistered]);

  const handleCallEnded = useCallback(() => {
    console.log('[Patient] Call ended');
    setCallStatus('idle');
    setCaller(null);
    webRTCService.endCall();
  }, []);

  const handleConnectionStateChange = useCallback((state: string) => {
    console.log('[Patient] DEBUG: WebRTC state change:', {
      newState: state,
      currentCallStatus: callStatus,
      currentCaller: caller
    });
    
    switch (state) {
      case 'connected':
        setCallStatus('connected');
        setError(null);
        console.log('[Patient] DEBUG: Set status to connected');
        break;
      case 'disconnected':
      case 'failed':
        setCallStatus('idle');
        setCaller(null);
        setError(state === 'failed' ? 'Call connection failed' : null);
        console.log('[Patient] DEBUG: Reset to idle state');
        break;
      default:
        break;
    }
  }, [callStatus, caller]);

  useEffect(() => {
    let mounted = true;

    const initializeServices = async () => {
      try {
        const patientId = getPatientId();
        await socketService.connect();
        await socketService.register(patientId);
        if (mounted) {
          console.log('[Patient] Registered successfully as:', patientId);
          setIsRegistered(true);
          setError(null);
        }
      } catch (err) {
        console.error('[Patient] Registration failed:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to connect to service');
          setIsRegistered(false);
        }
      }
    };

    // Initialize services and set up event handlers
    initializeServices();

    socketService.on('call-offer', handleCallOffer);
    socketService.on('call-ended', handleCallEnded);
    webRTCService.onConnectionStateChange(handleConnectionStateChange);

    // Cleanup function
    return () => {
      mounted = false;
      socketService.disconnect();
      webRTCService.endCall();
    };
  }, [handleCallOffer, handleCallEnded, handleConnectionStateChange]);

  const handleAcceptCall = async () => {
    console.log('[Patient] DEBUG: Accepting call, current state:', {
      callStatus,
      caller,
      isRegistered
    });
    
    try {
      await webRTCService.acceptCall();
      setCallStatus('connected');
      setError(null);
      console.log('[Patient] DEBUG: Call accepted successfully');
    } catch (err) {
      console.error('[Patient] Failed to accept call:', err);
      setError('Failed to accept call');
      setCallStatus('idle');
      setCaller(null);
    }
  };

  const handleRejectCall = async () => {
    try {
      await webRTCService.rejectCall();
      setCallStatus('idle');
      setCaller(null);
      setError(null);
    } catch (err) {
      console.error('[Patient] Failed to reject call:', err);
      setError('Failed to reject call');
    }
  };

  const handleEndCall = async () => {
    try {
      await webRTCService.endCall();
      setCallStatus('idle');
      setCaller(null);
      setError(null);
    } catch (err) {
      console.error('[Patient] Failed to end call:', err);
      setError('Failed to end call');
    }
  };

  // Render error state
  if (error) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-destructive/10 mx-auto flex items-center justify-center">
                <span className="text-2xl">⚠️</span>
              </div>
              <h1 className="text-xl font-semibold text-destructive">{error}</h1>
              <Button 
                onClick={() => window.location.reload()} 
                variant="outline"
              >
                Retry Connection
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="p-6">
          {callStatus === 'idle' ? (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
                <span className="text-2xl">👤</span>
              </div>
              <h1 className="text-xl font-semibold">
                {isRegistered ? 'Ready for Calls' : 'Connecting...'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isRegistered 
                  ? 'Your caretaker can call you anytime'
                  : 'Establishing connection...'}
              </p>
            </div>
          ) : callStatus === 'incoming' && caller ? (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 mx-auto flex items-center justify-center animate-pulse">
                <span className="text-2xl">📞</span>
              </div>
              <h1 className="text-xl font-semibold">Incoming Call</h1>
              <p className="text-sm text-muted-foreground">
                {caller.name} is calling
              </p>
              <div className="flex justify-center gap-4">
                <Button 
                  onClick={handleAcceptCall}
                  className="bg-green-500 hover:bg-green-600"
                >
                  Accept
                </Button>
                <Button 
                  onClick={handleRejectCall}
                  variant="destructive"
                >
                  Reject
                </Button>
              </div>
            </div>
          ) : callStatus === 'connected' && caller ? (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-green-500/10 mx-auto flex items-center justify-center">
                <span className="text-2xl">🎙️</span>
              </div>
              <h1 className="text-xl font-semibold">In Call</h1>
              <p className="text-sm text-muted-foreground">
                Connected with {caller.name}
              </p>
              <Button 
                onClick={handleEndCall}
                variant="destructive"
              >
                End Call
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
