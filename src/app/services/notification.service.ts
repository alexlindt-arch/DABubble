import { Injectable, signal } from '@angular/core';

export type NotificationType = 'success' | 'error';

export interface AppNotification {
  message: string;
  type: NotificationType;
}

/** Provides short-lived, accessible feedback messages across the application. */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  readonly current = signal<AppNotification | null>(null);
  private timer: ReturnType<typeof setTimeout> | null = null;

  /** Displays a success message and replaces any previous notification. */
  success(message: string): void { this.show(message, 'success'); }

  /** Displays an error message and replaces any previous notification. */
  error(message: string): void { this.show(message, 'error'); }

  /** Stores a notification and schedules its automatic dismissal. */
  private show(message: string, type: NotificationType): void {
    if (this.timer) clearTimeout(this.timer);
    this.current.set({ message, type });
    this.timer = setTimeout(() => this.current.set(null), 2800);
  }
}
