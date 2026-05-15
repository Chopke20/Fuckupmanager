import { clampOrderOfferBlockTitle, ORDER_OFFER_BLOCK_TITLE_MAX_LENGTH } from '../constants/orderOfferBlock';

export type OfferBlockInput = { id?: string; title: string };
export type LineWithOfferBlock = { offerBlockId?: string | null };

/**
 * Walidacja bloków oferty przy zapisie zlecenia.
 * Pusty tytuł lub blok bez przypisanych pozycji → komunikat błędu.
 */
export function validateOrderOfferBlocksForSave(
  blocks: OfferBlockInput[] | undefined,
  equipmentItems: LineWithOfferBlock[] | undefined,
  productionItems: LineWithOfferBlock[] | undefined,
): string | null {
  const list = Array.isArray(blocks) ? blocks : [];
  if (list.length === 0) return null;

  const blockIds = new Set<string>();

  for (let i = 0; i < list.length; i++) {
    const block = list[i]!;
    const title = clampOrderOfferBlockTitle(block.title);
    if (!title) {
      return `Blok ${i + 1}: podaj tytuł (np. „Duża scena”).`;
    }
    if (title.length > ORDER_OFFER_BLOCK_TITLE_MAX_LENGTH) {
      return `Tytuł bloku może mieć maksymalnie ${ORDER_OFFER_BLOCK_TITLE_MAX_LENGTH} znaków.`;
    }
    if (!block.id) {
      return `Blok „${title}”: brak identyfikatora — odśwież formularz i spróbuj ponownie.`;
    }
    blockIds.add(block.id);
  }

  const countForBlock = (blockId: string) => {
    const eq = (equipmentItems ?? []).filter((r) => r.offerBlockId === blockId).length;
    const prod = (productionItems ?? []).filter((r) => r.offerBlockId === blockId).length;
    return eq + prod;
  };

  for (const block of list) {
    const title = clampOrderOfferBlockTitle(block.title);
    const blockId = block.id!;
    if (countForBlock(blockId) < 1) {
      return `Blok „${title}”: przypisz co najmniej jedną pozycję (sprzęt, produkcja lub transport).`;
    }
  }

  const allLines = [...(equipmentItems ?? []), ...(productionItems ?? [])];
  for (const row of allLines) {
    const bid = row.offerBlockId;
    if (bid && !blockIds.has(bid)) {
      return 'Niektóre pozycje wskazują nieistniejący blok — wybierz „Bez bloku”.';
    }
  }

  return null;
}
