import { afterNextRender, Component, computed, ElementRef, HostListener, inject, input, output, signal, viewChild } from '@angular/core';
import { AppUser, Channel } from '../../models';
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
  channels = input<Channel[]>([]);
  existingConversationUserIds = input<string[]>([]);
  conversationStarted = output<AppUser>();
  channelStarted = output<Channel>();
  recipient = signal<AppUser | null>(null);
  channelRecipient = signal<Channel | null>(null);
  recipientQuery = signal('');
  draft = signal('');
  emojiPickerOpen = signal(false);
  readonly emojis = EMOJIS;
  private readonly authService = inject(AuthService);
  private readonly messageService = inject(MessageService);
  private readonly recipientInput = viewChild<ElementRef<HTMLInputElement>>('recipientInput');
  private readonly editor = viewChild<ElementRef<HTMLTextAreaElement>>('editor');
  readonly userSuggestions = computed(() => this.matchingUsers());
  readonly channelSuggestions = computed(() => this.matchingChannels());

  constructor() {
    afterNextRender(() => this.recipientInput()?.nativeElement.focus());
  }

  updateRecipientQuery(value: string): void {
    this.recipientQuery.set(value);
    this.recipient.set(null);
    this.channelRecipient.set(null);
  }

  selectRecipient(user: AppUser): void {
    if (this.existingConversationUserIds().includes(user.uid)) {
      this.conversationStarted.emit(user);
      return;
    }
    this.recipient.set(user);
    this.channelRecipient.set(null);
    this.recipientQuery.set(`@${user.name}`);
    this.editor()?.nativeElement.focus();
  }

  selectChannel(channel: Channel): void {
    this.channelRecipient.set(channel);
    this.recipient.set(null);
    this.recipientQuery.set(`#${channel.name}`);
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
    const channel = this.channelRecipient();
    const senderId = this.authService.currentUserId;
    const text = this.draft().trim();
    if (!senderId || !text || (!recipient && !channel)) return;
    if (channel) {
      await this.messageService.sendMessage(channel.id, text, senderId);
      this.channelStarted.emit(channel);
      return;
    }
    if (recipient) {
      await this.messageService.sendDirectMessage(senderId, recipient.uid, text);
      this.conversationStarted.emit(recipient);
    }
  }

  @HostListener('document:click', ['$event'])
  closeEmojiPickerOutside(event: MouseEvent): void {
    if (!(event.target as HTMLElement).closest('.emoji-picker, .composer-button')) this.emojiPickerOpen.set(false);
  }

  private matchingUsers(): AppUser[] {
    const raw = this.recipientQuery().trimStart();
    if (raw.startsWith('#') || this.recipient() || this.channelRecipient()) return [];
    const query = raw.replace(/^@/, '').trim().toLocaleLowerCase('de');
    if (!raw.startsWith('@') && !query) return [];
    return this.users().filter(user =>
      user.name.toLocaleLowerCase('de').includes(query) || user.email.toLocaleLowerCase('de').includes(query));
  }

  private matchingChannels(): Channel[] {
    const raw = this.recipientQuery().trimStart();
    if (!raw.startsWith('#') || this.recipient() || this.channelRecipient()) return [];
    const query = raw.slice(1).trim().toLocaleLowerCase('de');
    return this.channels().filter(channel => channel.name.toLocaleLowerCase('de').includes(query));
  }
}
