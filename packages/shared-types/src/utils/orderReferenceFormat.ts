import type { DocumentType } from '../schemas/order-document.schema';

// Format: ORD-{YY}-{NNNN}  e.g. ORD-26-0042
export function formatOrderReference(orderNumber: number, orderYear: number): string {
  const yy = String(orderYear % 100).padStart(2, '0');
  const nnnn = String(orderNumber).padStart(4, '0');
  return `ORD-${yy}-${nnnn}`;
}

const DOCUMENT_TYPE_PREFIX: Record<DocumentType, string> = {
  OFFER: 'OFR',
  PROPOSAL: 'PRP',
  WAREHOUSE: 'WHS',
  BRIEF: 'BRF',
};

// Format: {OFR|PRP|WHS|BRF}-{YY}-{NNNN}-v{V}  e.g. OFR-26-0016-v3
export function buildDocumentNumber(params: {
  documentType: DocumentType;
  orderNumber: number;
  orderYear: number;
  version: number;
}): string {
  const { documentType, orderNumber, orderYear, version } = params;
  const yy = String(orderYear % 100).padStart(2, '0');
  const nnnn = String(orderNumber).padStart(4, '0');
  const prefix = DOCUMENT_TYPE_PREFIX[documentType];
  return `${prefix}-${yy}-${nnnn}-v${version}`;
}
