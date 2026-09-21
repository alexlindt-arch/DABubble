/**
 * Height a sidebar toggle needs for one of its labels. Padding, icon, and gap
 * scale with the window, so they are measured live instead of hard-coded.
 */
export function toggleHeightFor(label: HTMLElement): number {
  const button = label.closest('button');
  if (!button) return label.offsetHeight;
  const style = getComputedStyle(button);
  const icon = button.querySelector<HTMLElement>('.toggle-icon')?.offsetHeight ?? 0;
  const chrome = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
    + parseFloat(style.rowGap) + icon;
  return label.offsetHeight + chrome;
}
