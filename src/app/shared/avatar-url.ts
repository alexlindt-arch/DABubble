const AVATAR_BASE = '/assets/img/avatar/';

export const PLACEHOLDER_AVATAR = '/assets/img/Profile.svg';

/** Builds the asset path for an avatar file name stored in Firestore. */
export function avatarUrl(avatar: string | null | undefined): string {
  if (!avatar) return PLACEHOLDER_AVATAR;
  if (avatar.startsWith('/') || avatar.startsWith('http')) return avatar;
  return `${AVATAR_BASE}${encodeURIComponent(avatar)}`;
}
