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

export interface Message {}
