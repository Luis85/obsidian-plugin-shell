/** Shared yes/no decision policy. Prompt rendering remains presentation-specific. */
export function parseConfirmation(value) {
  const answer = value.trim().toLowerCase();
  if (answer === 'y' || answer === 'yes') return true;
  if (!answer || answer === 'n' || answer === 'no') return false;
  return null;
}
