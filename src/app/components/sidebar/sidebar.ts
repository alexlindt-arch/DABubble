import { Component, computed, inject, OnDestroy, output, signal } from '@angular/core';
import { Unsubscribe } from 'firebase/firestore';
import { AppUser } from '../../models';
import { avatarUrl } from '../../shared/avatar-url';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';

@Component({
  imports: [],
  selector: 'app-sidebar',
  styleUrl: './sidebar.scss',
  templateUrl: './sidebar.html',
})
export class Sidebar implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly firestoreUsers = signal<AppUser[]>([]);
  private readonly stopWatchingUsers: Unsubscribe;
  channelsOpen = true;
  directMessagesOpen = true;
  selectedConversation = '';
  channelCreateRequested = output<void>();
  newMessageRequested = output<void>();
  conversationSelected = output<{ type: 'channel' | 'direct'; id: string; user?: AppUser }>();

  channels = ['Entwicklerteam', 'Office-team'];
  readonly users = computed(() => this.sortedAccountUsers());

  constructor(userService: UserService) {
    this.stopWatchingUsers = userService.watchUsers(users => this.firestoreUsers.set(users));
  }

  ngOnDestroy(): void {
    this.stopWatchingUsers();
  }

  avatar(user: AppUser): string {
    return avatarUrl(user.avatar);
  }

  isSelf(user: AppUser): boolean {
    return user.uid === this.authService.currentUser()?.uid;
  }

  private sortedAccountUsers(): AppUser[] {
    const currentUid = this.authService.currentUser()?.uid;
    return this.firestoreUsers()
      .filter(user => user.email.trim().length > 0)
      .sort((a, b) => this.compareUsers(a, b, currentUid));
  }

  private compareUsers(a: AppUser, b: AppUser, currentUid?: string): number {
    if (a.uid === currentUid) return -1;
    if (b.uid === currentUid) return 1;
    return a.name.localeCompare(b.name, 'de');
  }

  toggleChannels(): void {
    this.channelsOpen = !this.channelsOpen;
  }

  toggleDirectMessages(): void {
    this.directMessagesOpen = !this.directMessagesOpen;
  }

  addChannel(name: string): void {
    if (this.channels.some(channel => channel.toLocaleLowerCase() === name.toLocaleLowerCase())) return;
    this.channels = [...this.channels, name];
    this.channelsOpen = true;
    this.selectConversation('channel', name);
  }

  selectConversation(type: 'channel' | 'direct', id: string): void {
    this.selectedConversation = `${type}:${id}`;
    const user = type === 'direct' ? this.users().find(item => item.uid === id) : undefined;
    this.conversationSelected.emit({ type, id, user });
  }
}
