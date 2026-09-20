import { inject, Injectable } from '@angular/core';
import { Channel } from '../models';
import { ChannelService } from './channel.service';
import { MessageService } from './message.service';
import { UserService } from './user.service';

/** Räumt am Ende einer Gast-Sitzung alles weg, was der Gast hinterlassen hat. */
@Injectable({ providedIn: 'root' })
export class GuestCleanupService {
  private readonly channelService = inject(ChannelService);
  private readonly messageService = inject(MessageService);
  private readonly userService = inject(UserService);

  async removeGuestData(uid: string): Promise<void> {
    const channels = await this.channelService.loadChannels();
    await this.clearChannels(channels, uid);
    await this.channelService.removeUserFromChannels(uid);
    await this.messageService.deleteDirectChatsOf(uid);
    await this.userService.deleteUserProfile(uid);
  }

  private async clearChannels(channels: Channel[], uid: string): Promise<void> {
    for (const channel of channels) await this.clearChannel(channel, uid);
  }

  /** Eigene Channels verschwinden ganz, in fremden bleiben nur die Beiträge der anderen. */
  private clearChannel(channel: Channel, uid: string): Promise<void> {
    if (channel.createdBy === uid) return this.deleteChannel(channel.id);
    return this.messageService.purgeAuthor(channel.id, uid);
  }

  private async deleteChannel(channelId: string): Promise<void> {
    await this.messageService.deleteAllMessages(channelId);
    await this.channelService.deleteChannel(channelId);
  }
}
