'use client';

import { useEffect } from 'react';
import { useCall } from '@/contexts/CallContext';
import { mockUserService } from '@/services/mockUsers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CallScreen } from '@/components/CallScreen';
import toast from 'react-hot-toast';

export default function Home() {
  const { connect, connectionStatus, currentCall } = useCall();

  useEffect(() => {
    // Connect as caretaker-1 on mount
    connect('caretaker-1').catch((error) => {
      console.error('Failed to connect:', error);
      toast.error('Failed to connect to server');
    });
  }, [connect]);

  return (
    <main className="container mx-auto p-4">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Caretaker Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge variant={connectionStatus === 'connected' ? 'success' : 'warning'}>
              {connectionStatus === 'connected' ? 'Connected' : 'Connecting...'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {currentCall ? (
        <CallScreen 
          peerId={currentCall.peerId} 
          isIncoming={currentCall.isIncoming} 
        />
      ) : (
        <PatientList />
      )}
    </main>
  );
}

function PatientList() {
  const { initiateCall } = useCall();
  const patients = mockUserService.getAvailablePatients();

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {patients.map((patient) => (
        <Card key={patient.id}>
          <CardHeader>
            <CardTitle>{patient.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Badge variant={patient.status === 'available' ? 'success' : 'warning'}>
                {patient.status}
              </Badge>
              <Button 
                onClick={() => initiateCall(patient.id)}
                disabled={patient.status !== 'available'}
              >
                Start Call
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
