import { Message } from './models';

export interface MessageReaction {
  emoji: string;
  uids: string[];
}


/** Returns the reactions of a message that still have at least one user. */
export function reactionsOf(message: Message): MessageReaction[] {
  return Object.entries(message.reactions ?? {})
    .filter(([, uids]) => uids.length > 0)
    .map(([emoji, uids]) => ({ emoji, uids }));
}


/** Reports whether the given user is among the reacting users. */
export function hasReacted(uids: string[], uid: string | null): boolean {
  return !!uid && uids.includes(uid);
}


/** Returns the verb matching the number of reacting users. */
export function reactionVerb(uids: string[]): string {
  return uids.length === 1 ? 'hat reagiert' : 'haben reagiert';
}


/** Joins reaction names into the summary shown in a tooltip. */
export function joinReactionNames(names: string[]): string {
  if (names.length < 2) return names[0] ?? '';
  if (names.length === 2) return names.join(' und ');
  if (names.length === 3) return `${names[0]}, ${names[1]} und ${names[2]}`;
  return `${names[0]}, ${names[1]} und ${names.length - 2} weitere`;
}
