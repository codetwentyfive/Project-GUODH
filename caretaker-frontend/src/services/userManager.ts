type UserStatus = 'offline' | 'online' | 'in-call';

class UserManager {
  private currentStatus: UserStatus = 'offline';
  private statusChangeCallbacks: ((status: UserStatus) => void)[] = [];

  constructor() {
    // Initialize as offline
    this.currentStatus = 'offline';
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
}

export const userManager = new UserManager();
export type { UserStatus }; 