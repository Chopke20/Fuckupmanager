/**
 * Parked offer → Excel export (formulas, totals, same positions as PDF).
 *
 * Hidden from the offer document UI. Backend is kept:
 *   POST /api/pdf/offer/:orderId/excel
 *   POST /api/pdf/offer/export/:exportId/excel
 * Flip to `true` to show the buttons again — no other work needed.
 */
export const OFFER_EXCEL_EXPORT_VISIBLE = false
