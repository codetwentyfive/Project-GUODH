import React, { useState, useEffect } from 'react';
import { Box, Container, Typography, CircularProgress } from '@mui/material';
import { SocketProvider, useSocket } from '../contexts/SocketContext';
import IncomingCall from '../components/IncomingCall';

interface DashboardContentProps {
  caretakerId: string;
  caretakerName: string;
}

function DashboardContent({ caretakerId, caretakerName }: DashboardContentProps) {
  const { socket } = useSocket();

  return (
    <Container>
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          CareCall Patient App
        </Typography>
        
        {socket && (
          <IncomingCall
            socket={socket}
            caretakerId={caretakerId}
            caretakerName={caretakerName}
          />
        )}
      </Box>
    </Container>
  );
}

function Dashboard() {
  const [caretakerId, setCaretakerId] = useState<string | null>(null);
  const [caretakerName, setCaretakerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get patient data from localStorage or API
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
      return;
    }

    // Fetch patient data
    fetch('http://localhost:3000/api/patients/profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(response => response.json())
      .then(data => {
        setCaretakerId(data.caretakerId);
        setCaretakerName(data.caretakerName);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching patient data:', error);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!caretakerId || !caretakerName) {
    return null;
  }

  return (
    <SocketProvider userId={caretakerId}>
      <DashboardContent 
        caretakerId={caretakerId}
        caretakerName={caretakerName}
      />
    </SocketProvider>
  );
}

export default Dashboard; 