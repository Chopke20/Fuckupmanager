"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateOrderNetValue = calculateOrderNetValue;
exports.formatOrderNetValue = formatOrderNetValue;
/**
 * Oblicza wartość netto po pozycyjnych rabatach i globalnym rabacie.
 * Zgodna z logiką w OrdersPage.tsx i OverviewPage.
 *
 * @param order - zlecenie z listą pozycji
 * @returns wartość netto (po rabatach)
 */
function calculateOrderNetValue(order) {
    const equipmentValue = (order.equipmentItems || []).reduce((sum, item) => {
        const base = (item.unitPrice || 0) * (item.quantity || 1);
        // Reguła wielodniowa: pierwszy dzień pełna cena, każdy kolejny 50% ceny
        const multiDay = (item.days || 1) > 1 ? base + ((item.days || 1) - 1) * base * 0.5 : base;
        return sum + multiDay * (1 - (item.discount || 0) / 100);
    }, 0);
    const productionValue = (order.productionItems || []).reduce((sum, item) => {
        const base = (item.rateValue || 0) * (item.units || 1);
        return sum + base * (1 - (item.discount || 0) / 100);
    }, 0);
    const revenueNet = equipmentValue + productionValue;
    const discountAmount = revenueNet * (order.discountGlobal || 0) / 100;
    return revenueNet - discountAmount;
}
/**
 * Formatuje wartość netto do wyświetlenia z walutą.
 * @param order - zlecenie
 * @returns sformatowana wartość np. "12 345 PLN"
 */
function formatOrderNetValue(order) {
    return calculateOrderNetValue(order).toLocaleString('pl') + ' PLN';
}
