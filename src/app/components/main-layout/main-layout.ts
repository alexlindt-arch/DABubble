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
import { Sidebar } from '../sidebar/sidebar';
import { Chat } from '../chat/chat';
import { Thread } from '../thread/thread';
import { AuthService } from '../../services/auth.service';
import { ChannelService } from '../../services/channel.service';
import { UserService } from '../../services/user.service';
import { avatarUrl } from '../../shared/avatar-url';
import { AddPeopleDialog } from '../add-people-dialog/add-people-dialog';
import { MembersDialog } from '../members-dialog/members-dialog';
import { CreateChannelDialog, NewChannel } from '../create-channel-dialog/create-channel-dialog';
import { NewMessage } from '../new-message/new-message';
import { ProfileDialog, ProfileEdit } from '../profile-dialog/profile-dialog';
import { ChannelInfoDialog } from '../channel-info-dialog/channel-info-dialog';
import { AppUser, Channel } from '../../models';

type SearchResult =
  | { kind: 'channel'; id: string; label: string; channel: Channel }
  | { kind: 'user'; id: string; label: string; user: AppUser };

@Component({
  selector: 'app-main-layout',
  imports: [Sidebar, Chat, Thread, CreateChannelDialog, AddPeopleDialog, MembersDialog, NewMessage, ProfileDialog, ChannelInfoDialog],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout {
  private readonly authService = inject(AuthService);
  private readonly channelService = inject(ChannelService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);

  readonly currentUser = this.authService.currentUser;
  readonly searchQuery = signal('');
  readonly searchOpen = signal(false);
  readonly searchIndex = signal(0);
  readonly searchResults = computed(() => this.matchSearchResults());

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
  channelInfoAnchor = signal<DOMRect | null>(null);
  membersAnchor = signal<DOMRect | null>(null);
  memberDialogLabel = 'Erstellen';
  memberDialogForExistingChannel = false;
  memberDialogChannel = signal<Channel | null>(null);
  sidebarOpen = true;
  selfChatOpen = false;
  newMessageOpen = false;
  threadOpen = true;
  selectedDirectUser: AppUser | null = null;
  selectedChannel = signal<Channel | null>(null);
  closeLabelHeight = signal(310);
  openLabelHeight = signal(280);
  private closeLabel = viewChild.required<ElementRef<HTMLElement>>('closeLabel');
  private openLabel = viewChild.required<ElementRef<HTMLElement>>('openLabel');
  private destroyRef = inject(DestroyRef);
  private sidebar = viewChild(Sidebar);

  constructor() {
    afterNextRender(() => {
      const observer = new ResizeObserver(() => this.updateToggleHeight());
      observer.observe(this.closeLabel().nativeElement);
      observer.observe(this.openLabel().nativeElement);
      this.updateToggleHeight();
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  private updateToggleHeight(): void {
    // Text plus vertical padding (40), icon (24), gap (8), and rounding room.
    this.closeLabelHeight.set(this.closeLabel().nativeElement.offsetHeight + 76);
    this.openLabelHeight.set(this.openLabel().nativeElement.offsetHeight + 76);
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

  logout(): void {
    this.closeProfileMenu();
    this.authService.logout().finally(() => this.router.navigateByUrl('/login'));
  }

  toggleProfileMenu() {
    this.profileMenuOpen = !this.profileMenuOpen;
  }

  closeProfileMenu() {
    this.profileMenuOpen = false;
  }

  openProfilePopup(): void {
    this.closeProfileMenu();
    this.profilePopupOpen = true;
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.searchIndex.set(0);
    this.searchOpen.set(true);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    const results = this.searchResults();
    if (!results.length || !this.handleSearchNavigation(event, results.length)) return;
    if (event.key === 'Enter') this.selectSearchResult(results[this.searchIndex()]);
  }

  selectSearchResult(result: SearchResult): void {
    result.kind === 'channel' ? this.openMentionedChannel(result.channel) : this.openSearchedUser(result.user);
    this.clearSearch();
  }

  closeSearch(): void {
    this.searchOpen.set(false);
    this.searchIndex.set(0);
  }

  private clearSearch(): void {
    this.searchQuery.set('');
    this.closeSearch();
  }

  closeProfilePopup(): void {
    this.profilePopupOpen = false;
  }

  openProfileEdit(): void {
    this.profileSaveError = '';
    this.profileEditOpen = true;
  }

  closeProfileEdit(): void {
    this.profileEditOpen = false;
  }

  saveProfile(edit: ProfileEdit): void {
    this.profileSaveError = '';
    this.authService
      .saveUserProfile(edit.name, this.userEmail, edit.avatar)
      .then(() => this.closeProfileEdit())
      .catch(() => (this.profileSaveError = 'Profil konnte nicht gespeichert werden.'));
  }

  async deleteAccount(): Promise<void> {
    const uid = this.authService.currentUserId;
    if (!uid) return;
    this.accountDeleteError = '';
    this.accountDeleteBusy = true;
    try {
      await this.channelService.removeUserFromChannels(uid);
      await this.userService.deleteUserProfile(uid);
      await this.authService.deleteCurrentAccount();
      await this.router.navigateByUrl('/login');
    } catch (error) { this.accountDeleteError = this.accountDeletionError(error); }
    finally { this.accountDeleteBusy = false; }
  }

  private accountDeletionError(error: unknown): string {
    const code = (error as { code?: string }).code;
    return code === 'auth/requires-recent-login' ? 'Bitte melde dich erneut an und versuche es dann noch einmal.' : 'Das Konto konnte nicht gelöscht werden.';
  }

  openCreateChannelDialog(): void {
    this.createChannelDialogOpen = true;
  }

  closeCreateChannelDialog(): void {
    this.createChannelDialogOpen = false;
  }

  createChannel(channel: NewChannel): void {
    const uid = this.authService.currentUserId;
    if (!uid) return this.closeCreateChannelDialog();
    this.persistChannel(channel.name, channel.description, uid);
  }

  private persistChannel(name: string, description: string, uid: string): void {
    this.channelService
      .createChannel(name, description, uid)
      .then(created => this.openAddPeopleDialog(created))
      .catch(error => console.error('Channel konnte nicht erstellt werden:', error))
      .finally(() => this.closeCreateChannelDialog());
  }

  private openAddPeopleDialog(created: Channel): void {
    this.memberDialogLabel = 'Erstellen';
    this.memberDialogForExistingChannel = false;
    this.memberDialogChannel.set(created);
    this.addPeopleDialogOpen = true;
    this.sidebar()?.selectConversation('channel', created.id);
    this.selectedChannel.set(created);
  }

  openMembersDialog(anchor: DOMRect): void {
    if (!this.selectedChannel()) return;
    this.membersAnchor.set(anchor);
    this.membersDialogOpen = true;
  }

  closeMembersDialog(): void {
    this.membersDialogOpen = false;
  }

  openMemberDialogFromList(): void {
    this.closeMembersDialog();
    this.openMemberDialog();
  }

  get currentUserId(): string | null {
    return this.authService.currentUserId;
  }

  openMemberDialog(): void {
    const channel = this.selectedChannel();
    if (!channel) return;
    this.memberDialogLabel = 'Hinzufügen';
    this.memberDialogForExistingChannel = true;
    this.memberDialogChannel.set(channel);
    this.addPeopleDialogOpen = true;
  }

  openChannelInfo(anchor: DOMRect): void {
    this.channelInfoAnchor.set(anchor);
    this.channelInfoOpen = true;
  }

  closeChannelInfo(): void {
    this.channelInfoOpen = false;
    this.channelInfoAnchor.set(null);
  }

  saveChannelInfo(change: { name: string; description: string }): void {
    const channel = this.selectedChannel();
    if (!channel) return;
    this.channelService.updateChannel(channel.id, change.name, change.description);
  }

  leaveSelectedChannel(): void {
    const channel = this.selectedChannel();
    const uid = this.authService.currentUserId;
    if (!channel || !uid) return;
    this.channelService.leaveChannel(channel.id, uid).then(() => this.openAfterLeaving(channel.id));
  }

  private openAfterLeaving(leftChannelId: string): void {
    this.closeChannelInfo();
    const nextChannel = this.allChannels().find(channel => channel.id !== leftChannelId);
    if (nextChannel) return this.sidebar()?.selectConversation('channel', nextChannel.id);
    const uid = this.authService.currentUserId;
    if (uid) return this.sidebar()?.selectConversation('direct', uid);
    this.openNewMessage();
  }

  selectedChannelCreator(): AppUser | null {
    const creatorId = this.selectedChannel()?.createdBy;
    return this.allUsers().find(user => user.uid === creatorId) ?? null;
  }

  closeAddPeopleDialog(): void {
    this.addPeopleDialogOpen = false;
    this.memberDialogChannel.set(null);
  }

  addMembers(uids: string[]): void {
    const channelId = this.memberDialogChannel()?.id;
    if (!channelId || !uids.length) return this.closeAddPeopleDialog();
    this.channelService
      .addMembers(channelId, uids)
      .catch(error => console.error('Mitglieder konnten nicht hinzugefügt werden:', error))
      .finally(() => this.closeAddPeopleDialog());
  }

  readonly allUsers = computed(() => this.sidebar()?.users() ?? []);
  readonly allChannels = computed(() => this.sidebar()?.channels() ?? []);
  readonly directConversationUserIds = computed(() => this.sidebar()?.directConversationUserIds() ?? []);
  readonly channelMembers = computed(() => this.membersOfSelectedChannel());
  readonly canManageSelectedChannel = computed(() => this.isSelectedChannelMember());

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

  private matchesSearch(value: string, query: string): boolean {
    return value.toLocaleLowerCase('de').includes(query);
  }

  private handleSearchNavigation(event: KeyboardEvent, count: number): boolean {
    if (event.key === 'ArrowDown') this.searchIndex.update(index => (index + 1) % count);
    else if (event.key === 'ArrowUp') this.searchIndex.update(index => (index - 1 + count) % count);
    else if (event.key === 'Escape') return this.closeSearch(), false;
    else if (event.key !== 'Enter') return false;
    event.preventDefault();
    return true;
  }

  private openSearchedUser(user: AppUser): void {
    const sidebar = this.sidebar();
    if (sidebar) return sidebar.selectConversation('direct', user.uid);
    this.startDirectConversation(user);
  }

  private isSelectedChannelMember(): boolean {
    const selected = this.selectedChannel();
    const channel = this.allChannels().find(item => item.id === selected?.id) ?? selected;
    return !!this.currentUserId && !!channel?.members.includes(this.currentUserId);
  }

  private membersOfSelectedChannel(): AppUser[] {
    const members = this.selectedChannel()?.members ?? [];
    return this.allUsers().filter(user => members.includes(user.uid));
  }

  readonly invitableUsers = computed(() => this.usersWithoutMembers());

  private usersWithoutMembers(): AppUser[] {
    const members = this.memberDialogChannel()?.members ?? [];
    return (this.sidebar()?.users() ?? []).filter(user => !members.includes(user.uid));
  }

  get channelNames(): string[] {
    return this.sidebar()?.channels().map(channel => channel.name) ?? [];
  }

  @HostListener('document:keydown.escape')
  closeDialogsWithEscape(): void {
    this.closeProfileMenu();
    this.closeProfilePopup();
    this.closeProfileEdit();
    this.closeCreateChannelDialog();
    this.closeAddPeopleDialog();
    this.closeMembersDialog();
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

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

  openThread(): void {
    this.threadOpen = true;
  }

  closeThread(): void {
    this.threadOpen = false;
  }

  hideInitialThread(): void {
    this.threadOpen = false;
  }

  openNewMessage(): void {
    this.selfChatOpen = false;
    this.selectedDirectUser = null;
    this.newMessageOpen = true;
  }

  startDirectConversation(user: AppUser): void {
    this.selectConversation({ type: 'direct', id: user.uid, user });
    this.threadOpen = false;
  }

  openMentionedChannel(channel: Channel): void {
    const sidebar = this.sidebar();
    if (sidebar) return sidebar.selectConversation('channel', channel.id);
    this.selectConversation({ type: 'channel', id: channel.id, channel });
  }
}
