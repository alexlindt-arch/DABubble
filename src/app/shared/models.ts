import { Timestamp } from 'firebase/firestore';

export type UserStatus = 'online' | 'offline' | 'away';

export interface UserProfile {
  name: string;
  email: string;
  avatar: string;
  status: UserStatus;
  /** Nur Gast-Konten: Zeitpunkt, an dem alle Daten der Gast-Sitzung gelöscht werden. */
  guestUntil?: Timestamp;
}

export interface AppUser extends UserProfile {
  uid: string;
}

export interface ChannelProfile {
  name: string;
  description: string;
  createdBy: string;
  members: string[];
  createdAt: Timestamp;
}

export interface Channel extends ChannelProfile {
  id: string;
}

export interface MessageProfile {
  text: string;
  senderId: string;
  timestamp: Timestamp;
  reactions: Record<string, string[]>;
  threadCount: number;
  editedAt?: Timestamp;
  /** Set on thread replies and holds the id of the message the thread belongs to. */
  parentId?: string;
}

export interface Message extends MessageProfile {
  id: string;
}

/** Metadaten eines privaten Chats. Die eigentlichen Nachrichten liegen darunter. */
export interface DirectConversationProfile {
  members: string[];
  createdAt: Timestamp;
  lastMessageAt: Timestamp;
  lastMessage: string;
  lastMessageId: string;
  lastSenderId: string;
  lastActivityAt?: Timestamp;
  lastActivityBy?: string;
  messageCount: number;
  lastReadAt?: Record<string, Timestamp>;
}

export interface DirectConversation extends DirectConversationProfile {
  id: string;
}

/** A conversation selected from the sidebar or from a search result. */
export interface ConversationSelection {
  type: 'channel' | 'direct';
  id: string;
  user?: AppUser;
  channel?: Channel;
}

/** Name and description submitted from the channel information dialog. */
export interface ChannelEdit {
  name: string;
  description: string;
}
