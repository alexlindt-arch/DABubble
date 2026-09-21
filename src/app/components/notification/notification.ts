import { Component, inject } from '@angular/core';
import { NotificationService } from '../../services/notification.service';

/** Renders global success and error feedback for the current user. */
@Component({
  selector: 'app-notification',
  template: `@if (notification.current(); as item) {<div class="app-notification" [class.error]="item.type === 'error'" role="status" aria-live="polite">{{ item.message }}</div>}`,
  styleUrl: './notification.scss',
})
export class Notification {
  readonly notification = inject(NotificationService);
}
