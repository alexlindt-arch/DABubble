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

export interface Channel {}

export interface Message {}
