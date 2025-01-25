'use client';

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useCall } from '@/contexts/CallContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, Phone, Signal, Settings, User as UserIcon } from 'lucide-react'
import { mockUserService, type User as PatientUser } from '@/services/mockUsers'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { CallScreen } from '@/components/CallScreen'

export default function Home() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { connect, connectionStatus, currentCall, acceptCall, rejectCall, endCall } = useCall()
  const patientId = searchParams.get('patientId')
  const [user, setUser] = useState<PatientUser | undefined>()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function initializeUser() {
      try {
        if (!patientId) {
          // If no patientId is provided, redirect to patient-1 for demo purposes
          router.push('/?patientId=patient-1')
          return
        }

        const userDetails = mockUserService.getPatientDetails(patientId)
        if (!userDetails) {
          toast.error('Invalid patient ID')
          router.push('/?patientId=patient-1')
          return
        }

        setUser(userDetails)
        await connect(patientId)
        toast.success('Connected successfully')
      } catch (error) {
        console.error('Connection error:', error)
        toast.error('Failed to connect. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }

    initializeUser()
  }, [patientId, connect, router])

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading patient details...</p>
        </div>
      </div>
    )
  }

  // Show call screen if there's an active call
  if (currentCall) {
    return (
      <CallScreen
        peerId={currentCall.peerId}
        isIncoming={currentCall.isIncoming}
        onAccept={() => acceptCall(currentCall.peerId)}
        onReject={() => rejectCall(currentCall.peerId)}
        onEnd={endCall}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Welcome Back, {user.name}
          </h2>
          <div className="mt-1 flex flex-col sm:mt-0 sm:flex-row sm:flex-wrap sm:space-x-6">
            <div className="mt-2 flex items-center text-sm text-gray-500">
              <Signal className="mr-1.5 h-5 w-5 flex-shrink-0 text-gray-400" />
              Status: {' '}
              <Badge variant={connectionStatus === 'connected' ? 'success' : 'warning'} className="ml-2">
                {connectionStatus === 'connected' ? 'Online' : 'Connecting...'}
              </Badge>
            </div>
            <div className="mt-2 flex items-center text-sm text-gray-500">
              <UserIcon className="mr-1.5 h-5 w-5 flex-shrink-0 text-gray-400" />
              Patient ID: {user.id}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-50">
              <Calendar className="h-6 w-6 text-indigo-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">Upcoming Calls</h3>
              <p className="mt-1 text-sm text-gray-500">View your scheduled appointments</p>
            </div>
          </div>
          <div className="mt-4">
            <Button variant="outline" className="w-full">
              View Schedule
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-50">
              <Phone className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">Available Caretakers</h3>
              <p className="mt-1 text-sm text-gray-500">
                {mockUserService.getAvailableCaretakers().length} caretakers online
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Button variant="outline" className="w-full">
              View Caretakers
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
              <Settings className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">Call Settings</h3>
              <p className="mt-1 text-sm text-gray-500">Configure your call preferences</p>
            </div>
          </div>
          <div className="mt-4">
            <Button variant="outline" className="w-full">
              Configure
            </Button>
          </div>
        </Card>
      </div>

      {/* Connection Status */}
      <Card className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Connection Details</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Signal className="h-5 w-5 text-gray-400 mr-2" />
              <span className="text-sm font-medium text-gray-700">WebRTC Status</span>
            </div>
            <Badge variant={connectionStatus === 'connected' ? 'success' : 'warning'}>
              {connectionStatus === 'connected' ? 'Connected' : 'Connecting'}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <UserIcon className="h-5 w-5 text-gray-400 mr-2" />
              <span className="text-sm font-medium text-gray-700">User Status</span>
            </div>
            <Badge variant={user.status === 'available' ? 'success' : 'warning'}>
              {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Call History Preview */}
      <Card className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
        <div className="divide-y divide-gray-200">
          {[
            { id: 1, type: 'Incoming Call', from: 'Dr. Emily Brown', date: '2024-01-24', status: 'Completed', duration: '15 mins' },
            { id: 2, type: 'Outgoing Call', from: 'Dr. Michael Wilson', date: '2024-01-23', status: 'Missed', duration: '-' },
            { id: 3, type: 'Incoming Call', from: 'Dr. Emily Brown', date: '2024-01-22', status: 'Completed', duration: '30 mins' },
          ].map((call) => (
            <div key={call.id} className="py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{call.type}</p>
                <p className="text-xs text-gray-500">From: {call.from}</p>
                <p className="text-xs text-gray-500">{call.date}</p>
              </div>
              <div className="flex items-center">
                <Badge variant={call.status === 'Completed' ? 'success' : 'destructive'}>
                  {call.status}
                </Badge>
                <span className="ml-4 text-sm text-gray-500">{call.duration}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
