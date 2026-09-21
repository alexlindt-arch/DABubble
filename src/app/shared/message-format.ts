import { Message } from './models';


/** Returns the localized label for a number of thread replies. */
export function replyLabel(count: number): string {
  return `${count} ${count === 1 ? 'Antwort' : 'Antworten'}`;
}


/** Reports whether the message at the given index opens a new calendar day. */
export function startsNewDay(messages: Message[], index: number): boolean {
  if (index === 0) return true;
  return messageDay(messages[index]) !== messageDay(messages[index - 1]);
}


/** Replaces the text of one message inside a message collection. */
export function replaceMessageText(messages: Message[], messageId: string, text: string): Message[] {
  return messages.map(message => message.id === messageId ? { ...message, text } : message);
}


/** Returns the calendar day a message belongs to. */
function messageDay(message: Message): string {
  return message.timestamp?.toDate?.()?.toDateString() ?? '';
}
