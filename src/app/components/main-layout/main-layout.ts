import { Component } from '@angular/core';
import { Sidebar } from '../sidebar/sidebar';
import { Chat } from '../chat/chat';
import { Thread } from '../thread/thread';
import { NewMessage } from '../new-message/new-message';

@Component({
  selector: 'app-main-layout',
  imports: [Sidebar, Chat, Thread, NewMessage],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout {}
