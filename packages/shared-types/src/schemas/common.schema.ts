import { z } from 'zod';

export const PaginationMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  lastPage: z.number().int().positive(),
});

export const IdSchema = z.string().uuid();

export const DateRangeSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(20),
});

export const SearchSchema = z.object({
  search: z.string().optional(),
});


export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.object({
      data: z.array(itemSchema),
      meta: PaginationMetaSchema,
    })
  });
