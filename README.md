# CareCall - Real-time Audio Communication Platform

A WebRTC-based platform enabling real-time audio communication between caretakers and patients. Built with Next.js, TypeScript, and Socket.IO.

## Project Structure

```
Project-GUODH/
├── backend/             # Node.js + Express + Socket.IO server
├── caretaker-frontend/  # Next.js frontend for caretakers
└── patient-frontend/    # Next.js frontend for patients
```

## Features

- **Real-time Audio Calls**: WebRTC-powered audio communication
- **Role-based Interfaces**: Separate UIs for caretakers and patients
- **Modern UI**: Built with Shadcn UI components
- **Signaling Server**: Socket.IO-based server for WebRTC signaling
- **Connection Management**: Robust handling of WebRTC connections and ICE candidates

## Technical Stack

- **Frontend**:
  - Next.js 15.1.6
  - TypeScript
  - Tailwind CSS
  - Shadcn UI Components
  - Socket.IO Client
  - WebRTC API

- **Backend**:
  - Node.js
  - Express
  - Socket.IO
  - TypeScript

## Getting Started

1. Start the backend server:
```bash
cd backend
npm install
npm run dev
```

2. Start the patient frontend:
```bash
cd patient-frontend
npm install
npm run dev
```

3. Start the caretaker frontend:
```bash
cd caretaker-frontend
npm install
npm run dev
```

## Access Points

- Backend: http://localhost:3000
- Patient Interface: http://localhost:3001
- Caretaker Interface: http://localhost:3002

## Current Implementation

### Backend
- Socket.IO server handling WebRTC signaling
- User registration and management
- Event handling for call offers, answers, ICE candidates, and call termination

### Caretaker Frontend
- List of available patients
- Call initiation functionality
- Real-time audio streaming
- Call status management
- Connection state monitoring

### Patient Frontend
- Incoming call notifications
- Call accept/reject functionality
- Active call interface
- Connection state monitoring

### WebRTC Implementation
- Audio-only calls
- ICE candidate handling
- Connection state management
- Automatic cleanup on call end

### Socket Events
- `register`: User registration
- `call-offer`: Initial call setup
- `call-answered`: Call acceptance
- `ice-candidate`: Network candidate exchange
- `call-ended`: Call termination

## Development Status

The application currently supports:
- Basic audio calls between caretakers and patients
- User registration and presence
- Call state management
- Real-time connection status updates

## Known Issues

1. Socket reconnection handling needs improvement
2. ICE candidate timing synchronization
3. Multiple socket connections on page refresh

## Next Steps

1. Improve error handling and recovery
2. Add call quality monitoring
3. Implement user authentication
4. Add call history tracking
5. Enhance UI feedback during connection establishment

## Testing

To test the application:
1. Open the patient interface (http://localhost:3001)
2. Open the caretaker interface (http://localhost:3002)
3. Initiate a call from the caretaker interface
4. Accept the call on the patient interface
5. Check browser console for connection logs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

[Add appropriate license]
