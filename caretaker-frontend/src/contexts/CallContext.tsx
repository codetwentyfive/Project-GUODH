'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { webRTCService } from '@/services/webrtc';

type CallStatus = 'idle' | 'calling' | 'connected';

interface CallContextType {
  status: CallStatus;
  startCall: (patientId: string) => Promise<void>;
  endCall: () => void;
  handleAnswer: (answer: RTCSessionDescriptionInit) => Promise<void>;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<CallStatus>('idle');

  useEffect(() => {
    console.log('[CallContext] Status changed:', status);
  }, [status]);

  const startCall = useCallback(async (patientId: string) => {
    if (!webRTCService) {
      console.error('[CallContext] WebRTC service not available');
      return;
    }
    try {
      console.log('[CallContext] Starting call with patient:', patientId);
      setStatus('calling');
      await webRTCService.startCall(patientId);
    } catch (error) {
      console.error('[CallContext] Error starting call:', error);
      setStatus('idle');
      throw error;
    }
  }, []);

  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    if (!webRTCService) {
      console.error('[CallContext] WebRTC service not available');
      return;
    }
    try {
      console.log('[CallContext] Handling answer');
      await webRTCService.handleAnswer(answer);
      setStatus('connected');
    } catch (error) {
      console.error('[CallContext] Error handling answer:', error);
      setStatus('idle');
    }
  }, []);

  const endCall = useCallback(() => {
    if (!webRTCService) {
      console.error('[CallContext] WebRTC service not available');
      return;
    }
    console.log('[CallContext] Ending call');
    webRTCService.endCall();
    setStatus('idle');
  }, []);

  const value = {
    status,
    startCall,
    endCall,
    handleAnswer,
  };

  return (
    <CallContext.Provider value={value}>
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