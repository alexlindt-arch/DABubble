import { Injectable } from '@angular/core';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  CollectionReference,
  doc,
  DocumentReference,
  Firestore,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  QueryDocumentSnapshot,
  Timestamp,
  Unsubscribe,
  updateDoc,
} from 'firebase/firestore';
import { firebaseApp } from '../firebase';
import { Message, MessageProfile } from '../models';

@Injectable({ providedIn: 'root' })
export class MessageService {
  private readonly firestore: Firestore = getFirestore(firebaseApp);

  async sendMessage(channelId: string, text: string, senderId: string): Promise<void> {
    const profile: MessageProfile = {
      text,
      senderId,
      timestamp: Timestamp.now(),
      reactions: {},
      threadCount: 0,
    };
    await addDoc(this.messagesRef(channelId), profile);
  }

  watchMessages(channelId: string, onChange: (messages: Message[]) => void): Unsubscribe {
    return onSnapshot(
      query(this.messagesRef(channelId), orderBy('timestamp')),
      snapshot => onChange(snapshot.docs.map(item => this.toMessage(item))),
      error => console.error('Nachrichten konnten nicht geladen werden:', error),
    );
  }

  toggleReaction(channelId: string, message: Message, emoji: string, uid: string): Promise<void> {
    const reacted = message.reactions?.[emoji]?.includes(uid) ?? false;
    return updateDoc(this.messageRef(channelId, message.id), {
      [`reactions.${emoji}`]: reacted ? arrayRemove(uid) : arrayUnion(uid),
    });
  }

  private messageRef(channelId: string, messageId: string): DocumentReference {
    return doc(this.firestore, 'channels', channelId, 'messages', messageId);
  }

  private toMessage(document: QueryDocumentSnapshot): Message {
    return { id: document.id, ...(document.data() as MessageProfile) };
  }

  private messagesRef(channelId: string): CollectionReference {
    return collection(this.firestore, 'channels', channelId, 'messages');
  }
}
