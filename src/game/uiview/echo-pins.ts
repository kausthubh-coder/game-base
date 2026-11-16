/** The Custodian reveals these doors without requiring the player to visit them. */
export function custodianMarked(marked: boolean, place: string): boolean {
  return marked && (place === 'pumphouse' || place === 'lampgallery' || place === 'seedvault');
}
