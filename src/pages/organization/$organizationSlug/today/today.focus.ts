/**
 * Where focus goes back to when the Visit sheet closes (KICKOFF §6.13, §7.2):
 * the action of the card that opened it. The sheet is its own route, so Today
 * remembers the card when its action navigates away and its panel focuses it
 * once it shows again — memory only, for this page load.
 */
let pending: string | null = null;

/** Remember the card whose lane action opened the Visit sheet. */
export function rememberVisitCard(cardId: string): void {
  pending = cardId;
}

/** The card to focus — handed out once, then forgotten. */
export function takeVisitCard(): string | null {
  const cardId = pending;
  pending = null;
  return cardId;
}
