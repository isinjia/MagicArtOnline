/** 받침 유무로 조사를 고른다. 예: josa('검', '을', '를') → '검을' */
export function josa(word: string, withBatchim: string, without: string): string {
  const code = word.charCodeAt(word.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return word + without;
  return word + ((code - 0xac00) % 28 === 0 ? without : withBatchim);
}
