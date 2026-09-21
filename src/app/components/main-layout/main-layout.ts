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
import { isMobileViewport } from '../../shared/is-mobile-viewport';
import { AddPeopleDialog } from '../add-people-dialog/add-people-dialog';
import { MembersDialog } from '../members-dialog/members-dialog';
import { CreateChannelDialog, NewChannel } from '../create-channel-dialog/create-channel-dialog';
import { NewMessage } from '../new-message/new-message';
import { ProfileDialog, ProfileEdit } from '../profile-dialog/profile-dialog';
import { ChannelInfoDialog } from '../channel-info-dialog/channel-info-dialog';
import { AppUser, Channel, ChannelEdit, ConversationSelection, Message } from '../../shared/models';
import { MessageSearchService, SearchResult, SearchSources } from '../../services/message-search.service';
import { AccountService } from '../../services/account.service';
import { WorkspaceDialogs } from '../../shared/workspace-dialogs';
import { SearchBox } from '../../shared/search-box';
import { toggleHeightFor } from '../../shared/toggle-height';

@Component({
  selector: 'app-main-layout',
  imports: [Sidebar, Chat, Thread, CreateChannelDialog, AddPeopleDialog, MembersDialog, NewMessage, ProfileDialog, ChannelInfoDialog],
  templateUrl: './main-layout.html',
  styleUrls: ['./main-layout.scss', './main-layout-profile-menu.scss', './main-layout-mobile.scss',
    './main-layout-overlays.scss'],
})
/** Coordinates workspace navigation, dialogs, search, and conversation state. */
export class MainLayout {
  private readonly authService = inject(AuthService);
  private readonly channelService = inject(ChannelService);
  private readonly messageService = inject(MessageService);
  private readonly accountService = inject(AccountService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  readonly search = inject(MessageSearchService);

  readonly currentUser = this.authService.currentUser;
  readonly searchBox = new SearchBox();
  readonly searchResults = computed(() => this.collectSearchResults());

  readonly dialogs = new WorkspaceDialogs();
  profileSaveError = '';
  accountDeleteError = '';
  accountDeleteBusy = false;
  channelInfoSaveError = '';
  channelInfoSaving = false;
  channelInfoSaveVersion = 0;
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

  /** Initializes the layout state and responsive sidebar behavior. */
  constructor() {
    this.destroyRef.onDestroy(() => this.search.cancelPending());
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
    this.closeLabelHeight.set(toggleHeightFor(this.closeLabel().nativeElement));
    this.openLabelHeight.set(toggleHeightFor(this.openLabel().nativeElement));
  }

  readonly userName = this.authService.userName;
  readonly userEmail = this.authService.userEmail;
  readonly userAvatarUrl = this.authService.userAvatarUrl;
  readonly isOnline = this.authService.isOnline;

  /** Signs the current user out and returns to the login screen. */
  logout(): void {
    this.dialogs.closeProfileMenu();
    this.authService.logout().finally(() => {
      this.notifications.success('Du wurdest erfolgreich abgemeldet.');
      this.router.navigateByUrl('/login');
    });
  }

  /** Updates the global search query and schedules message search. */
  onSearchInput(value: string): void {
    this.searchBox.type(value);
    this.search.schedule(value, this.searchSources());
  }

  /** Handles keyboard navigation for search results. */
  onSearchKeydown(event: KeyboardEvent): void {
    const results = this.searchResults();
    if (!results.length || !this.searchBox.handleKeydown(event, results.length)) return;
    if (event.key === 'Enter') this.selectSearchResult(results[this.searchBox.index()]);
  }

  /** Shows the selected conversation on mobile layouts. */
  showChatOnMobile(): void {
    if (isMobileViewport()) this.sidebarOpen = false;
  }

  /** Opens the conversation represented by a search result and clears the box. */
  selectSearchResult(result: SearchResult): void {
    if (result.kind === 'channel') this.openMentionedChannel(result.channel);
    else if (result.kind === 'channel-message') this.openChannelMessageResult(result);
    else this.openSearchedUser(result.user);
    this.showChatOnMobile();
    this.search.reset();
    this.searchBox.clear();
  }

  /** Merges name matches and message matches into one result list. */
  private collectSearchResults(): SearchResult[] {
    const names = this.search.nameResults(this.searchBox.query(), this.allChannels(), this.allUsers());
    return [...names, ...this.search.messageResults()].slice(0, 30);
  }

  /** Returns the workspace data the message search reads. */
  private searchSources(): SearchSources {
    return {
      ownUid: this.currentUserId,
      channels: this.allChannels(),
      authors: this.allMessageAuthors(),
      directUserIds: this.directConversationUserIds(),
    };
  }

  /** Opens the profile editing dialog. */
  openProfileEdit(): void {
    this.profileSaveError = '';
    this.dialogs.openProfileEdit();
  }

  /** Persists profile changes. */
  saveProfile(edit: ProfileEdit): void {
    this.profileSaveError = '';
    this.authService
      .saveUserProfile(edit.name, this.userEmail(), edit.avatar)
      .then(() => this.dialogs.closeProfileEdit())
      .catch(() => (this.profileSaveError = 'Profil konnte nicht gespeichert werden.'));
  }

  /** Removes the account and related user data. */
  async deleteAccount(): Promise<void> {
    const uid = this.authService.currentUserId;
    if (!uid) return;
    this.accountDeleteBusy = true;
    this.accountDeleteError = (await this.accountService.deleteAccount(uid)) ?? '';
    this.accountDeleteBusy = false;
    if (this.accountDeleteError) return;
    this.notifications.success('Dein Konto wurde erfolgreich gelöscht.');
    await this.router.navigateByUrl('/login');
  }

  /** Opens the channel creation dialog. */
  openCreateChannelDialog(): void {
    this.dialogs.openCreateChannel();
  }

  /** Validates and starts creating a channel. */
  createChannel(channel: NewChannel): void {
    const uid = this.authService.currentUserId;
    if (!uid) return this.dialogs.closeCreateChannel();
    if (this.channelService.existsByName(channel.name, this.allChannels())) return;
    this.dialogs.closeCreateChannel();
    void this.persistChannel(channel.name, channel.description, uid);
  }

  /** Creates the channel and opens member selection for it. */
  private async persistChannel(name: string, description: string, uid: string): Promise<void> {
    try {
      const created = await this.channelService.createChannel(name, description, uid);
      this.dialogs.openAddPeopleForNewChannel(created);
      this.sidebar()?.selectConversation('channel', created.id);
      this.selectedChannel.set(created);
    } catch (error) {
      console.error('Channel konnte nicht erstellt werden:', error);
    }
  }

  /** Opens the current channel members dialog. */
  openMembersDialog(anchor: DOMRect): void {
    if (this.selectedChannel()) this.dialogs.openMembers(anchor);
  }

  /** Switches from the members list to member selection. */
  openMemberDialogFromList(): void {
    this.dialogs.closeMembers();
    this.openMemberDialog(this.dialogs.membersAnchor());
  }

  get currentUserId(): string | null {
    return this.authService.currentUserId;
  }

  /** Opens member selection for the selected channel. */
  openMemberDialog(anchor: DOMRect | null = null): void {
    const channel = this.selectedChannel();
    if (channel) this.dialogs.openAddPeopleForChannel(channel, anchor);
  }

  /** Opens the channel information dialog. */
  openChannelInfo(anchor: DOMRect): void {
    this.channelInfoSaveError = '';
    this.channelInfoSaving = false;
    this.dialogs.openChannelInfo(anchor);
  }

  /** Persists channel name and description changes. */
  async saveChannelInfo(change: ChannelEdit): Promise<void> {
    const channel = this.selectedChannel();
    if (!channel) return;
    this.channelInfoSaveError = '';
    this.channelInfoSaving = true;
    await this.writeChannelInfo(channel, change);
    this.channelInfoSaving = false;
  }

  /** Writes the channel edit and records its outcome. */
  private async writeChannelInfo(channel: Channel, change: ChannelEdit): Promise<void> {
    try {
      await this.channelService.updateChannel(channel.id, change.name, change.description);
    } catch (error) {
      console.error('Channel-Informationen konnten nicht gespeichert werden:', error);
      this.channelInfoSaveError = 'Die Änderungen konnten nicht gespeichert werden. Bitte versuche es erneut.';
      return;
    }
    this.selectedChannel.set({ ...channel, ...change });
    this.channelInfoSaveVersion++;
  }

  /** Leaves the currently selected channel. */
  leaveSelectedChannel(): void {
    const channel = this.selectedChannel();
    const uid = this.authService.currentUserId;
    if (!channel || !uid) return;
    if (this.channelService.isPermanent(channel)) return;
    this.channelService.leaveChannel(channel.id, uid).then(() => this.openAfterLeaving(channel.id));
  }

  /** Selects the next available conversation after leaving a channel. */
  private openAfterLeaving(leftChannelId: string): void {
    this.dialogs.closeChannelInfo();
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

  /** Adds selected users to the current channel. */
  async addMembers(uids: string[]): Promise<void> {
    const channel = this.dialogs.memberChannel();
    if (!channel || !uids.length) return this.dialogs.closeAddPeople();
    try {
      await this.channelService.addMembers(channel.id, uids);
      this.updateMemberState(channel, Array.from(new Set([...channel.members, ...uids])));
    } catch (error) {
      console.error('Mitglieder konnten nicht hinzugefügt werden:', error);
    } finally {
      this.dialogs.closeAddPeople();
    }
  }

  /** Updates member state in the dialog and selected channel. */
  private updateMemberState(channel: Channel, members: string[]): void {
    this.dialogs.memberChannel.set({ ...channel, members });
    if (this.selectedChannel()?.id !== channel.id) return;
    this.selectedChannel.update(selected => selected ? { ...selected, members } : selected);
  }

  readonly allUsers = computed(() => this.sidebar()?.users() ?? []);
  readonly allMessageAuthors = computed(() => this.sidebar()?.messageAuthors() ?? []);
  readonly allChannels = computed(() => this.sidebar()?.channels() ?? []);
  readonly directConversationUserIds = computed(() => this.sidebar()?.directConversationUserIds() ?? []);
  readonly channelNames = computed(() => this.allChannels().map(channel => channel.name));

  /** Users that belong to the selected channel. */
  readonly channelMembers = computed(() => {
    const members = this.selectedChannel()?.members ?? [];
    return this.allUsers().filter(user => members.includes(user.uid));
  });

  /** Users that can still be invited into the channel of the member dialog. */
  readonly invitableUsers = computed(() => {
    const members = this.dialogs.memberChannel()?.members ?? [];
    return this.allUsers().filter(user => !members.includes(user.uid));
  });

  /** Whether the current user may administer the selected channel. */
  readonly canManageSelectedChannel = computed(() => {
    const selected = this.selectedChannel();
    const channel = this.allChannels().find(item => item.id === selected?.id) ?? selected;
    return !!this.currentUserId && !!channel?.members.includes(this.currentUserId);
  });

  /** Opens a channel message search result and its thread. */
  private openChannelMessageResult(result: Extract<SearchResult, { kind: 'channel-message' }>): void {
    this.openMentionedChannel(result.channel);
    if (result.parent) this.openThread(result.parent);
  }

  /** Opens a direct conversation with a searched user. */
  private openSearchedUser(user: AppUser): void {
    const sidebar = this.sidebar();
    if (sidebar) return sidebar.selectConversation('direct', user.uid);
    this.startDirectConversation(user);
  }

  @HostListener('document:keydown.escape')
  /** Closes open dialogs when Escape is pressed. */
  closeDialogsWithEscape(): void {
    this.dialogs.closeOnEscape();
  }

  /** Toggles the workspace sidebar. */
  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  /** Selects a channel or direct conversation. */
  selectConversation(conversation: ConversationSelection): void {
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

  /** Starts a direct conversation with a user and closes the channel info. */
  startDirectConversation(user: AppUser): void {
    this.dialogs.closeChannelInfo();
    this.sidebar()?.selectConversation('direct', user.uid);
    this.selectConversation({ type: 'direct', id: user.uid, user });
    this.threadOpen = false;
  }

  /** Opens a channel referenced by a search result. */
  openMentionedChannel(channel: Channel): void {
    const sidebar = this.sidebar();
    if (sidebar) return sidebar.selectConversation('channel', channel.id);
    this.selectConversation({ type: 'channel', id: channel.id, channel });
  }
}
