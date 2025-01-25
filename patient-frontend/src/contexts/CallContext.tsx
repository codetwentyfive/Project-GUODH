'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { socketService } from '@/services/socket';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Import the CallbackData type from the socket service
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

interface CallContextType {
  connect: (userId: string) => Promise<void>;
  connectionStatus: ConnectionStatus;
  currentCall: {
    peerId: string;
    isIncoming: boolean;
  } | null;
  acceptCall: (callerId: string) => void;
  rejectCall: (callerId: string) => void;
  endCall: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [currentCall, setCurrentCall] = useState<{ peerId: string; isIncoming: boolean } | null>(null);

  const connect = useCallback(async (userId: string) => {
    try {
      setConnectionStatus('connecting');
      await socketService.connect();
      await socketService.register(userId);
      setConnectionStatus('connected');
    } catch (error) {
      console.error('Connection error:', error);
      setConnectionStatus('error');
      throw error;
    }
  }, []);

  const acceptCall = useCallback((callerId: string) => {
    setCurrentCall({ peerId: callerId, isIncoming: false });
  }, []);

  const rejectCall = useCallback((callerId: string) => {
    socketService.sendReject(callerId);
    setCurrentCall(null);
  }, []);

  const endCall = useCallback(() => {
    if (currentCall) {
      socketService.sendCallEnd(currentCall.peerId);
      setCurrentCall(null);
    }
  }, [currentCall]);

  React.useEffect(() => {
    socketService.on('call-offer', (data: CallbackData) => {
      if (data.from) {
        setCurrentCall({ peerId: data.from, isIncoming: true });
      }
    });

    socketService.on('call-ended', () => {
      setCurrentCall(null);
    });

    socketService.on('call-rejected', () => {
      setCurrentCall(null);
    });

    return () => {
      socketService.disconnect();
    };
  }, []);

  const value = {
    connect,
    connectionStatus,
    currentCall,
    acceptCall,
    rejectCall,
    endCall,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
} 