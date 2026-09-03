import { Component, output } from '@angular/core';

@Component({
  imports: [],
  selector: 'app-sidebar',
  styleUrl: './sidebar.scss',
  templateUrl: './sidebar.html',
})
export class Sidebar {
  channelsOpen = true;
  directMessagesOpen = true;
  selectedConversation = '';
  channelCreateRequested = output<void>();
  conversationSelected = output<{ type: 'channel' | 'direct'; id: string }>();

  // Preview data until the shared Firebase data service is connected.
  channels = ['Entwicklerteam', 'Office-team'];
  users = [
    { name: 'Frederik Beck', isSelf: true, online: true },
    { name: 'Sofia Müller', isSelf: false, online: true },
    { name: 'Noah Braun', isSelf: false, online: true },
    { name: 'Elise Roth', isSelf: false, online: false },
    { name: 'Elias Neumann', isSelf: false, online: true },
    { name: 'Steffen Hoffmann', isSelf: false, online: true },
  ];

  toggleChannels(): void {
    this.channelsOpen = !this.channelsOpen;
  }

  toggleDirectMessages(): void {
    this.directMessagesOpen = !this.directMessagesOpen;
  }

  selectConversation(type: 'channel' | 'direct', id: string): void {
    this.selectedConversation = `${type}:${id}`;
    this.conversationSelected.emit({ type, id });
  }
}
