/** The six avatars users can pick from, in the order the picker shows them. */
export const AVATAR_FILES = [
  'Property 1=Elias Neumann.png',
  'Property 1=Elise Roth.png',
  'Property 1=Frederik Beck.png',
  'Property 1=Noah Braun.png',
  'Property 1=Sofia Müller.png',
  'Property 1=Steffen Hoffmann.png',
];

/** Strips the design file naming so an avatar can be labelled for screen readers. */
export function avatarLabel(file: string): string {
  return file.replace('Property 1=', '').replace('.png', '');
}
