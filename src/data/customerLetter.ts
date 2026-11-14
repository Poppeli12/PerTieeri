const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ';
/** One stable letter per customer. The full ID remains the unique identifier. */
export function customerLetter(id: string) {
  const number = Number(id.match(/\d+$/)?.[0]);
  const index = Number.isFinite(number) && number > 0 ? number - 1 : [...id].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  return LETTERS[index % LETTERS.length];
}
