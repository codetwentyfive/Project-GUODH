import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';

interface WebRTCClientProps {
  roomId: string;
  patientId: string;
}

export function WebRTCClient({ roomId, patientId }: WebRTCClientProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const deviceRef = useRef<mediasoupClient.Device | null>(null);
  const producerRef = useRef<mediasoupClient.types.Producer | null>(null);

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000');
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to signaling server');
      setIsConnected(true);
      socket.emit('join-room', { roomId, patientId });
    });

    socket.on('transport-options', async (options: TransportOptions) => {
      try {
        if (!deviceRef.current) {
          deviceRef.current = new mediasoupClient.Device();
        }

        await deviceRef.current.load({ routerRtpCapabilities: options.routerRtpCapabilities });
        const transport = deviceRef.current.createSendTransport(options);

        transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            socket.emit('connect-transport', { dtlsParameters });
            callback();
          } catch (error) {
            errback(error as Error);
          }
        });

        transport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
          try {
            socket.emit('produce', { kind, rtpParameters });
            socket.once('producer-created', ({ id }) => callback({ id }));
          } catch (error) {
            errback(error as Error);
          }
        });

        // Get audio stream
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const track = stream.getAudioTracks()[0];
        producerRef.current = await transport.produce({ track });

      } catch (error) {
        console.error('Failed to setup WebRTC:', error);
        setError('Failed to setup audio call');
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from signaling server');
    });

    socket.on('connection-error', ({ error: connectionError }) => {
      setError(connectionError);
    });

    return () => {
      if (producerRef.current) {
        producerRef.current.close();
      }
      socket.disconnect();
    };
  }, [roomId, patientId]);

  return (
    <div className="p-4 rounded-lg bg-white shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Audio Call</h2>
        <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      </div>
      {error && (
        <div className="p-3 rounded bg-red-100 text-red-700 mb-4">
          {error}
        </div>
      )}
      <div className="text-sm text-gray-600">
        {isConnected ? 'Connected to call' : 'Connecting to call...'}
      </div>
    </div>
  );
} 