import { WebRTCClient } from '@/components/WebRTCClient';

export default function PatientInterface() {
  // In a real app, these would come from URL params or auth context
  const demoPatientId = 'demo-patient-1';
  const demoRoomId = `room-${demoPatientId}-${Date.now()}`;

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">CareCall Patient Interface</h1>
        <p className="mt-2 text-gray-600">Your secure connection to caregivers</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Call Status</h2>
            <WebRTCClient 
              roomId={demoRoomId}
              patientId={demoPatientId}
            />
          </div>

          <div className="p-4 bg-white rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Instructions</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Make sure your microphone is connected and working</li>
              <li>Stay in a quiet environment for better call quality</li>
              <li>Speak clearly and at a normal pace</li>
              <li>Your caregiver will be notified if you need assistance</li>
            </ul>
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Help & Support</h2>
          <div className="space-y-4">
            <p className="text-gray-600">
              If you're having trouble with the call:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Check your internet connection</li>
              <li>Make sure your microphone isn't muted</li>
              <li>Try refreshing the page</li>
              <li>Contact support if problems persist</li>
            </ul>
            <div className="mt-4 p-3 bg-blue-50 rounded-md">
              <p className="text-blue-700 font-medium">Support Contact:</p>
              <p className="text-blue-600">support@carecall.com</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 