import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { Box, Typography, Button, Avatar, CircularProgress, Alert, LinearProgress } from '@mui/material';
import { Call as CallIcon, CallEnd as CallEndIcon, Mic as MicIcon } from '@mui/icons-material';

interface CallInterfaceProps {
  socket: Socket;
  patientId: string;
  patientName: string;
  onCallEnd: () => void;
}

const CallInterface: React.FC<CallInterfaceProps> = ({
  socket,
  patientId,
  patientName,
  onCallEnd,
}) => {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  const [remoteAudioLevel, setRemoteAudioLevel] = useState(0);

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
      setIsCalling(false);
      setIsConnecting(false);
      setLocalAudioLevel(0);
      setRemoteAudioLevel(0);
      setError(null);
      
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };

    const handleCallEnd = () => {
      socket.emit('end-call', { targetId: patientId });
      cleanupCall();
      onCallEnd();
    };

    const setupWebRTCHandlers = () => {
      if (!peerConnectionRef.current) return;

      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', {
            targetId: patientId,
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
      const handleCallAnswered = async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
        try {
          if (peerConnectionRef.current) {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
            console.log('✅ Remote description set successfully');
            setIsConnecting(true);
            setIsCalling(false);
          }
        } catch (error) {
          console.error('❌ Error setting remote description:', error);
          handleCallEnd();
        }
      };

      const handleIceCandidate = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
        try {
          if (peerConnectionRef.current) {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('✅ ICE candidate added successfully');
          }
        } catch (error) {
          console.error('❌ Error adding ICE candidate:', error);
        }
      };

      const handleCallError = ({ message }: { message: string }) => {
        console.error('Call error:', message);
        setError(message);
        setIsCalling(false);
        handleCallEnd();
      };

      socket.on('call-answered', handleCallAnswered);
      socket.on('ice-candidate', handleIceCandidate);
      socket.on('call-ended', handleCallEnd);
      socket.on('call-error', handleCallError);

      return () => {
        socket.off('call-answered', handleCallAnswered);
        socket.off('ice-candidate', handleIceCandidate);
        socket.off('call-ended', handleCallEnd);
        socket.off('call-error', handleCallError);
      };
    };

    return { handleCallEnd, setupSocketListeners, setupWebRTCHandlers };
  }, [socket, patientId, setupAudioAnalysis, onCallEnd]);

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

  const startCall = async () => {
    try {
      setError(null);
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

      // Create and send offer
      const offer = await peerConnectionRef.current?.createOffer();
      await peerConnectionRef.current?.setLocalDescription(offer);

      socket.emit('call-offer', {
        targetId: patientId,
        offer,
      });

      setIsCalling(true);
    } catch (error) {
      console.error('Error starting call:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred');
      }
      handleCallEnd();
    }
  };

  return (
    <Box sx={{ textAlign: 'center', p: 3 }}>
      <Avatar
        sx={{ width: 100, height: 100, margin: '0 auto', mb: 2 }}
        alt={patientName}
      />
      <Typography variant="h5" gutterBottom>
        {patientName}
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Typography variant="body1" sx={{ mb: 2, color: 'text.secondary' }}>
        {isCalling ? 'Calling...' : 
         isConnecting ? 'Connecting...' :
         isCallActive ? `In call (${formatDuration(duration)})` : 'Ready to call'}
      </Typography>

      {isCallActive && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <MicIcon sx={{ mr: 1 }} />
            <LinearProgress 
              variant="determinate" 
              value={localAudioLevel} 
              sx={{ flexGrow: 1 }}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar 
              sx={{ width: 24, height: 24, mr: 1 }}
              alt={patientName}
            />
            <LinearProgress 
              variant="determinate" 
              value={remoteAudioLevel}
              sx={{ flexGrow: 1 }}
            />
          </Box>
        </Box>
      )}
      
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
        {!isCallActive && !isCalling && !isConnecting && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<CallIcon />}
            onClick={startCall}
            sx={{ borderRadius: 28 }}
          >
            Start Call
          </Button>
        )}

        {(isConnecting || isCalling) && (
          <>
            <CircularProgress size={24} sx={{ mr: 2 }} />
            <Button
              variant="contained"
              color="error"
              startIcon={<CallEndIcon />}
              onClick={handleCallEnd}
              sx={{ borderRadius: 28 }}
            >
              Cancel
            </Button>
          </>
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

export default CallInterface; 