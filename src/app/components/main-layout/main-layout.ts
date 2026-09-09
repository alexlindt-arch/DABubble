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
import { avatarUrl } from '../../shared/avatar-url';
import { AddPeopleDialog } from '../add-people-dialog/add-people-dialog';
import { MembersDialog } from '../members-dialog/members-dialog';
import { CreateChannelDialog, NewChannel } from '../create-channel-dialog/create-channel-dialog';
import { NewMessage } from '../new-message/new-message';
import { ProfileEdit, ProfileEditDialog } from '../profile-edit-dialog/profile-edit-dialog';
import { AppUser, Channel } from '../../models';

@Component({
  selector: 'app-main-layout',
  imports: [Sidebar, Chat, Thread, CreateChannelDialog, AddPeopleDialog, MembersDialog, NewMessage, ProfileEditDialog],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout {
  private readonly authService = inject(AuthService);
  private readonly channelService = inject(ChannelService);
  private readonly router = inject(Router);

  readonly currentUser = this.authService.currentUser;

  profileMenuOpen = false;
  profilePopupOpen = false;
  profileEditOpen = false;
  profileSaveError = '';
  createChannelDialogOpen = false;
  addPeopleDialogOpen = false;
  membersDialogOpen = false;
  membersAnchor = signal<DOMRect | null>(null);
  memberDialogLabel = 'Erstellen';
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

  closeProfilePopup(): void {
    this.profilePopupOpen = false;
  }

  openProfileEdit(): void {
    this.profileSaveError = '';
    this.closeProfilePopup();
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
    this.memberDialogChannel.set(channel);
    this.addPeopleDialogOpen = true;
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
  readonly directConversationUserIds = computed(() => this.sidebar()?.directConversationUserIds() ?? []);
  readonly channelMembers = computed(() => this.membersOfSelectedChannel());

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
}
