import { afterNextRender, Component, computed, ElementRef, HostListener, inject, input, output, signal, viewChild } from '@angular/core';
import { AppUser } from '../../models';
import { AuthService } from '../../services/auth.service';
import { MessageService } from '../../services/message.service';
import { avatarUrl } from '../../shared/avatar-url';
import { EMOJIS } from '../../shared/emojis';

@Component({
  imports: [],
  selector: 'app-new-message',
  styleUrl: './new-message.scss',
  templateUrl: './new-message.html',
})
export class NewMessage {
  users = input<AppUser[]>([]);
  existingConversationUserIds = input<string[]>([]);
  conversationStarted = output<AppUser>();
  recipient = signal<AppUser | null>(null);
  recipientQuery = signal('');
  draft = signal('');
  emojiPickerOpen = signal(false);
  readonly emojis = EMOJIS;
  private readonly authService = inject(AuthService);
  private readonly messageService = inject(MessageService);
  private readonly recipientInput = viewChild<ElementRef<HTMLInputElement>>('recipientInput');
  private readonly editor = viewChild<ElementRef<HTMLTextAreaElement>>('editor');
  readonly suggestions = computed(() => this.matchingUsers());

  constructor() {
    afterNextRender(() => this.recipientInput()?.nativeElement.focus());
  }

  updateRecipientQuery(value: string): void {
    this.recipientQuery.set(value);
    this.recipient.set(null);
  }

  selectRecipient(user: AppUser): void {
    if (this.existingConversationUserIds().includes(user.uid)) {
      this.conversationStarted.emit(user);
      return;
    }
    this.recipient.set(user);
    this.recipientQuery.set(user.name);
    this.editor()?.nativeElement.focus();
  }

  avatar(user: AppUser): string {
    return avatarUrl(user.avatar);
  }

  insertEmoji(emoji: string): void {
    const editor = this.editor()?.nativeElement;
    if (!editor) return;
    this.draft.set(`${this.draft()}${emoji}`);
    this.emojiPickerOpen.set(false);
    editor.focus();
  }

  async sendMessage(event: Event): Promise<void> {
    event.preventDefault();
    const recipient = this.recipient();
    const senderId = this.authService.currentUserId;
    const text = this.draft().trim();
    if (!recipient || !senderId || !text) return;
    await this.messageService.sendDirectMessage(senderId, recipient.uid, text);
    this.conversationStarted.emit(recipient);
  }

  @HostListener('document:click', ['$event'])
  closeEmojiPickerOutside(event: MouseEvent): void {
    if (!(event.target as HTMLElement).closest('.emoji-picker, .composer-button')) this.emojiPickerOpen.set(false);
  }

  private matchingUsers(): AppUser[] {
    const query = this.recipientQuery().replace(/^@/, '').trim().toLocaleLowerCase('de');
    if (this.recipient() || !query || !this.users().length) return [];
    return this.users().filter(user => user.uid !== this.authService.currentUserId
      && (user.name.toLocaleLowerCase('de').includes(query) || user.email.toLocaleLowerCase('de').includes(query)));
  }
}
