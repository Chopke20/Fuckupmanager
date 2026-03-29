"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateTransportPricingSettingsSchema = exports.TransportPricingSettingsSchema = exports.TransportPricingRangeSchema = void 0;
const zod_1 = require("zod");
exports.TransportPricingRangeSchema = zod_1.z
    .object({
    fromKm: zod_1.z.number().nonnegative(),
    toKm: zod_1.z.number().positive(),
    flatNet: zod_1.z.number().nonnegative(),
})
    .refine((row) => row.toKm > row.fromKm, {
    message: 'Pole "do km" musi być większe od "od km".',
    path: ['toKm'],
});
exports.TransportPricingSettingsSchema = zod_1.z.object({
    ranges: zod_1.z.array(exports.TransportPricingRangeSchema).min(1),
    longDistancePerKm: zod_1.z.number().positive(),
    updatedAt: zod_1.z.string().datetime().optional(),
});
exports.UpdateTransportPricingSettingsSchema = exports.TransportPricingSettingsSchema.omit({
    updatedAt: true,
}).superRefine((data, ctx) => {
    const ranges = [...data.ranges].sort((a, b) => a.fromKm - b.fromKm);
    if (ranges[0] && ranges[0].fromKm !== 0) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Pierwszy przedział musi zaczynać się od 0 km.',
            path: ['ranges', 0, 'fromKm'],
        });
    }
    for (let i = 0; i < ranges.length; i += 1) {
        const current = ranges[i];
        const next = ranges[i + 1];
        if (!current || !next)
            break;
        if (current.toKm !== next.fromKm) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'Przedziały muszą być ciągłe (kolejny "od km" musi równać się poprzedniemu "do km").',
                path: ['ranges', i + 1, 'fromKm'],
            });
        }
    }
});
