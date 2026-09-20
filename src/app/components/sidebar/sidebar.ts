import { Component, computed, effect, inject, OnDestroy, output, signal } from '@angular/core';
import { Timestamp, Unsubscribe } from 'firebase/firestore';
import { AppUser, Channel, DirectConversation, Message } from '../../models';
import { avatarUrl } from '../../shared/avatar-url';
import { AuthService } from '../../services/auth.service';
import { ChannelService } from '../../services/channel.service';
import { MessageService } from '../../services/message.service';
import { UserService } from '../../services/user.service';
import { NotificationSoundService } from '../../services/notification-sound.service';

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
  private readonly directConversations = signal<DirectConversation[]>([]);
  private readonly unreadChannelCounts = signal<Record<string, number>>({});
  private readonly channelReadAt = new Map<string, Timestamp>();
  private readonly channelMessageStops = new Map<string, Unsubscribe>();
  private readonly channelMessageIds = new Map<string, Set<string>>();
  private readonly lastDirectMessageIds = new Map<string, string>();
  private readonly notificationSound: NotificationSoundService;
  private readonly stopWatchingUsers: Unsubscribe;
  private readonly stopWatchingChannels: Unsubscribe;
  channelsOpen = true;
  directMessagesOpen = true;
  selectedConversation = '';
  channelCreateRequested = output<void>();
  newMessageRequested = output<void>();
  initialChannelSelected = output<void>();
  conversationOpened = output<void>();
  conversationSelected = output<{
    type: 'channel' | 'direct';
    id: string;
    user?: AppUser;
    channel?: Channel;
  }>();

  readonly channels = computed(() => this.memberChannels());
  readonly users = computed(() => this.sortedAccountUsers());
  readonly directConversationUserIds = computed(() => this.directConversationPartners());

  constructor(userService: UserService, channelService: ChannelService, private readonly messageService: MessageService,
    notificationSound: NotificationSoundService) {
    this.notificationSound = notificationSound;
    this.stopWatchingUsers = userService.watchUsers(users => this.firestoreUsers.set(users));
    this.stopWatchingChannels = channelService.watchChannels(channels => this.updateChannels(channels));
    effect(() => this.selectInitialConversation());
    effect(onCleanup => {
      const uid = this.authService.currentUser()?.uid;
      this.directConversations.set([]);
      this.lastDirectMessageIds.clear();
      if (!uid) return;
      const stop = messageService.watchDirectConversations(uid, conversations => {
        const incoming = conversations.some(conversation => {
          const previousId = this.lastDirectMessageIds.get(conversation.id);
          return !!previousId && previousId !== conversation.lastMessageId && conversation.lastSenderId !== uid;
        });
        conversations.forEach(conversation => this.lastDirectMessageIds.set(conversation.id, conversation.lastMessageId));
        if (incoming) this.notificationSound.play();
        this.directConversations.set(conversations);
      });
      onCleanup(stop);
    });
  }

  ngOnDestroy(): void {
    this.stopWatchingUsers();
    this.stopWatchingChannels();
    this.channelMessageStops.forEach(stop => stop());
    this.channelMessageStops.clear();
    this.channelMessageIds.clear();
    this.lastDirectMessageIds.clear();
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
    const lastMessageWithA = this.lastMessageTimeWith(a.uid, currentUid);
    const lastMessageWithB = this.lastMessageTimeWith(b.uid, currentUid);
    if (lastMessageWithA !== lastMessageWithB) return lastMessageWithB - lastMessageWithA;
    return a.name.localeCompare(b.name, 'de');
  }

  private updateChannels(channels: Channel[]): void {
    this.firestoreChannels.set(channels);
    const ids = new Set(channels.map(channel => channel.id));
    this.channelMessageStops.forEach((stop, id) => {
      if (!ids.has(id)) {
        stop();
        this.channelMessageStops.delete(id);
      }
    });
    channels.forEach(channel => this.watchChannelMessages(channel.id));
  }

  private watchChannelMessages(channelId: string): void {
    if (this.channelMessageStops.has(channelId)) return;
    const initialReadAt = this.loadChannelReadAt(channelId);
    this.channelReadAt.set(channelId, initialReadAt);
    const stop = this.messageService.watchMessages(channelId, (messages: Message[]) => {
      const previousIds = this.channelMessageIds.get(channelId);
      const incoming = previousIds && messages.some(message =>
        !previousIds.has(message.id) && message.senderId !== this.authService.currentUser()?.uid && !message.parentId);
      this.channelMessageIds.set(channelId, new Set(messages.map(message => message.id)));
      if (incoming) this.notificationSound.play();
      const readAt = this.channelReadAt.get(channelId) ?? initialReadAt;
      const uid = this.authService.currentUser()?.uid;
      const count = messages.filter(message => message.timestamp.toMillis() > readAt.toMillis()
        && message.senderId !== uid && !message.parentId).length;
      this.unreadChannelCounts.update(counts => ({ ...counts, [channelId]: count }));
    });
    this.channelMessageStops.set(channelId, stop);
  }

  private selectInitialConversation(): void {
    if (this.selectedConversation) return;
    const channel = this.channels()[0];
    if (channel) return this.selectInitialChannel(channel);
    const currentUid = this.authService.currentUser()?.uid;
    const user = this.users().find(item => item.uid === currentUid);
    if (user) this.selectInitialUser(user);
  }

  private selectInitialChannel(channel: Channel): void {
    this.selectConversation('channel', channel.id);
    this.initialChannelSelected.emit();
  }

  private selectInitialUser(user: AppUser): void {
    this.selectConversation('direct', user.uid);
    this.initialChannelSelected.emit();
  }

  private memberChannels(): Channel[] {
    const uid = this.authService.currentUser()?.uid;
    return uid ? this.firestoreChannels().filter(channel => channel.members.includes(uid)) : [];
  }

  private lastMessageTimeWith(otherUid: string, currentUid?: string): number {
    return this.conversationWith(otherUid, currentUid)?.lastMessageAt.toMillis() ?? 0;
  }

  hasUnreadMessages(user: AppUser): boolean {
    const currentUid = this.authService.currentUser()?.uid;
    const conversation = this.conversationWith(user.uid, currentUid);
    const lastReadAt = currentUid ? conversation?.lastReadAt?.[currentUid] : undefined;
    const activityAt = conversation?.lastActivityAt ?? conversation?.lastMessageAt;
    const activityBy = conversation?.lastActivityBy ?? conversation?.lastSenderId;
    return !!conversation && activityBy !== currentUid
      && (!lastReadAt || !!activityAt && activityAt.toMillis() > lastReadAt.toMillis());
  }

  private conversationWith(otherUid: string, currentUid?: string): DirectConversation | undefined {
    if (!currentUid || otherUid === currentUid) return undefined;
    const conversationId = [currentUid, otherUid].sort().join('_');
    return this.directConversations().find(conversation => conversation.id === conversationId);
  }

  private directConversationPartners(): string[] {
    const currentUid = this.authService.currentUser()?.uid;
    if (!currentUid) return [];
    return this.directConversations()
      .map(conversation => conversation.members.find(uid => uid !== currentUid))
      .filter((uid): uid is string => !!uid);
  }

  toggleChannels(): void {
    this.channelsOpen = !this.channelsOpen;
  }

  toggleDirectMessages(): void {
    this.directMessagesOpen = !this.directMessagesOpen;
  }

  selectConversation(type: 'channel' | 'direct', id: string): void {
    this.selectedConversation = `${type}:${id}`;
    if (type === 'channel') {
      const readAt = Timestamp.now();
      this.channelReadAt.set(id, readAt);
      this.saveChannelReadAt(id, readAt);
      this.unreadChannelCounts.update(counts => ({ ...counts, [id]: 0 }));
    }
    const user = type === 'direct' ? this.users().find(item => item.uid === id) : undefined;
    const channel = type === 'channel' ? this.channels().find(item => item.id === id) : undefined;
    this.conversationSelected.emit({ type, id, user, channel });
  }

  unreadChannelCount(channel: Channel): number {
    return this.unreadChannelCounts()[channel.id] ?? 0;
  }

  private channelReadStorageKey(channelId: string): string {
    const uid = this.authService.currentUser()?.uid ?? 'guest';
    return `dabubble:channel-read:${uid}:${channelId}`;
  }

  private loadChannelReadAt(channelId: string): Timestamp {
    const value = localStorage.getItem(this.channelReadStorageKey(channelId));
    const milliseconds = value ? Number(value) : 0;
    return Number.isFinite(milliseconds) && milliseconds >= 0
      ? Timestamp.fromMillis(milliseconds)
      : Timestamp.fromMillis(0);
  }

  private saveChannelReadAt(channelId: string, timestamp: Timestamp): void {
    localStorage.setItem(this.channelReadStorageKey(channelId), String(timestamp.toMillis()));
  }

  openConversation(type: 'channel' | 'direct', id: string): void {
    this.selectConversation(type, id);
    this.conversationOpened.emit();
  }
}
