import { Component, computed, inject, OnDestroy, output, signal } from '@angular/core';
import { Unsubscribe } from 'firebase/firestore';
import { AppUser, Channel } from '../../models';
import { avatarUrl } from '../../shared/avatar-url';
import { AuthService } from '../../services/auth.service';
import { ChannelService } from '../../services/channel.service';
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
  private readonly firestoreChannels = signal<Channel[]>([]);
  private readonly stopWatchingUsers: Unsubscribe;
  private readonly stopWatchingChannels: Unsubscribe;
  channelsOpen = true;
  directMessagesOpen = true;
  selectedConversation = '';
  channelCreateRequested = output<void>();
  newMessageRequested = output<void>();
  conversationSelected = output<{ type: 'channel' | 'direct'; id: string; user?: AppUser }>();

  readonly channels = this.firestoreChannels.asReadonly();
  readonly users = computed(() => this.sortedAccountUsers());

  constructor(userService: UserService, channelService: ChannelService) {
    this.stopWatchingUsers = userService.watchUsers(users => this.firestoreUsers.set(users));
    this.stopWatchingChannels = channelService.watchChannels(channels => this.firestoreChannels.set(channels));
  }

  ngOnDestroy(): void {
    this.stopWatchingUsers();
    this.stopWatchingChannels();
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

  selectConversation(type: 'channel' | 'direct', id: string): void {
    this.selectedConversation = `${type}:${id}`;
    const user = type === 'direct' ? this.users().find(item => item.uid === id) : undefined;
    this.conversationSelected.emit({ type, id, user });
  }
}
