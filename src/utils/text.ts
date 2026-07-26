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

/** Counts words in plain text by splitting on whitespace runs. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

const AVERAGE_READING_WORDS_PER_MINUTE = 200;

/** Estimates reading time in whole minutes from a word count, assuming ~200 words/minute. Empty content is 0 minutes. */
export function estimateReadingTimeMinutes(wordCount: number): number {
  return wordCount === 0 ? 0 : Math.max(1, Math.ceil(wordCount / AVERAGE_READING_WORDS_PER_MINUTE));
}
