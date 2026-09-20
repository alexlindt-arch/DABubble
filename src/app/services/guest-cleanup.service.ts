import { inject, Injectable } from '@angular/core';
import { AppUser, Channel } from '../models';
import { ChannelService } from './channel.service';
import { MessageService } from './message.service';
import { UserService } from './user.service';

/** Räumt weg, was Gäste hinterlassen haben - beim eigenen Ablauf und bei fremden Altlasten. */
@Injectable({ providedIn: 'root' })
export class GuestCleanupService {
  private readonly channelService = inject(ChannelService);
  private readonly messageService = inject(MessageService);
  private readonly userService = inject(UserService);

  /** Jeder angemeldete Client räumt abgelaufene Gast-Sitzungen auf, nicht nur der Gast selbst. */
  async sweepExpiredGuests(): Promise<void> {
    const users = await this.userService.loadUsers();
    for (const guest of users.filter(isExpiredGuest)) await this.removeGuestData(guest.uid);
  }

  /** Das Profil geht zuletzt: Es weist den Rules nach, dass die Daten gelöscht werden dürfen. */
  async removeGuestData(uid: string): Promise<void> {
    const channels = await this.channelService.loadChannels();
    const channelsCleared = await this.clearChannels(channels, uid);
    const chatsCleared = await this.tryClear(() => this.messageService.deleteDirectChatsOf(uid));
    if (channelsCleared && chatsCleared) await this.userService.deleteUserProfile(uid);
  }

  private async clearChannels(channels: Channel[], uid: string): Promise<boolean> {
    let cleared = true;
    for (const channel of channels) {
      cleared = (await this.tryClear(() => this.clearChannel(channel, uid))) && cleared;
    }
    return cleared;
  }

  /** Eigene Channels verschwinden ganz, in fremden bleiben nur die Beiträge der anderen. */
  private async clearChannel(channel: Channel, uid: string): Promise<void> {
    if (channel.createdBy === uid) return this.deleteChannel(channel.id);
    await this.messageService.purgeAuthor(channel.id, uid);
    if (channel.members.includes(uid)) await this.leaveQuietly(channel.id, uid);
  }

  private async deleteChannel(channelId: string): Promise<void> {
    await this.messageService.deleteAllMessages(channelId);
    await this.channelService.deleteChannel(channelId);
  }

  /** Nur Mitglieder dürfen die Mitgliederliste ändern; sonst bleibt die tote UID stehen. */
  private leaveQuietly(channelId: string, uid: string): Promise<void> {
    return this.channelService.leaveChannel(channelId, uid).catch(() => undefined);
  }

  /** Ein blockierter Schritt darf die übrigen nicht stoppen, sonst bleibt alles liegen. */
  private async tryClear(task: () => Promise<void>): Promise<boolean> {
    try {
      await task();
      return true;
    } catch (error) {
      console.error('Gast-Daten konnten nicht gelöscht werden:', error);
      return false;
    }
  }
}

function isExpiredGuest(user: AppUser): boolean {
  return !!user.guestUntil && user.guestUntil.toMillis() <= Date.now();
}
