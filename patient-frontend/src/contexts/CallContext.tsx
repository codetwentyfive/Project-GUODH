'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { webRTCService } from '@/services/webrtc';
import { socketService } from '@/services/socket';
import type { CallbackData } from '@/services/socket';

type CallStatus = 'idle' | 'connecting' | 'incoming' | 'connected' | 'error';

interface CallerInfo {
  id: string;
  name: string;
}

interface CallState {
  status: CallStatus;
  caller: CallerInfo | null;
  error: string | null;
  isRegistered: boolean;
  isConnecting: boolean;
}

interface CallContextType extends CallState {
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
}

const CallContext = createContext<CallContextType | null>(null);

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

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CallState>({
    status: 'idle',
    caller: null,
    error: null,
    isRegistered: false,
    isConnecting: true
  });

  const updateState = useCallback((updates: Partial<CallState>) => {
    setState(current => ({ ...current, ...updates }));
  }, []);

  const handleCallOffer = useCallback(async (data: CallbackData) => {
    console.log('[CallContext] Call offer received:', data);
    if (!data.from || !data.offer) {
      console.error('[CallContext] Invalid call offer received');
      return;
    }

    try {
      console.log('[CallContext] Processing call from:', data.from);
      
      updateState({
        status: 'incoming',
        caller: {
          id: data.from,
          name: CARETAKERS[data.from] || 'Unknown Caretaker'
        }
      });
      
      await webRTCService.handleIncomingCall(data.from, data.offer);
    } catch (err) {
      console.error('[CallContext] Error handling call offer:', err);
      updateState({
        status: 'error',
        error: 'Failed to process incoming call',
        caller: null
      });
    }
  }, [updateState]);

  const handleCallEnded = useCallback(() => {
    console.log('[CallContext] Call ended');
    updateState({
      status: 'idle',
      caller: null,
      error: null
    });
    webRTCService.endCall();
  }, [updateState]);

  const handleConnectionStateChange = useCallback((state: string) => {
    console.log('[CallContext] WebRTC state change:', state);
    
    switch (state) {
      case 'connected':
        updateState({
          status: 'connected',
          error: null
        });
        break;
      case 'disconnected':
      case 'failed':
        updateState({
          status: 'idle',
          caller: null,
          error: state === 'failed' ? 'Call connection failed' : null
        });
        break;
      default:
        break;
    }
  }, [updateState]);

  useEffect(() => {
    let mounted = true;
    let retryTimeout: NodeJS.Timeout;
    let retryCount = 0;
    const MAX_RETRIES = 3;

    const initializeServices = async () => {
      try {
        updateState({
          status: 'connecting',
          error: null,
          isConnecting: true
        });
        
        const patientId = getPatientId();
        console.log('[CallContext] Connecting socket service...');
        await socketService.connect();
        
        console.log('[CallContext] Registering as patient:', patientId);
        await socketService.register(patientId);
        
        if (mounted) {
          console.log('[CallContext] Registered successfully as:', patientId);
          updateState({
            isRegistered: true,
            error: null,
            isConnecting: false,
            status: 'idle'
          });
        }
      } catch (err) {
        console.error('[CallContext] Registration failed:', err);
        if (mounted) {
          updateState({
            error: err instanceof Error ? err.message : 'Failed to connect to service',
            isRegistered: false,
            isConnecting: false,
            status: 'error'
          });

          // Retry logic
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            console.log(`[CallContext] Retrying connection (${retryCount}/${MAX_RETRIES})...`);
            retryTimeout = setTimeout(initializeServices, 2000);
          }
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
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      socketService.disconnect();
      webRTCService.endCall();
    };
  }, [handleCallOffer, handleCallEnded, handleConnectionStateChange, updateState]);

  const acceptCall = async () => {
    if (state.status !== 'incoming' || !state.caller) {
      console.error('[CallContext] Cannot accept call: no incoming call');
      return;
    }

    try {
      console.log('[CallContext] Accepting call from:', state.caller.id);
      await webRTCService.acceptCall();
      updateState({ status: 'connected', error: null });
    } catch (err) {
      console.error('[CallContext] Failed to accept call:', err);
      updateState({
        status: 'error',
        error: 'Failed to accept call',
        caller: null
      });
    }
  };

  const rejectCall = async () => {
    if (!state.caller) return;

    try {
      await webRTCService.rejectCall();
      updateState({
        status: 'idle',
        caller: null,
        error: null
      });
    } catch (err) {
      console.error('[CallContext] Failed to reject call:', err);
      updateState({
        status: 'error',
        error: 'Failed to reject call'
      });
    }
  };

  const endCall = async () => {
    if (!state.caller) return;

    try {
      await webRTCService.endCall();
      updateState({
        status: 'idle',
        caller: null,
        error: null
      });
    } catch (err) {
      console.error('[CallContext] Failed to end call:', err);
      updateState({
        status: 'error',
        error: 'Failed to end call'
      });
    }
  };

  const value = {
    ...state,
    acceptCall,
    rejectCall,
    endCall
  };

  return (
    <CallContext.Provider value={value}>
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