import { Component, HostListener, output } from '@angular/core';
import { GUEST_SESSION_MINUTES } from '../../shared/guest-session';

/** Explains guest access permissions and the duration of guest data storage. */
@Component({
  selector: 'app-guest-login-dialog',
  imports: [],
  templateUrl: './guest-login-dialog.html',
  styleUrl: './guest-login-dialog.scss',
})
export class GuestLoginDialog {
  readonly sessionMinutes = GUEST_SESSION_MINUTES;
  closed = output<void>();
  confirmed = output<void>();

  /** Closes the dialog when the backdrop itself is clicked. */
  closeOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }

  /** Closes the dialog when the Escape key is pressed. */
  @HostListener('document:keydown.escape')
  closeWithEscape(): void {
    this.closed.emit();
  }
}
