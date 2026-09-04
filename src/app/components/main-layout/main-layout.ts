import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { Chat } from '../chat/chat';
import { Thread } from '../thread/thread';
import { NewMessage } from '../new-message/new-message';
import { AuthService } from '../../services/auth.service';
import { avatarUrl } from '../../shared/avatar-url';

@Component({
  selector: 'app-main-layout',
  imports: [Sidebar, Chat, Thread, NewMessage],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly currentUser = this.authService.currentUser;

  profileMenuOpen = false;
  sidebarOpen = true;
  selfChatOpen = false;
  closeLabelHeight = signal(310);
  openLabelHeight = signal(280);
  private closeLabel = viewChild.required<ElementRef<HTMLElement>>('closeLabel');
  private openLabel = viewChild.required<ElementRef<HTMLElement>>('openLabel');
  private destroyRef = inject(DestroyRef);

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

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  selectConversation(conversation: { type: 'channel' | 'direct'; id: string }): void {
    this.selfChatOpen = conversation.type === 'direct' && conversation.id === 'Frederik Beck';
  }
}
