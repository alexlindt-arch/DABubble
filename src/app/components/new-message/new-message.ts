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
/** Provides the composer for starting channel and direct conversations. */
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

  /** Focuses the recipient field after the composer has rendered. */
  constructor() {
    afterNextRender(() => this.recipientInput()?.nativeElement.focus());
  }

  /** Updates the recipient search query and clears the current selection. */
  updateRecipientQuery(value: string): void {
    this.recipientQuery.set(value);
    this.recipient.set(null);
    this.channelRecipient.set(null);
  }

  /** Selects a direct-message recipient or opens an existing conversation. */
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

  /** Selects a channel recipient for the new message. */
  selectChannel(channel: Channel): void {
    this.channelRecipient.set(channel);
    this.recipient.set(null);
    this.recipientQuery.set(`#${channel.name}`);
    this.editor()?.nativeElement.focus();
  }

  /** Returns the avatar URL for a suggested user. */
  avatar(user: AppUser): string {
    return avatarUrl(user.avatar);
  }

  /** Appends an emoji to the draft and restores editor focus. */
  insertEmoji(emoji: string): void {
    const editor = this.editor()?.nativeElement;
    if (!editor) return;
    this.draft.set(`${this.draft()}${emoji}`);
    this.emojiPickerOpen.set(false);
    editor.focus();
  }

  /** Validates and sends the draft to the selected channel or user. */
  async sendMessage(event: Event): Promise<void> {
    event.preventDefault();
    const recipient = this.recipient();
    const channel = this.channelRecipient();
    const senderId = this.authService.currentUserId;
    const text = this.draft().trim();
    if (!senderId || !text || (!recipient && !channel)) return;
    if (channel) return this.sendToChannel(channel, text, senderId);
    if (recipient) await this.sendToRecipient(recipient, text, senderId);
  }

  /** Sends a message to a channel and emits the conversation event. */
  private async sendToChannel(channel: Channel, text: string, senderId: string): Promise<void> {
    await this.messageService.sendMessage(channel.id, text, senderId);
    this.channelStarted.emit(channel);
  }

  /** Sends a direct message and emits the conversation event. */
  private async sendToRecipient(recipient: AppUser, text: string, senderId: string): Promise<void> {
    await this.messageService.sendDirectMessage(senderId, recipient.uid, text);
    this.conversationStarted.emit(recipient);
  }

  @HostListener('document:click', ['$event'])
  /** Closes the emoji picker when a click occurs outside it. */
  closeEmojiPickerOutside(event: MouseEvent): void {
    if (!(event.target as HTMLElement).closest('.emoji-picker, .composer-button')) this.emojiPickerOpen.set(false);
  }

  /** Returns users matching the current recipient query. */
  private matchingUsers(): AppUser[] {
    const raw = this.recipientQuery().trimStart();
    if (raw.startsWith('#') || this.recipient() || this.channelRecipient()) return [];
    const query = raw.replace(/^@/, '').trim().toLocaleLowerCase('de');
    if (!raw.startsWith('@') && !query) return [];
    return this.users().filter(user =>
      user.name.toLocaleLowerCase('de').includes(query) || user.email.toLocaleLowerCase('de').includes(query));
  }

  /** Returns channels matching the current recipient query. */
  private matchingChannels(): Channel[] {
    const raw = this.recipientQuery().trimStart();
    if (!raw.startsWith('#') || this.recipient() || this.channelRecipient()) return [];
    const query = raw.slice(1).trim().toLocaleLowerCase('de');
    return this.channels().filter(channel => channel.name.toLocaleLowerCase('de').includes(query));
  }
}
