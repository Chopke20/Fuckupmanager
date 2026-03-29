import { z } from 'zod';

export const TransportPricingRangeSchema = z
  .object({
    fromKm: z.number().nonnegative(),
    toKm: z.number().positive(),
    flatNet: z.number().nonnegative(),
  })
  .refine((row) => row.toKm > row.fromKm, {
    message: 'Pole "do km" musi być większe od "od km".',
    path: ['toKm'],
  });

export const TransportPricingSettingsSchema = z.object({
  ranges: z.array(TransportPricingRangeSchema).min(1),
  longDistancePerKm: z.number().positive(),
  updatedAt: z.string().datetime().optional(),
});

export const UpdateTransportPricingSettingsSchema = TransportPricingSettingsSchema.omit({
  updatedAt: true,
}).superRefine((data, ctx) => {
  const ranges = [...data.ranges].sort((a, b) => a.fromKm - b.fromKm);

  if (ranges[0] && ranges[0].fromKm !== 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Pierwszy przedział musi zaczynać się od 0 km.',
      path: ['ranges', 0, 'fromKm'],
    });
  }

  for (let i = 0; i < ranges.length; i += 1) {
    const current = ranges[i];
    const next = ranges[i + 1];
    if (!current || !next) break;

    if (current.toKm !== next.fromKm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Przedziały muszą być ciągłe (kolejny "od km" musi równać się poprzedniemu "do km").',
        path: ['ranges', i + 1, 'fromKm'],
      });
    }
  }
});

export type TransportPricingSettings = z.infer<typeof TransportPricingSettingsSchema>;
export type UpdateTransportPricingSettingsDto = z.infer<typeof UpdateTransportPricingSettingsSchema>;

