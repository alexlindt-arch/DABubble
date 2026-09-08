import { Timestamp } from 'firebase/firestore';

export type UserStatus = 'online' | 'offline' | 'away';

export interface UserProfile {
  name: string;
  email: string;
  avatar: string;
  status: UserStatus;
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
