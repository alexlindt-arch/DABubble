import { Component, HostListener, input, output, signal } from '@angular/core';
import { AppUser } from '../../models';
import { avatarUrl } from '../../shared/avatar-url';
import { ProfileDialog } from '../profile-dialog/profile-dialog';

@Component({
  selector: 'app-members-dialog',
  imports: [ProfileDialog],
  templateUrl: './members-dialog.html',
  styleUrl: './members-dialog.scss',
})
/** Displays channel members and provides member interaction actions. */
export class MembersDialog {
  members = input<AppUser[]>([]);
  currentUserId = input<string | null>(null);
  anchor = input<DOMRect | null>(null);
  canAddMembers = input(false);
  selectedMember = signal<AppUser | null>(null);
  closed = output<void>();
  addRequested = output<void>();
  messageRequested = output<AppUser>();

  /** Calculates the dialog's top position from its anchor element. */
  get offsetTop(): string {
    const rect = this.anchor();
    return rect ? `${Math.round(rect.bottom + 8)}px` : '130px';
  }

  /** Calculates the dialog's right offset from its anchor element. */
  get offsetRight(): string {
    const rect = this.anchor();
    return rect ? `${Math.round(window.innerWidth - rect.right)}px` : '40px';
  }

  /** Returns the avatar URL for a member. */
  avatar(member: AppUser): string {
    return avatarUrl(member.avatar);
  }

  /** Returns the member name with the current-user suffix when applicable. */
  displayName(member: AppUser): string {
    return this.isCurrentUser(member) ? `${member.name} (Du)` : member.name;
  }

  /** Checks whether a member is the currently authenticated user. */
  isCurrentUser(member: AppUser): boolean {
    return member.uid === this.currentUserId();
  }

  /** Checks whether a member is currently online. */
  isOnline(member: AppUser): boolean {
    return member.status === 'online';
  }

  /** Opens the selected member's profile dialog. */
  openProfile(member: AppUser): void { this.selectedMember.set(member); }

  /** Closes the selected member's profile dialog. */
  closeProfile(): void { this.selectedMember.set(null); }

  /** Starts a direct conversation with a member and closes this dialog. */
  startDirectMessage(member: AppUser): void {
    this.messageRequested.emit(member);
    this.closed.emit();
  }

  /** Closes the dialog when the backdrop itself is clicked. */
  closeOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  /** Closes the dialog when the Escape key is pressed. */
  closeWithEscape(): void {
    this.closed.emit();
  }
}
