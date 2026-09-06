import {
  afterNextRender,
  Component,
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
import { avatarUrl } from '../../shared/avatar-url';
import { CreateChannelDialog, NewChannel } from '../create-channel-dialog/create-channel-dialog';
import { NewMessage } from '../new-message/new-message';
import { AppUser } from '../../models';

@Component({
  selector: 'app-main-layout',
  imports: [Sidebar, Chat, Thread, CreateChannelDialog, NewMessage],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly currentUser = this.authService.currentUser;

  profileMenuOpen = false;
  profilePopupOpen = false;
  createChannelDialogOpen = false;
  sidebarOpen = true;
  selfChatOpen = false;
  newMessageOpen = false;
  threadOpen = true;
  selectedDirectUser: AppUser | null = null;
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

  openCreateChannelDialog(): void {
    this.createChannelDialogOpen = true;
  }

  closeCreateChannelDialog(): void {
    this.createChannelDialogOpen = false;
  }

  createChannel(channel: NewChannel): void {
    this.sidebar()?.addChannel(channel.name);
    this.closeCreateChannelDialog();
  }

  get channelNames(): string[] {
    return this.sidebar()?.channels ?? [];
  }

  @HostListener('document:keydown.escape')
  closeDialogsWithEscape(): void {
    this.closeProfileMenu();
    this.closeProfilePopup();
    this.closeCreateChannelDialog();
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  selectConversation(conversation: { type: 'channel' | 'direct'; id: string; user?: AppUser }): void {
    this.newMessageOpen = false;
    this.threadOpen = true;
    this.selfChatOpen = conversation.type === 'direct' && conversation.id === this.currentUser()?.uid;
    this.selectedDirectUser = conversation.type === 'direct' && !this.selfChatOpen ? conversation.user ?? null : null;
  }

  closeThread(): void {
    this.threadOpen = false;
  }

  openNewMessage(): void {
    this.selfChatOpen = false;
    this.selectedDirectUser = null;
    this.newMessageOpen = true;
  }
}
