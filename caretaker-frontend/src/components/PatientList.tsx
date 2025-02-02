import React, { useEffect, useState } from 'react';
import {
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  IconButton,
  Paper,
  Typography,
  Box,
  Chip
} from '@mui/material';
import {
  Call as CallIcon,
  Person as PersonIcon,
  FiberManualRecord as StatusIcon
} from '@mui/icons-material';
import { useSocket } from '../contexts/SocketContext';

interface Patient {
  id: string;
  name: string;
  phoneNumber: string;
  isOnline?: boolean;
}

interface PatientListProps {
  onSelectPatient: (patient: Patient) => void;
}

const PatientList: React.FC<PatientListProps> = ({ onSelectPatient }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  useEffect(() => {
    // Fetch patients from API
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch('http://localhost:3000/api/users/profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        setPatients(data.patients.map((p: Patient) => ({ ...p, isOnline: false })));
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching patients:', error);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!socket) return;

    // Listen for online/offline status updates
    socket.on('user-online', (userId: string) => {
      setPatients(prev => prev.map(p => 
        p.id === userId ? { ...p, isOnline: true } : p
      ));
    });

    socket.on('user-offline', (userId: string) => {
      setPatients(prev => prev.map(p => 
        p.id === userId ? { ...p, isOnline: false } : p
      ));
    });

    return () => {
      socket.off('user-online');
      socket.off('user-offline');
    };
  }, [socket]);

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>Loading patients...</Typography>
      </Box>
    );
  }

  if (patients.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>No patients found.</Typography>
      </Box>
    );
  }

  return (
    <Paper sx={{ mt: 2 }}>
      <List>
        {patients.map((patient) => (
          <ListItem key={patient.id} divider>
            <ListItemAvatar>
              <Avatar>
                <PersonIcon />
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={patient.name}
              secondary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {patient.phoneNumber}
                  <Chip
                    size="small"
                    icon={<StatusIcon />}
                    label={patient.isOnline ? 'Online' : 'Offline'}
                    color={patient.isOnline ? 'success' : 'default'}
                    variant="outlined"
                  />
                </Box>
              }
            />
            <ListItemSecondaryAction>
              <IconButton
                edge="end"
                color="primary"
                onClick={() => onSelectPatient(patient)}
                disabled={!patient.isOnline}
              >
                <CallIcon />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};

export default PatientList; 