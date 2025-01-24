'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { webRTCService } from '@/services/webrtc';
import { socketService } from '@/services/socket';

interface Patient {
  id: string;
  name: string;
  status: string;
}

export default function Home() {
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'connected'>('idle');
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null);
  const [patients] = useState<Patient[]>([
    { id: 'patient-1', name: 'John Doe', status: 'Available' },
    { id: 'patient-2', name: 'Jane Smith', status: 'Available' },
  ]);

  useEffect(() => {
    // Initialize services
    socketService.connect();
    socketService.register('caretaker-1');

    // Handle call status changes
    webRTCService.onConnectionStateChange((state) => {
      console.log('Connection state changed:', state);
      if (state === 'connected') {
        setCallStatus('connected');
      } else if (state === 'disconnected' || state === 'failed') {
        setCallStatus('idle');
        setCurrentPatient(null);
      }
    });

    return () => {
      socketService.disconnect();
    };
  }, []);

  const handleStartCall = async (patient: Patient) => {
    try {
      setCallStatus('calling');
      setCurrentPatient(patient);
      await webRTCService.startCall(patient.id);
    } catch (error) {
      console.error('Failed to start call:', error);
      setCallStatus('idle');
      setCurrentPatient(null);
    }
  };

  const handleEndCall = async () => {
    if (currentPatient) {
      await webRTCService.endCall(currentPatient.id);
      setCallStatus('idle');
      setCurrentPatient(null);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      {callStatus !== 'idle' ? (
        // Call in progress screen
        <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-8">
          <div className="text-center space-y-4">
            <div className="w-24 h-24 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
              <span className="text-4xl">👤</span>
            </div>
            <h2 className="text-2xl font-semibold">{currentPatient?.name}</h2>
            <p className="text-muted-foreground">
              {callStatus === 'calling' ? 'Calling...' : 'Connected'}
            </p>
          </div>
          
          <div className="flex gap-4">
            <Button
              variant="destructive"
              size="lg"
              className="rounded-full w-16 h-16"
              onClick={handleEndCall}
            >
              📞
            </Button>
          </div>
        </div>
      ) : (
        // Patient list screen
        <div className="container mx-auto p-8">
          <h1 className="text-3xl font-semibold text-center mb-8 text-primary">
            CareCall Dashboard
          </h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {patients.map((patient) => (
              <Card key={patient.id} className="shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <h2 className="text-xl font-semibold">{patient.name}</h2>
                  <p className="text-sm text-muted-foreground">{patient.status}</p>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full"
                    onClick={() => handleStartCall(patient)}
                  >
                    Start Call
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
