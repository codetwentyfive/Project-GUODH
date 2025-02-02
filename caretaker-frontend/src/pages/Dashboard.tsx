import React, { useState, useEffect } from 'react';
import { Box, Container, Typography } from '@mui/material';
import { SocketProvider, useSocket } from '../contexts/SocketContext';
import CallInterface from '../components/CallInterface';
import PatientList from '../components/PatientList';

interface Patient {
  id: string;
  name: string;
}

interface DashboardContentProps {
  selectedPatient: Patient | null;
  setSelectedPatient: (patient: Patient | null) => void;
}

function DashboardContent({ selectedPatient, setSelectedPatient }: DashboardContentProps) {
  const { socket } = useSocket();

  return (
    <Container>
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          CareCall Caretaker App
        </Typography>
        
        {selectedPatient && socket ? (
          <CallInterface
            socket={socket}
            patientId={selectedPatient.id}
            patientName={selectedPatient.name}
            onCallEnd={() => setSelectedPatient(null)}
          />
        ) : (
          <PatientList onSelectPatient={setSelectedPatient} />
        )}
      </Box>
    </Container>
  );
}

function Dashboard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  useEffect(() => {
    // Get caretaker data from localStorage or API
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
      return;
    }

    // Fetch caretaker data
    fetch('http://localhost:3000/api/users/profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(response => response.json())
      .then(data => {
        setUserId(data.id);
      })
      .catch(error => {
        console.error('Error fetching caretaker data:', error);
        localStorage.removeItem('token');
        window.location.href = '/login';
      });
  }, []);

  if (!userId) {
    return null;
  }

  return (
    <SocketProvider userId={userId}>
      <DashboardContent 
        selectedPatient={selectedPatient}
        setSelectedPatient={setSelectedPatient}
      />
    </SocketProvider>
  );
}

export default Dashboard; 