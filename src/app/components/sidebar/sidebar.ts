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
/** Manages workspace navigation, conversations, and unread notifications. */
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
  private welcomeCreationStarted = false;
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

  readonly channels = computed(() => this.visibleChannels());
  readonly users = computed(() => this.sortedAccountUsers());
  readonly messageAuthors = computed(() => this.firestoreUsers());
  readonly directConversationUserIds = computed(() => this.directConversationPartners());

  constructor(userService: UserService, private readonly channelService: ChannelService, private readonly messageService: MessageService,
    notificationSound: NotificationSoundService) {
    this.notificationSound = notificationSound;
    this.stopWatchingUsers = userService.watchUsers(users => this.firestoreUsers.set(users));
    this.stopWatchingChannels = channelService.watchChannels(channels => this.updateChannels(channels));
    effect(() => {
      const user = this.authService.currentUser();
      const channels = this.firestoreChannels();
      if (user) {
        void this.ensureWelcomeChannel(user.uid, channels);
        void this.ensureDefaultChannelMembership(user.uid, channels);
      }
    });
    effect(() => this.selectInitialConversation());
    effect(onCleanup => this.watchDirectConversations(onCleanup));
  }

  /** Watches direct conversations and notifies about incoming messages. */
  private watchDirectConversations(onCleanup: (cleanup: () => void) => void): void {
    const uid = this.authService.currentUser()?.uid;
    this.directConversations.set([]);
    this.lastDirectMessageIds.clear();
    if (!uid) return;
    const stop = this.messageService.watchDirectConversations(uid,
      conversations => this.handleDirectConversations(uid, conversations));
    onCleanup(stop);
  }

  /** Updates direct-conversation state and plays the incoming-message sound. */
  private handleDirectConversations(uid: string, conversations: DirectConversation[]): void {
    const incoming = conversations.some(conversation => {
      const previousId = this.lastDirectMessageIds.get(conversation.id);
      return !!previousId && previousId !== conversation.lastMessageId && conversation.lastSenderId !== uid;
    });
    conversations.forEach(conversation => this.lastDirectMessageIds.set(conversation.id, conversation.lastMessageId));
    if (incoming) this.notificationSound.play();
    this.directConversations.set(conversations);
  }

  /** Releases subscriptions and cached watcher state. */
  ngOnDestroy(): void {
    this.stopWatchingUsers();
    this.stopWatchingChannels();
    this.channelMessageStops.forEach(stop => stop());
    this.channelMessageStops.clear();
    this.channelMessageIds.clear();
    this.lastDirectMessageIds.clear();
  }

  /** Returns the avatar URL for a user. */
  avatar(user: AppUser): string {
    return avatarUrl(user.avatar);
  }

  /** Checks whether a user is the currently authenticated user. */
  isSelf(user: AppUser): boolean {
    return user.uid === this.authService.currentUser()?.uid;
  }

  /** Returns visible users sorted by conversation activity and name. */
  private sortedAccountUsers(): AppUser[] {
    const currentUid = this.authService.currentUser()?.uid;
    return this.firestoreUsers()
      .filter(user => user.email.trim().length > 0)
      .sort((a, b) => this.compareUsers(a, b, currentUid));
  }

  /** Compares users by current-user priority, activity, and name. */
  private compareUsers(a: AppUser, b: AppUser, currentUid?: string): number {
    if (a.uid === currentUid) return -1;
    if (b.uid === currentUid) return 1;
    const lastMessageWithA = this.lastMessageTimeWith(a.uid, currentUid);
    const lastMessageWithB = this.lastMessageTimeWith(b.uid, currentUid);
    if (lastMessageWithA !== lastMessageWithB) return lastMessageWithB - lastMessageWithA;
    return a.name.localeCompare(b.name, 'de');
  }

  /** Updates the channel list and synchronizes message watchers. */
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

  /** Starts watching messages and unread counts for one channel. */
  private watchChannelMessages(channelId: string): void {
    if (this.channelMessageStops.has(channelId)) return;
    const initialReadAt = this.loadChannelReadAt(channelId);
    this.channelReadAt.set(channelId, initialReadAt);
    const stop = this.messageService.watchMessages(channelId,
      messages => this.handleChannelMessages(channelId, initialReadAt, messages));
    this.channelMessageStops.set(channelId, stop);
  }

  /** Updates message IDs, notification sound, and unread count for a channel. */
  private handleChannelMessages(channelId: string, initialReadAt: Timestamp, messages: Message[]): void {
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
  }

  /** Selects the first available conversation when none is selected. */
  private selectInitialConversation(): void {
    if (this.selectedConversation) return;
    const channel = this.channels()[0];
    if (channel) return this.selectInitialChannel(channel);
    const currentUid = this.authService.currentUser()?.uid;
    const user = this.users().find(item => item.uid === currentUid);
    if (user) this.selectInitialUser(user);
  }

  /** Selects the initial channel and emits the initial-selection event. */
  private selectInitialChannel(channel: Channel): void {
    this.selectConversation('channel', channel.id);
    this.initialChannelSelected.emit();
  }

  /** Selects the current user's direct conversation initially. */
  private selectInitialUser(user: AppUser): void {
    this.selectConversation('direct', user.uid);
    this.initialChannelSelected.emit();
  }

  /** Returns channels visible to the current user. */
  private visibleChannels(): Channel[] {
    const user = this.authService.currentUser();
    if (!user) return [];
    const channels = user.guestUntil
      ? this.firestoreChannels()
      : this.firestoreChannels().filter(channel => this.isPublicChannel(channel) || channel.members.includes(user.uid));
    return this.sortWelcomeChannelFirst(channels);
  }

  /** Places the protected welcome channel before all other channels. */
  private sortWelcomeChannelFirst(channels: Channel[]): Channel[] {
    return [...channels].sort((a, b) => Number(!this.isWelcomeChannel(a)) - Number(!this.isWelcomeChannel(b)));
  }

  /** Checks whether a channel is the protected welcome channel. */
  private isWelcomeChannel(channel: Channel): boolean {
    return channel.name.trim().toLocaleLowerCase('de') === 'willkommenschannel';
  }

  /** Identifies channels that every signed-in user may join. */
  private isPublicChannel(channel: Channel): boolean {
    const name = channel.name.trim().toLocaleLowerCase('de');
    return name === 'allgemein' || name === 'news' || name === 'willkommenschannel';
  }

  /** Adds a signed-in user to the default shared channels. */
  private async ensureDefaultChannelMembership(uid: string, channels: Channel[]): Promise<void> {
    const defaults = channels.filter(channel => ['allgemein', 'news', 'willkommenschannel']
      .includes(channel.name.trim().toLocaleLowerCase('de')));
    await Promise.all(defaults.filter(channel => !channel.members.includes(uid))
      .map(channel => this.channelService.addMembers(channel.id, [uid])));
  }

  /** Ensures the protected welcome channel exists for existing workspaces. */
  private async ensureWelcomeChannel(uid: string, channels: Channel[]): Promise<void> {
    if (this.welcomeCreationStarted || !channels.length) return;
    this.welcomeCreationStarted = true;
    await this.channelService.ensureWelcomeChannel(uid, channels);
  }

  /** Returns the latest direct-message timestamp with a user. */
  private lastMessageTimeWith(otherUid: string, currentUid?: string): number {
    return this.conversationWith(otherUid, currentUid)?.lastMessageAt.toMillis() ?? 0;
  }

  /** Checks whether a direct conversation contains unread activity. */
  hasUnreadMessages(user: AppUser): boolean {
    const currentUid = this.authService.currentUser()?.uid;
    const conversation = this.conversationWith(user.uid, currentUid);
    const lastReadAt = currentUid ? conversation?.lastReadAt?.[currentUid] : undefined;
    const activityAt = conversation?.lastActivityAt ?? conversation?.lastMessageAt;
    const activityBy = conversation?.lastActivityBy ?? conversation?.lastSenderId;
    return !!conversation && activityBy !== currentUid
      && (!lastReadAt || !!activityAt && activityAt.toMillis() > lastReadAt.toMillis());
  }

  /** Finds the direct conversation shared with another user. */
  private conversationWith(otherUid: string, currentUid?: string): DirectConversation | undefined {
    if (!currentUid || otherUid === currentUid) return undefined;
    const conversationId = [currentUid, otherUid].sort().join('_');
    return this.directConversations().find(conversation => conversation.id === conversationId);
  }

  /** Returns the user IDs participating in direct conversations. */
  private directConversationPartners(): string[] {
    const currentUid = this.authService.currentUser()?.uid;
    if (!currentUid) return [];
    return this.directConversations()
      .map(conversation => conversation.members.find(uid => uid !== currentUid))
      .filter((uid): uid is string => !!uid);
  }

  /** Toggles the channel section. */
  toggleChannels(): void {
    this.channelsOpen = !this.channelsOpen;
  }

  /** Toggles the direct-message section. */
  toggleDirectMessages(): void {
    this.directMessagesOpen = !this.directMessagesOpen;
  }

  /** Selects a channel or direct conversation and emits the selection. */
  selectConversation(type: 'channel' | 'direct', id: string): void {
    this.selectedConversation = `${type}:${id}`;
    if (type === 'channel') void this.joinPublicChannel(id);
    if (type === 'channel') this.markChannelRead(id);
    const user = type === 'direct' ? this.users().find(item => item.uid === id) : undefined;
    const channel = type === 'channel' ? this.channels().find(item => item.id === id) : undefined;
    this.conversationSelected.emit({ type, id, user, channel });
  }

  /** Marks a channel as read and clears its unread count. */
  private markChannelRead(channelId: string): void {
    const readAt = Timestamp.now();
    this.channelReadAt.set(channelId, readAt);
    this.saveChannelReadAt(channelId, readAt);
    this.unreadChannelCounts.update(counts => ({ ...counts, [channelId]: 0 }));
  }

  /** Returns the unread message count for a channel. */
  unreadChannelCount(channel: Channel): number {
    return this.unreadChannelCounts()[channel.id] ?? 0;
  }

  /** Builds the local-storage key for a channel read timestamp. */
  private channelReadStorageKey(channelId: string): string {
    const uid = this.authService.currentUser()?.uid ?? 'guest';
    return `dabubble:channel-read:${uid}:${channelId}`;
  }

  /** Loads a channel's last-read timestamp from local storage. */
  private loadChannelReadAt(channelId: string): Timestamp {
    const value = localStorage.getItem(this.channelReadStorageKey(channelId));
    const milliseconds = value ? Number(value) : 0;
    return Number.isFinite(milliseconds) && milliseconds >= 0
      ? Timestamp.fromMillis(milliseconds)
      : Timestamp.fromMillis(0);
  }

  /** Persists a channel's last-read timestamp in local storage. */
  private saveChannelReadAt(channelId: string, timestamp: Timestamp): void {
    localStorage.setItem(this.channelReadStorageKey(channelId), String(timestamp.toMillis()));
  }

  /** Selects a conversation and notifies the mobile layout. */
  openConversation(type: 'channel' | 'direct', id: string): void {
    this.selectConversation(type, id);
    this.conversationOpened.emit();
  }

  /** Adds the current user to a public channel when it is opened. */
  private async joinPublicChannel(channelId: string): Promise<void> {
    const user = this.authService.currentUser();
    const channel = this.channels().find(item => item.id === channelId);
    if (!user || !channel || !this.isPublicChannel(channel) || channel.members.includes(user.uid)) return;
    await this.channelService.addMembers(channelId, [user.uid]);
  }
}
