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
export class MembersDialog {
  members = input<AppUser[]>([]);
  currentUserId = input<string | null>(null);
  anchor = input<DOMRect | null>(null);
  canAddMembers = input(false);
  selectedMember = signal<AppUser | null>(null);
  closed = output<void>();
  addRequested = output<void>();
  messageRequested = output<AppUser>();

  get offsetTop(): string {
    const rect = this.anchor();
    return rect ? `${Math.round(rect.bottom + 8)}px` : '130px';
  }

  get offsetRight(): string {
    const rect = this.anchor();
    return rect ? `${Math.round(window.innerWidth - rect.right)}px` : '40px';
  }

  avatar(member: AppUser): string {
    return avatarUrl(member.avatar);
  }

  displayName(member: AppUser): string {
    return this.isCurrentUser(member) ? `${member.name} (Du)` : member.name;
  }

  isCurrentUser(member: AppUser): boolean {
    return member.uid === this.currentUserId();
  }

  isOnline(member: AppUser): boolean {
    return member.status === 'online';
  }

  openProfile(member: AppUser): void { this.selectedMember.set(member); }

  closeProfile(): void { this.selectedMember.set(null); }

  startDirectMessage(member: AppUser): void {
    this.messageRequested.emit(member);
    this.closed.emit();
  }

  closeOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  closeWithEscape(): void {
    this.closed.emit();
  }
}
