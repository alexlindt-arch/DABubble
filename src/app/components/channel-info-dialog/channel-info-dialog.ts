import { Component, input, output, signal } from '@angular/core';
import { AppUser, Channel } from '../../models';
import { ProfileDialog } from '../profile-dialog/profile-dialog';

@Component({ selector: 'app-channel-info-dialog', imports: [ProfileDialog], templateUrl: './channel-info-dialog.html', styleUrl: './channel-info-dialog.scss' })
export class ChannelInfoDialog {
  channel = input.required<Channel>();
  creator = input<AppUser | null>(null);
  currentUserId = input<string | null>(null);
  anchor = input<DOMRect | null>(null);
  closed = output<void>();
  saved = output<{ name: string; description: string }>();
  left = output<void>();
  messageRequested = output<AppUser>();
  creatorProfileOpen = signal(false);
  editingName = signal(false);
  editingDescription = signal(false);
  nameDraft = signal('');
  descriptionDraft = signal('');
  get offsetTop(): string { return `${Math.round((this.anchor()?.bottom ?? 150) + 8)}px`; }
  get offsetLeft(): string { return `${Math.round(this.anchor()?.left ?? 24)}px`; }
  editName(): void { this.nameDraft.set(this.channel().name); this.editingName.set(true); }
  editDescription(): void { this.descriptionDraft.set(this.channel().description); this.editingDescription.set(true); }
  saveName(): void { this.save(this.nameDraft().trim(), this.channel().description); }
  saveDescription(): void { this.save(this.channel().name, this.descriptionDraft().trim()); }
  openCreatorProfile(): void { this.creatorProfileOpen.set(true); }
  closeCreatorProfile(): void { this.creatorProfileOpen.set(false); }
  private save(name: string, description: string): void {
    if (!name || !description) return;
    this.saved.emit({ name, description });
    this.editingName.set(false);
    this.editingDescription.set(false);
  }
}
