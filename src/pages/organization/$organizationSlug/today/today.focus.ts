/**
 * Where focus goes back to when Today shows again after a card's action opened
 * the patient's visit flow (KICKOFF §6.6, §7.2; L-64): the action of that card.
 * The flow is the patient's page, so Today remembers the card when its action
 * navigates away and its panel focuses it once it shows again — memory only,
 * for this page load.
 */
let pending: string | null = null;

/** Remember the card whose lane action opened the patient's visit flow. */
export function rememberVisitCard(cardId: string): void {
  pending = cardId;
}

/** The card to focus — handed out once, then forgotten. */
export function takeVisitCard(): string | null {
  const cardId = pending;
  pending = null;
  return cardId;
}
