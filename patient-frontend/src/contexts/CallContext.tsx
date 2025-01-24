'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { webRTCService } from '@/services/webrtc';

type CallStatus = 'idle' | 'incoming' | 'outgoing' | 'connected';

interface CallContextType {
  status: CallStatus;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  handleIncomingCall: (offer: RTCSessionDescriptionInit) => Promise<void>;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<CallStatus>('idle');

  const handleIncomingCall = useCallback(async (offer: RTCSessionDescriptionInit) => {
    if (!webRTCService) return;
    setStatus('incoming');
    try {
      await webRTCService.handleIncomingCall(offer);
    } catch (error) {
      console.error('Error handling incoming call:', error);
      setStatus('idle');
    }
  }, []);

  const acceptCall = useCallback(async () => {
    if (!webRTCService) return;
    try {
      await webRTCService.startCall();
      setStatus('connected');
    } catch (error) {
      console.error('Error accepting call:', error);
      setStatus('idle');
    }
  }, []);

  const rejectCall = useCallback(() => {
    if (!webRTCService) return;
    webRTCService.endCall();
    setStatus('idle');
  }, []);

  const endCall = useCallback(() => {
    if (!webRTCService) return;
    webRTCService.endCall();
    setStatus('idle');
  }, []);

  return (
    <CallContext.Provider
      value={{
        status,
        acceptCall,
        rejectCall,
        endCall,
        handleIncomingCall,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
} 