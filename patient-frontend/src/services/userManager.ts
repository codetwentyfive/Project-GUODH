import { socketService } from './socket';

export interface User {
  id: string;
  name: string;
  type: 'patient' | 'caretaker';
  room?: string;
  status: 'online' | 'offline' | 'in-call';
}

type UserStatus = 'offline' | 'online' | 'in-call';

class UserManager {
  private currentUser: User | null = null;
  private isInitialized = false;
  private connectionRetryCount = 0;
  private readonly MAX_RETRIES = 3;
  private currentStatus: UserStatus = 'offline';
  private statusChangeCallbacks: ((status: UserStatus) => void)[] = [];

  async initialize(userId: string, userType: 'patient' | 'caretaker'): Promise<void> {
    if (this.isInitialized) {
      console.log('[UserManager] Already initialized');
      return;
    }

    try {
      // Set up the current user
      this.currentUser = {
        id: userId,
        name: userId, // You might want to fetch the actual name from your backend
        type: userType,
        status: 'offline'
      };

      // Initialize socket connection
      await this.connectWithRetry();
      this.isInitialized = true;

    } catch (error) {
      console.error('[UserManager] Initialization failed:', error);
      throw error;
    }
  }

  private async connectWithRetry(): Promise<void> {
    while (this.connectionRetryCount < this.MAX_RETRIES) {
      try {
        await socketService.connect();
        await socketService.register(this.currentUser!.id);
        this.currentUser!.status = 'online';
        this.connectionRetryCount = 0; // Reset counter on successful connection
        return;
      } catch (error) {
        this.connectionRetryCount++;
        console.error(`[UserManager] Connection attempt ${this.connectionRetryCount} failed:`, error);
        if (this.connectionRetryCount === this.MAX_RETRIES) {
          throw new Error('Failed to establish connection after maximum retries');
        }
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, this.connectionRetryCount)));
      }
    }
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  updateUserStatus(status: UserStatus): void {
    if (this.currentStatus !== status) {
      console.log('[UserManager] Status changed:', status);
      this.currentStatus = status;
      this.notifyStatusChange();
    }
  }

  getCurrentStatus(): UserStatus {
    return this.currentStatus;
  }

  onStatusChange(callback: (status: UserStatus) => void): void {
    this.statusChangeCallbacks.push(callback);
  }

  private notifyStatusChange(): void {
    this.statusChangeCallbacks.forEach(callback => callback(this.currentStatus));
  }

  async disconnect(): Promise<void> {
    if (this.currentUser) {
      this.currentUser.status = 'offline';
      socketService.disconnect();
      this.isInitialized = false;
      this.currentUser = null;
    }
  }
}

export const userManager = new UserManager();
export type { UserStatus }; 