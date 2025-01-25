'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { webRTCService } from '@/services/webrtc';
import { socketService } from '@/services/socket';

type CallStatus = 'idle' | 'incoming' | 'connected';

interface CallContextType {
  status: CallStatus;
  caller: string | null;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
}

const CallContext = createContext<CallContextType | null>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [caller, setCaller] = useState<string | null>(null);
  const [pendingOffer, setPendingOffer] = useState<RTCSessionDescriptionInit | null>(null);

  useEffect(() => {
    // Initialize socket connection
    socketService.connect();
    console.log('[CallContext] Socket connected');

    // Handle incoming calls
    socketService.on('call-offer', (data) => {
      if (!data.from || !data.offer) {
        console.error('[CallContext] Invalid call offer received:', data);
        return;
      }
      console.log('[CallContext] Received call from:', data.from);
      setCaller(data.from);
      setPendingOffer(data.offer);
      setStatus('incoming');
    });

    // Handle call termination
    socketService.on('call-ended', () => {
      console.log('[CallContext] Call ended by caller');
      webRTCService.endCall();
      setStatus('idle');
      setCaller(null);
      setPendingOffer(null);
    });

    // Cleanup on unmount
    return () => {
      console.log('[CallContext] Cleaning up socket connection');
      webRTCService.endCall();
      socketService.disconnect();
    };
  }, []);

  const acceptCall = async () => {
    if (!caller || !pendingOffer) {
      console.error('[CallContext] No pending call to accept');
      return;
    }

    try {
      console.log('[CallContext] Accepting call from:', caller);
      await webRTCService.handleIncomingCall(caller, pendingOffer);
      setStatus('connected');
    } catch (error) {
      console.error('[CallContext] Error handling incoming call:', error);
      webRTCService.endCall();
      setStatus('idle');
      setCaller(null);
      setPendingOffer(null);
    }
  };

  const rejectCall = () => {
    if (!caller) return;
    
    console.log('[CallContext] Rejecting call from:', caller);
    socketService.sendReject(caller);
    webRTCService.endCall();
    setStatus('idle');
    setCaller(null);
    setPendingOffer(null);
  };

  const endCall = () => {
    if (!caller) return;

    console.log('[CallContext] Ending call with:', caller);
    webRTCService.endCall();
    setStatus('idle');
    setCaller(null);
    setPendingOffer(null);
  };

  return (
    <CallContext.Provider value={{ status, caller, acceptCall, rejectCall, endCall }}>
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
} 