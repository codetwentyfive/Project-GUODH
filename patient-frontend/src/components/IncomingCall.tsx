import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { Box, Typography, Button, Avatar, CircularProgress, Alert, LinearProgress } from '@mui/material';
import { Call as CallIcon, CallEnd as CallEndIcon, Mic as MicIcon } from '@mui/icons-material';

interface IncomingCallProps {
  socket: Socket;
  caretakerId: string;
  caretakerName: string;
}

const IncomingCall: React.FC<IncomingCallProps> = ({
  socket,
  caretakerId,
  caretakerName,
}) => {
  const [isCallActive, setIsCallActive] = useState(false);
  const [incomingCall, setIncomingCall] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  const [remoteAudioLevel, setRemoteAudioLevel] = useState(0);
  const [callOffer, setCallOffer] = useState<RTCSessionDescriptionInit | null>(null);

  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Format duration into MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Set up audio analysis
  const setupAudioAnalysis = useCallback((stream: MediaStream, setLevel: (level: number) => void) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    const audioContext = audioContextRef.current;
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const updateLevel = () => {
      if (!isCallActive) return;
      
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((acc, value) => acc + value, 0) / dataArray.length;
      setLevel(Math.min(100, (average / 128) * 100));
      requestAnimationFrame(updateLevel);
    };

    updateLevel();
  }, [isCallActive]);

  type Handlers = {
    handleCallEnd: () => void;
    setupSocketListeners: () => () => void;
    setupWebRTCHandlers: () => void;
  };

  const handlers = useCallback((): Handlers => {
    const cleanupCall = () => {
      // Stop all tracks
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      
      // Close peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }

      // Reset state
      setIsCallActive(false);
      setIncomingCall(false);
      setIsConnecting(false);
      setLocalAudioLevel(0);
      setRemoteAudioLevel(0);
      setError(null);
      
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };

    const handleCallEnd = () => {
      if (incomingCall && !isCallActive) {
        // If we're rejecting an incoming call
        socket.emit('call-rejected', { targetId: caretakerId });
      } else {
        // If we're ending an active call
        socket.emit('end-call', { targetId: caretakerId });
      }
      cleanupCall();
    };

    const setupWebRTCHandlers = () => {
      if (!peerConnectionRef.current) return;

      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', {
            targetId: caretakerId,
            candidate: event.candidate,
          });
        }
      };

      peerConnectionRef.current.ontrack = (event) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
          setupAudioAnalysis(event.streams[0], setRemoteAudioLevel);
        }
      };

      peerConnectionRef.current.onconnectionstatechange = () => {
        const state = peerConnectionRef.current?.connectionState;
        console.log('Connection state:', state);
        
        if (state === 'connected') {
          setIsCallActive(true);
          setIsConnecting(false);
          setError(null);
        } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          handleCallEnd();
        }
      };
    };

    const setupSocketListeners = () => {
      const handleCallOffer = async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
        if (from === caretakerId) {
          setIncomingCall(true);
          setCallOffer(offer);
        }
      };

      const handleIceCandidate = async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
        if (from === caretakerId) {
          try {
            if (peerConnectionRef.current) {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
              console.log('✅ ICE candidate added successfully');
            }
          } catch (error) {
            console.error('❌ Error adding ICE candidate:', error);
          }
        }
      };

      const handleCallEnded = ({ from }: { from: string }) => {
        if (from === caretakerId) {
          handleCallEnd();
        }
      };

      socket.on('call-offer', handleCallOffer);
      socket.on('ice-candidate', handleIceCandidate);
      socket.on('call-ended', handleCallEnded);

      return () => {
        socket.off('call-offer', handleCallOffer);
        socket.off('ice-candidate', handleIceCandidate);
        socket.off('call-ended', handleCallEnded);
      };
    };

    return { handleCallEnd, setupSocketListeners, setupWebRTCHandlers };
  }, [socket, caretakerId, incomingCall, isCallActive, setupAudioAnalysis]);

  const { handleCallEnd, setupSocketListeners, setupWebRTCHandlers } = handlers();

  useEffect(() => {
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };

    peerConnectionRef.current = new RTCPeerConnection(configuration);
    const cleanup = setupSocketListeners();
    setupWebRTCHandlers();

    return () => {
      cleanup();
      handleCallEnd();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [setupSocketListeners, setupWebRTCHandlers, handleCallEnd]);

  // Start duration timer when call becomes active
  useEffect(() => {
    if (isCallActive) {
      setDuration(0);
      durationIntervalRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [isCallActive]);

  const acceptCall = async () => {
    if (!callOffer) return;
    setIsConnecting(true);
    setError(null);
    
    try {
      // Get user's audio
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = localStreamRef.current;
        setupAudioAnalysis(localStreamRef.current, setLocalAudioLevel);
      }

      // Add tracks to peer connection
      localStreamRef.current.getTracks().forEach(track => {
        if (peerConnectionRef.current && localStreamRef.current) {
          peerConnectionRef.current.addTrack(track, localStreamRef.current);
        }
      });

      // Set remote description (offer)
      await peerConnectionRef.current?.setRemoteDescription(new RTCSessionDescription(callOffer));

      // Create and set local description (answer)
      const answer = await peerConnectionRef.current?.createAnswer();
      await peerConnectionRef.current?.setLocalDescription(answer);

      // Send answer to caretaker
      socket.emit('call-answer', {
        targetId: caretakerId,
        answer,
      });

      setIncomingCall(false);
    } catch (error) {
      console.error('Error accepting call:', error);
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access and try again.');
      } else if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred');
      }
      setIsConnecting(false);
      handleCallEnd();
    }
  };

  if (!incomingCall && !isCallActive && !isConnecting) {
    return null;
  }

  return (
    <Box sx={{ 
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      bgcolor: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <Avatar
        sx={{ width: 100, height: 100, mb: 2 }}
        alt={caretakerName}
      />
      <Typography variant="h5" sx={{ color: 'white', mb: 3 }}>
        {incomingCall ? `Incoming call from ${caretakerName}` : 
         isConnecting ? 'Connecting...' :
         `In call with ${caretakerName} (${formatDuration(duration)})`}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2, maxWidth: 400 }}>
          {error}
        </Alert>
      )}

      {isCallActive && (
        <Box sx={{ mb: 3, width: '100%', maxWidth: 400, px: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <MicIcon sx={{ mr: 1, color: 'white' }} />
            <LinearProgress 
              variant="determinate" 
              value={localAudioLevel} 
              sx={{ flexGrow: 1, bgcolor: 'rgba(255,255,255,0.2)' }}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar 
              sx={{ width: 24, height: 24, mr: 1 }}
              alt={caretakerName}
            />
            <LinearProgress 
              variant="determinate" 
              value={remoteAudioLevel}
              sx={{ flexGrow: 1, bgcolor: 'rgba(255,255,255,0.2)' }}
            />
          </Box>
        </Box>
      )}
      
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        {incomingCall && !isCallActive && (
          <>
            <Button
              variant="contained"
              color="success"
              startIcon={<CallIcon />}
              onClick={acceptCall}
              disabled={isConnecting}
              sx={{ borderRadius: 28 }}
            >
              Accept
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<CallEndIcon />}
              onClick={handleCallEnd}
              sx={{ borderRadius: 28 }}
            >
              Decline
            </Button>
          </>
        )}

        {isConnecting && (
          <CircularProgress sx={{ color: 'white' }} />
        )}

        {isCallActive && (
          <Button
            variant="contained"
            color="error"
            startIcon={<CallEndIcon />}
            onClick={handleCallEnd}
            sx={{ borderRadius: 28 }}
          >
            End Call
          </Button>
        )}
      </Box>

      <audio ref={localAudioRef} autoPlay muted />
      <audio ref={remoteAudioRef} autoPlay />
    </Box>
  );
};

export default IncomingCall; 