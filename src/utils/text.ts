/**
 * Truncates `text` to at most `maxLength` characters, breaking at the last
 * word boundary within the limit and appending an ellipsis. Used to derive a
 * short excerpt from a full article body when WordPress doesn't supply one.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  const slice = text.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trimEnd()}…`;
}
