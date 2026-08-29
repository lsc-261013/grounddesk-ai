const ENGLISH_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'can',
  'do',
  'does',
  'for',
  'how',
  'i',
  'in',
  'is',
  'it',
  'my',
  'of',
  'on',
  'the',
  'to',
  'what',
  'when',
  'with',
])

export const buildKeywordQuery = (query: string): string => {
  const tokens = query.match(/[\p{L}\p{N}][\p{L}\p{N}._+-]*/gu) ?? []
  const meaningful = tokens
    .map((token) => token.toLocaleLowerCase('en-US'))
    .filter((token) => token.length >= 2 && !ENGLISH_STOP_WORDS.has(token))
  const unique = [...new Set(meaningful)].slice(0, 12)

  return unique.length > 0 ? unique.join(' OR ') : query.trim()
}
