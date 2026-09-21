import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { NotificationService } from '../../services/notification.service';
import { Sidebar } from '../sidebar/sidebar';
import { Chat } from '../chat/chat';
import { Thread } from '../thread/thread';
import { AuthService } from '../../services/auth.service';
import { ChannelService } from '../../services/channel.service';
import { MessageService } from '../../services/message.service';
import { UserService } from '../../services/user.service';
import { avatarUrl } from '../../shared/avatar-url';
import { isMobileViewport } from '../../shared/is-mobile-viewport';
import { AddPeopleDialog } from '../add-people-dialog/add-people-dialog';
import { MembersDialog } from '../members-dialog/members-dialog';
import { CreateChannelDialog, NewChannel } from '../create-channel-dialog/create-channel-dialog';
import { NewMessage } from '../new-message/new-message';
import { ProfileDialog, ProfileEdit } from '../profile-dialog/profile-dialog';
import { ChannelInfoDialog } from '../channel-info-dialog/channel-info-dialog';
import { AppUser, Channel, Message } from '../../models';

type SearchResult =
  | { kind: 'channel'; id: string; label: string; channel: Channel }
  | { kind: 'user'; id: string; label: string; user: AppUser }
  | { kind: 'channel-message'; id: string; label: string; context: string; channel: Channel; message: Message; parent?: Message }
  | { kind: 'direct-message'; id: string; label: string; context: string; user: AppUser; message: Message };

@Component({
  selector: 'app-main-layout',
  imports: [Sidebar, Chat, Thread, CreateChannelDialog, AddPeopleDialog, MembersDialog, NewMessage, ProfileDialog, ChannelInfoDialog],
  templateUrl: './main-layout.html',
  styleUrls: ['./main-layout.scss', './main-layout-mobile.scss', './main-layout-overlays.scss'],
})
/** Coordinates workspace navigation, dialogs, search, and conversation state. */
export class MainLayout {
  private readonly authService = inject(AuthService);
  private readonly channelService = inject(ChannelService);
  private readonly messageService = inject(MessageService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);

  readonly currentUser = this.authService.currentUser;
  readonly searchQuery = signal('');
  readonly searchOpen = signal(false);
  readonly searchIndex = signal(0);
  readonly messageSearchResults = signal<SearchResult[]>([]);
  readonly searchLoading = signal(false);
  readonly searchResults = computed(() => [...this.matchSearchResults(), ...this.messageSearchResults()].slice(0, 30));

  profileMenuOpen = false;
  profilePopupOpen = false;
  profileEditOpen = false;
  profileSaveError = '';
  accountDeleteError = '';
  accountDeleteBusy = false;
  createChannelDialogOpen = false;
  addPeopleDialogOpen = false;
  membersDialogOpen = false;
  channelInfoOpen = false;
  channelInfoSaveError = '';
  channelInfoSaving = false;
  channelInfoSaveVersion = 0;
  channelInfoAnchor = signal<DOMRect | null>(null);
  membersAnchor = signal<DOMRect | null>(null);
  addPeopleAnchor = signal<DOMRect | null>(null);
  memberDialogLabel = 'Erstellen';
  memberDialogForExistingChannel = false;
  memberDialogChannel = signal<Channel | null>(null);
  sidebarOpen = true;
  selfChatOpen = false;
  newMessageOpen = false;
  threadOpen = true;
  /** The message whose thread is shown; without it no thread is open. */
  threadParent: Message | null = null;
  selectedDirectUser: AppUser | null = null;
  selectedChannel = signal<Channel | null>(null);
  closeLabelHeight = signal(310);
  openLabelHeight = signal(280);
  private closeLabel = viewChild.required<ElementRef<HTMLElement>>('closeLabel');
  private openLabel = viewChild.required<ElementRef<HTMLElement>>('openLabel');
  private destroyRef = inject(DestroyRef);
  private sidebar = viewChild(Sidebar);
  private searchTimer?: ReturnType<typeof setTimeout>;
  private searchRequest = 0;

  /** Initializes the layout state and responsive sidebar behavior. */
  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.searchTimer) clearTimeout(this.searchTimer);
    });
    afterNextRender(() => {
      const observer = new ResizeObserver(() => this.updateToggleHeight());
      observer.observe(this.closeLabel().nativeElement);
      observer.observe(this.openLabel().nativeElement);
      this.updateToggleHeight();
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  /** Updates the sidebar toggle height to fit its measured label. */
  private updateToggleHeight(): void {
    const chrome = this.toggleChromeHeight(this.closeLabel().nativeElement);
    this.closeLabelHeight.set(this.closeLabel().nativeElement.offsetHeight + chrome);
    this.openLabelHeight.set(this.openLabel().nativeElement.offsetHeight + chrome);
  }

  /** Vertical padding, icon and gap of the toggle; they scale with the window, so they are read live. */
  /** Returns the height needed for the toggle label. */
  private toggleChromeHeight(label: HTMLElement): number {
    const button = label.closest('button');
    if (!button) return 0;
    const style = getComputedStyle(button);
    const icon = button.querySelector<HTMLElement>('.toggle-icon')?.offsetHeight ?? 0;
    return parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.rowGap) + icon;
  }

  get userName(): string {
    return this.currentUser()?.name ?? 'Gast';
  }

  get userAvatarUrl(): string {
    return avatarUrl(this.currentUser()?.avatar);
  }

  get isOnline(): boolean {
    return this.currentUser()?.status === 'online';
  }

  get userEmail(): string {
    return this.currentUser()?.email ?? '';
  }

  /** Signs the current user out and returns to the login screen. */
  logout(): void {
    this.closeProfileMenu();
    this.authService.logout().finally(() => {
      this.notifications.success('Du wurdest erfolgreich abgemeldet.');
      this.router.navigateByUrl('/login');
    });
  }

  /** Toggles the profile menu visibility. */
  toggleProfileMenu() {
    this.profileMenuOpen = !this.profileMenuOpen;
  }

  /** Closes the profile menu. */
  closeProfileMenu() {
    this.profileMenuOpen = false;
  }

  /** Opens the profile details dialog. */
  openProfilePopup(): void {
    this.closeProfileMenu();
    this.profilePopupOpen = true;
  }

  /** Updates the global search query and schedules message search. */
  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.searchIndex.set(0);
    this.searchOpen.set(true);
    this.scheduleMessageSearch(value);
  }

  /** Handles keyboard navigation for search results. */
  onSearchKeydown(event: KeyboardEvent): void {
    const results = this.searchResults();
    if (!results.length || !this.handleSearchNavigation(event, results.length)) return;
    if (event.key === 'Enter') this.selectSearchResult(results[this.searchIndex()]);
  }

  /** Shows the selected conversation on mobile layouts. */
  showChatOnMobile(): void {
    if (isMobileViewport()) this.sidebarOpen = false;
  }

  /** Opens the conversation represented by a search result. */
  selectSearchResult(result: SearchResult): void {
    if (result.kind === 'channel') this.openMentionedChannel(result.channel);
    else if (result.kind === 'user') this.openSearchedUser(result.user);
    else if (result.kind === 'channel-message') this.openChannelMessageResult(result);
    else this.openSearchedUser(result.user);
    this.showChatOnMobile();
    this.clearSearch();
  }

  /** Closes the global search results. */
  closeSearch(): void {
    this.searchOpen.set(false);
    this.searchIndex.set(0);
  }

  /** Clears the current search state. */
  private clearSearch(): void {
    this.searchQuery.set('');
    this.messageSearchResults.set([]);
    this.searchLoading.set(false);
    this.searchRequest++;
    this.closeSearch();
  }

  /** Closes the profile details dialog. */
  closeProfilePopup(): void {
    this.profilePopupOpen = false;
  }

  /** Opens the profile editing dialog. */
  openProfileEdit(): void {
    this.profileSaveError = '';
    this.profileEditOpen = true;
  }

  /** Closes the profile editing dialog. */
  closeProfileEdit(): void {
    this.profileEditOpen = false;
  }

  /** Persists profile changes. */
  saveProfile(edit: ProfileEdit): void {
    this.profileSaveError = '';
    this.authService
      .saveUserProfile(edit.name, this.userEmail, edit.avatar)
      .then(() => this.closeProfileEdit())
      .catch(() => (this.profileSaveError = 'Profil konnte nicht gespeichert werden.'));
  }

  /** Removes the account and related user data. */
  async deleteAccount(): Promise<void> {
    const uid = this.authService.currentUserId;
    if (!uid) return;
    this.accountDeleteError = '';
    this.accountDeleteBusy = true;
    try {
      await this.channelService.removeUserFromChannels(uid);
      await this.messageService.deleteDirectConversationsForUser(uid);
      await this.userService.deleteUserProfile(uid);
      await this.authService.deleteCurrentAccount();
      this.notifications.success('Dein Konto wurde erfolgreich gelöscht.');
      await this.router.navigateByUrl('/login');
    } catch (error) { this.accountDeleteError = this.accountDeletionError(error); }
    finally { this.accountDeleteBusy = false; }
  }

  /** Maps account deletion errors to a user-facing message. */
  private accountDeletionError(error: unknown): string {
    const code = (error as { code?: string }).code;
    return code === 'auth/requires-recent-login' ? 'Bitte melde dich erneut an und versuche es dann noch einmal.' : 'Das Konto konnte nicht gelöscht werden.';
  }

  /** Opens the channel creation dialog. */
  openCreateChannelDialog(): void {
    this.closeAddPeopleDialog();
    this.createChannelDialogOpen = true;
  }

  /** Closes the channel creation dialog. */
  closeCreateChannelDialog(): void {
    this.createChannelDialogOpen = false;
  }

  /** Validates and starts creating a channel. */
  createChannel(channel: NewChannel): void {
    const uid = this.authService.currentUserId;
    if (!uid) return this.closeCreateChannelDialog();
    const normalizedName = channel.name.trim().toLocaleLowerCase('de');
    const alreadyExists = this.allChannels().some(existing =>
      existing.name.trim().toLocaleLowerCase('de') === normalizedName,
    );
    if (alreadyExists) return;
    this.closeCreateChannelDialog();
    this.persistChannel(channel.name, channel.description, uid);
  }

  private async persistChannel(name: string, description: string, uid: string): Promise<void> {
    try {
      const created = await this.channelService.createChannel(name, description, uid);
      this.openAddPeopleDialog(created);
    } catch (error) {
      console.error('Channel konnte nicht erstellt werden:', error);
    }
  }

  /** Opens the member dialog for a newly created channel. */
  private openAddPeopleDialog(created: Channel): void {
    this.memberDialogLabel = 'Erstellen';
    this.memberDialogForExistingChannel = false;
    this.addPeopleAnchor.set(null);
    this.memberDialogChannel.set(created);
    this.addPeopleDialogOpen = true;
    this.sidebar()?.selectConversation('channel', created.id);
    this.selectedChannel.set(created);
  }

  /** Opens the current channel members dialog. */
  openMembersDialog(anchor: DOMRect): void {
    if (!this.selectedChannel()) return;
    this.membersAnchor.set(anchor);
    this.membersDialogOpen = true;
  }

  /** Closes the members dialog. */
  closeMembersDialog(): void {
    this.membersDialogOpen = false;
  }

  /** Switches from the members list to member selection. */
  openMemberDialogFromList(): void {
    this.closeMembersDialog();
    this.openMemberDialog(this.membersAnchor());
  }

  get currentUserId(): string | null {
    return this.authService.currentUserId;
  }

  /** Opens member selection for the selected channel. */
  openMemberDialog(anchor: DOMRect | null = null): void {
    const channel = this.selectedChannel();
    if (!channel) return;
    this.memberDialogLabel = 'Hinzufügen';
    this.memberDialogForExistingChannel = true;
    this.addPeopleAnchor.set(anchor);
    this.memberDialogChannel.set(channel);
    this.addPeopleDialogOpen = true;
  }

  /** Opens the channel information dialog. */
  openChannelInfo(anchor: DOMRect): void {
    this.channelInfoAnchor.set(anchor);
    this.channelInfoSaveError = '';
    this.channelInfoSaving = false;
    this.channelInfoOpen = true;
  }

  /** Closes the channel information dialog. */
  closeChannelInfo(): void {
    this.channelInfoOpen = false;
    this.channelInfoAnchor.set(null);
  }

  /** Persists channel name and description changes. */
  async saveChannelInfo(change: { name: string; description: string }): Promise<void> {
    const channel = this.selectedChannel();
    if (!channel) return;
    this.channelInfoSaveError = '';
    this.channelInfoSaving = true;
    try {
      await this.channelService.updateChannel(channel.id, change.name, change.description);
      this.selectedChannel.set({ ...channel, ...change });
      this.channelInfoSaveVersion++;
    } catch (error) {
      console.error('Channel-Informationen konnten nicht gespeichert werden:', error);
      this.channelInfoSaveError = 'Die Änderungen konnten nicht gespeichert werden. Bitte versuche es erneut.';
    } finally {
      this.channelInfoSaving = false;
    }
  }

  /** Leaves the currently selected channel. */
  leaveSelectedChannel(): void {
    const channel = this.selectedChannel();
    const uid = this.authService.currentUserId;
    if (!channel || !uid) return;
    if (channel.name.trim().toLocaleLowerCase('de') === 'willkommenschannel') return;
    this.channelService.leaveChannel(channel.id, uid).then(() => this.openAfterLeaving(channel.id));
  }

  /** Selects the next available conversation after leaving a channel. */
  private openAfterLeaving(leftChannelId: string): void {
    this.closeChannelInfo();
    const nextChannel = this.allChannels().find(channel => channel.id !== leftChannelId);
    if (nextChannel) return this.sidebar()?.selectConversation('channel', nextChannel.id);
    const uid = this.authService.currentUserId;
    if (uid) return this.sidebar()?.selectConversation('direct', uid);
    this.openNewMessage();
  }

  /** Returns the creator of the selected channel. */
  selectedChannelCreator(): AppUser | null {
    const creatorId = this.selectedChannel()?.createdBy;
    return this.allUsers().find(user => user.uid === creatorId) ?? null;
  }

  /** Closes the add-people dialog and clears its state. */
  closeAddPeopleDialog(): void {
    this.addPeopleDialogOpen = false;
    this.addPeopleAnchor.set(null);
    this.memberDialogChannel.set(null);
  }

  /** Adds selected users to the current channel. */
  async addMembers(uids: string[]): Promise<void> {
    const channel = this.memberDialogChannel();
    if (!this.canAddMembers(channel, uids)) return this.closeAddPeopleDialog();
    try {
      await this.channelService.addMembers(channel.id, uids);
      const members = Array.from(new Set([...channel.members, ...uids]));
      this.updateMemberState(channel, members);
    } catch (error) {
      this.logMemberUpdateError(error);
    } finally {
      this.closeAddPeopleDialog();
    }
  }

  /** Checks whether member additions can be processed. */
  private canAddMembers(channel: Channel | null, uids: string[]): channel is Channel {
    return !!channel && uids.length > 0;
  }

  /** Updates member state in the dialog and selected channel. */
  private updateMemberState(channel: Channel, members: string[]): void {
    this.memberDialogChannel.set({ ...channel, members });
    if (this.selectedChannel()?.id !== channel.id) return;
    this.selectedChannel.update(selected => selected ? { ...selected, members } : selected);
  }

  /** Logs a member update failure. */
  private logMemberUpdateError(error: unknown): void {
    console.error('Mitglieder konnten nicht hinzugefügt werden:', error);
  }

  readonly allUsers = computed(() => this.sidebar()?.users() ?? []);
  readonly allMessageAuthors = computed(() => this.sidebar()?.messageAuthors() ?? []);
  readonly allChannels = computed(() => this.sidebar()?.channels() ?? []);
  readonly directConversationUserIds = computed(() => this.sidebar()?.directConversationUserIds() ?? []);
  readonly channelMembers = computed(() => this.membersOfSelectedChannel());
  readonly canManageSelectedChannel = computed(() => this.isSelectedChannelMember());

  /** Returns user and channel results matching the query. */
  private matchSearchResults(): SearchResult[] {
    const raw = this.searchQuery().trim();
    const kind = raw.startsWith('#') ? 'channel' : raw.startsWith('@') ? 'user' : 'all';
    const query = raw.replace(/^[@#]/, '').toLocaleLowerCase('de');
    if (!query) return [];
    const channels = kind !== 'user' ? this.allChannels().filter(item => this.matchesSearch(item.name, query)) : [];
    const users = kind !== 'channel' ? this.allUsers().filter(item => this.matchesSearch(item.name, query)) : [];
    return [...channels.map(channel => ({ kind: 'channel' as const, id: `channel-${channel.id}`, label: channel.name, channel })),
      ...users.map(user => ({ kind: 'user' as const, id: `user-${user.uid}`, label: user.name, user }))];
  }

  /** Schedules a debounced message search. */
  private scheduleMessageSearch(value: string): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const raw = value.trim();
    const request = ++this.searchRequest;
    this.messageSearchResults.set([]);
    this.searchLoading.set(false);
    if (!raw || raw.startsWith('#') || raw.startsWith('@')) return;
    this.searchLoading.set(true);
    this.searchTimer = setTimeout(() => void this.searchMessages(raw, request), 250);
  }

  private async searchMessages(term: string, request: number): Promise<void> {
    const uid = this.authService.currentUserId;
    if (!uid) return this.finishMessageSearch(request, []);
    const query = term.toLocaleLowerCase('de');
    const usersById = new Map(this.allMessageAuthors().map(user => [user.uid, user]));
    const [channelLoads, directLoads] = await this.loadSearchMessages(uid, usersById);
    const results = [
      ...this.channelMessageResults(channelLoads, query, usersById, uid),
      ...this.directMessageResults(directLoads, query, uid),
    ].sort((a, b) => b.message.timestamp.toMillis() - a.message.timestamp.toMillis());
    this.finishMessageSearch(request, results);
  }

  private async loadSearchMessages(uid: string, usersById: Map<string, AppUser>) {
    const channels = this.allChannels();
    const directUsers = this.directConversationUsers(usersById);
    return Promise.all([
      Promise.allSettled(channels.map(async channel => ({ channel, messages: await this.messageService.loadChannelMessages(channel.id) }))),
      Promise.allSettled(directUsers.map(async user => ({ user, messages: await this.messageService.loadDirectMessages(uid, user.uid) }))),
    ]);
  }

  /** Resolves users participating in direct conversations. */
  private directConversationUsers(usersById: Map<string, AppUser>): AppUser[] {
    return this.directConversationUserIds()
      .map(userId => usersById.get(userId))
      .filter((user): user is AppUser => !!user);
  }

  /** Builds search results for channel messages. */
  private channelMessageResults(
    loads: PromiseSettledResult<{ channel: Channel; messages: Message[] }>[],
    query: string,
    usersById: Map<string, AppUser>,
    ownUid: string,
  ): Extract<SearchResult, { kind: 'channel-message' }>[] {
    return loads.flatMap(load => this.channelLoadResults(load, query, usersById, ownUid));
  }

  /** Builds results from one channel message load. */
  private channelLoadResults(
    load: PromiseSettledResult<{ channel: Channel; messages: Message[] }>,
    query: string,
    usersById: Map<string, AppUser>,
    ownUid: string,
  ): Extract<SearchResult, { kind: 'channel-message' }>[] {
    if (load.status === 'rejected') return [];
    const { channel, messages } = load.value;
    const byId = new Map(messages.map(message => [message.id, message]));
    return messages.filter(message => this.matchesSearch(message.text, query)).map(message => ({
      kind: 'channel-message' as const,
      id: `channel-message-${channel.id}-${message.id}`,
      label: `#${channel.name} · ${message.senderId === ownUid ? 'Du' : usersById.get(message.senderId)?.name ?? 'Gelöschtes Profil'}`,
      context: this.searchContext(message.text, query),
      channel,
      message,
      parent: message.parentId ? byId.get(message.parentId) : undefined,
    }));
  }

  /** Builds search results for direct messages. */
  private directMessageResults(
    loads: PromiseSettledResult<{ user: AppUser; messages: Message[] }>[],
    query: string,
    ownUid: string,
  ): Extract<SearchResult, { kind: 'direct-message' }>[] {
    return loads.flatMap(load => this.directLoadResults(load, query, ownUid));
  }

  /** Builds results from one direct-message load. */
  private directLoadResults(
    load: PromiseSettledResult<{ user: AppUser; messages: Message[] }>,
    query: string,
    ownUid: string,
  ): Extract<SearchResult, { kind: 'direct-message' }>[] {
    if (load.status === 'rejected') return [];
    const { user, messages } = load.value;
    return messages.filter(message => this.matchesSearch(message.text, query)).map(message => ({
      kind: 'direct-message' as const,
      id: `direct-message-${user.uid}-${message.id}`,
      label: `@${user.name} · ${message.senderId === ownUid ? 'Du' : user.name}`,
      context: this.searchContext(message.text, query),
      user,
      message,
    }));
  }

  /** Publishes message-search results for the active request. */
  private finishMessageSearch(request: number, results: SearchResult[]): void {
    if (request !== this.searchRequest) return;
    this.messageSearchResults.set(results);
    this.searchLoading.set(false);
  }

  /** Creates a shortened context snippet around a match. */
  private searchContext(text: string, query: string): string {
    const position = text.toLocaleLowerCase('de').indexOf(query);
    const start = Math.max(0, position - 38);
    const end = Math.min(text.length, position + query.length + 58);
    return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
  }

  /** Opens a channel message search result and its thread. */
  private openChannelMessageResult(result: Extract<SearchResult, { kind: 'channel-message' }>): void {
    this.openMentionedChannel(result.channel);
    if (result.parent) this.openThread(result.parent);
  }

  /** Checks whether a value contains the search query. */
  private matchesSearch(value: string, query: string): boolean {
    return value.toLocaleLowerCase('de').includes(query);
  }

  /** Handles keyboard navigation and selection of search results. */
  private handleSearchNavigation(event: KeyboardEvent, count: number): boolean {
    if (event.key === 'ArrowDown') this.searchIndex.update(index => (index + 1) % count);
    else if (event.key === 'ArrowUp') this.searchIndex.update(index => (index - 1 + count) % count);
    else if (event.key === 'Escape') return this.closeSearch(), false;
    else if (event.key !== 'Enter') return false;
    event.preventDefault();
    return true;
  }

  /** Opens a direct conversation with a searched user. */
  private openSearchedUser(user: AppUser): void {
    const sidebar = this.sidebar();
    if (sidebar) return sidebar.selectConversation('direct', user.uid);
    this.startDirectConversation(user);
  }

  /** Checks whether the current user belongs to the selected channel. */
  private isSelectedChannelMember(): boolean {
    const selected = this.selectedChannel();
    const channel = this.allChannels().find(item => item.id === selected?.id) ?? selected;
    return !!this.currentUserId && !!channel?.members.includes(this.currentUserId);
  }

  /** Returns users belonging to the selected channel. */
  private membersOfSelectedChannel(): AppUser[] {
    const members = this.selectedChannel()?.members ?? [];
    return this.allUsers().filter(user => members.includes(user.uid));
  }

  readonly invitableUsers = computed(() => this.usersWithoutMembers());

  /** Returns users who can be invited to the channel. */
  private usersWithoutMembers(): AppUser[] {
    const members = this.memberDialogChannel()?.members ?? [];
    return (this.sidebar()?.users() ?? []).filter(user => !members.includes(user.uid));
  }

  get channelNames(): string[] {
    return this.sidebar()?.channels().map(channel => channel.name) ?? [];
  }

  @HostListener('document:keydown.escape')
  /** Closes open dialogs when Escape is pressed. */
  closeDialogsWithEscape(): void {
    this.closeProfileMenu();
    this.closeProfilePopup();
    this.closeProfileEdit();
    this.closeCreateChannelDialog();
    this.closeAddPeopleDialog();
    this.closeMembersDialog();
  }

  /** Toggles the workspace sidebar. */
  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  /** Selects a channel or direct conversation. */
  selectConversation(conversation: {
    type: 'channel' | 'direct';
    id: string;
    user?: AppUser;
    channel?: Channel;
  }): void {
    this.newMessageOpen = false;
    this.threadOpen = false;
    this.selfChatOpen = conversation.type === 'direct' && conversation.id === this.currentUser()?.uid;
    this.selectedDirectUser = conversation.type === 'direct' && !this.selfChatOpen ? conversation.user ?? null : null;
    this.selectedChannel.set(conversation.channel ?? null);
  }

  /** Opens a message thread. */
  openThread(message: Message): void {
    this.threadParent = message;
    this.threadOpen = true;
  }

  /** Closes the open message thread. */
  closeThread(): void {
    this.threadOpen = false;
    this.threadParent = null;
  }

  /** Hides the initial thread panel. */
  hideInitialThread(): void {
    this.threadOpen = false;
  }

  /** Opens the new-message view. */
  openNewMessage(): void {
    this.selfChatOpen = false;
    this.selectedDirectUser = null;
    this.newMessageOpen = true;
  }

  /** Starts a direct conversation with a user. */
  startDirectConversation(user: AppUser): void {
    this.sidebar()?.selectConversation('direct', user.uid);
    this.selectConversation({ type: 'direct', id: user.uid, user });
    this.threadOpen = false;
  }

  /** Starts a direct conversation from channel information. */
  startDirectConversationFromChannelInfo(user: AppUser): void {
    this.closeChannelInfo();
    this.startDirectConversation(user);
  }

  /** Opens a channel referenced by a search result. */
  openMentionedChannel(channel: Channel): void {
    const sidebar = this.sidebar();
    if (sidebar) return sidebar.selectConversation('channel', channel.id);
    this.selectConversation({ type: 'channel', id: channel.id, channel });
  }
}
