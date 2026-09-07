import { Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  CollectionReference,
  Firestore,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  QueryDocumentSnapshot,
  Timestamp,
  Unsubscribe,
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

  private toMessage(document: QueryDocumentSnapshot): Message {
    return { id: document.id, ...(document.data() as MessageProfile) };
  }

  private messagesRef(channelId: string): CollectionReference {
    return collection(this.firestore, 'channels', channelId, 'messages');
  }
}
