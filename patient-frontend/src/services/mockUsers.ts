interface User {
  id: string;
  name: string;
  type: 'patient' | 'caretaker';
  status: 'available' | 'busy' | 'offline';
}

// Mock database of users
const mockUsers: User[] = [
  {
    id: 'patient-1',
    name: 'John Smith',
    type: 'patient',
    status: 'available'
  },
  {
    id: 'patient-2',
    name: 'Sarah Johnson',
    type: 'patient',
    status: 'available'
  },
  {
    id: 'caretaker-1',
    name: 'Dr. Emily Brown',
    type: 'caretaker',
    status: 'available'
  },
  {
    id: 'caretaker-2',
    name: 'Dr. Michael Wilson',
    type: 'caretaker',
    status: 'available'
  }
];

class MockUserService {
  private users: Map<string, User>;

  constructor() {
    this.users = new Map(mockUsers.map(user => [user.id, user]));
  }

  getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  updateUserStatus(userId: string, status: User['status']): void {
    const user = this.users.get(userId);
    if (user) {
      user.status = status;
      this.users.set(userId, user);
    }
  }

  getAvailableCaretakers(): User[] {
    return Array.from(this.users.values()).filter(
      user => user.type === 'caretaker' && user.status === 'available'
    );
  }

  getPatientDetails(patientId: string): User | undefined {
    const user = this.users.get(patientId);
    return user?.type === 'patient' ? user : undefined;
  }
}

export const mockUserService = new MockUserService();
export type { User }; 