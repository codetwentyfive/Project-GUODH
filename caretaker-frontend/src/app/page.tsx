'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CallProvider } from '@/contexts/CallContext';
import { CallScreen } from '@/components/CallScreen';
import { useCall } from '@/contexts/CallContext';

interface Patient {
  id: string;
  name: string;
  room: string;
  lastCheck: string;
  priority: 'normal' | 'high' | 'urgent';
  notes?: string;
}

const MOCK_PATIENTS: Patient[] = [
  {
    id: 'john-doe',
    name: 'John Doe',
    room: '101',
    lastCheck: '10:30 AM',
    priority: 'normal',
    notes: 'Regular checkup needed'
  },
  {
    id: 'jane-smith',
    name: 'Jane Smith',
    room: '102',
    lastCheck: '11:15 AM',
    priority: 'high',
    notes: 'Blood pressure monitoring'
  }
];

function PatientList() {
  const { state, startCall } = useCall();
  const isInCall = state.status !== 'idle';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
      {MOCK_PATIENTS.map((patient) => (
        <Card key={patient.id} className="p-4 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-medium">{patient.name}</h3>
              <p className="text-sm text-muted-foreground">Room {patient.room}</p>
              <div className="mt-2 space-y-1">
                <p className="text-sm">Last Check: {patient.lastCheck}</p>
                <p className="text-sm">Priority: {patient.priority}</p>
                {patient.notes && (
                  <p className="text-sm text-muted-foreground">{patient.notes}</p>
                )}
              </div>
            </div>
            <Button
              onClick={() => startCall(patient.id, patient.name)}
              disabled={isInCall}
            >
              Call Patient
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function CaretakerPage() {
  return (
    <CallProvider>
      <main className="min-h-screen bg-background p-8">
        <h1 className="text-3xl font-semibold text-center mb-8 text-primary">
          Caretaker Dashboard
        </h1>
        <PatientList />
        <CallScreen />
      </main>
    </CallProvider>
  );
}
