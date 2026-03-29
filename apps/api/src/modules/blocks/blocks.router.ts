import { Router } from 'express';
import {
  getBlocks,
  createBlock,
  updateBlock,
  deleteBlock,
  getEquipmentAvailability,
} from './blocks.controller';
import { validate } from '../../shared/middleware/validate.middleware';
import { z } from 'zod';

const router = Router();

// Schemat body (płaski obiekt) – walidacja req.body bezpośrednio
const createBlockBodySchema = z.object({
  equipmentId: z.string().uuid(),
  quantity: z.number().int().positive(),
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
  note: z.string().optional(),
});

const updateBlockBodySchema = createBlockBodySchema.partial();

// GET /api/blocks
router.get('/', getBlocks);

// POST /api/blocks
router.post('/', validate(createBlockBodySchema), createBlock);

// PUT /api/blocks/:id
router.put('/:id', validate(updateBlockBodySchema), updateBlock);

// DELETE /api/blocks/:id
router.delete('/:id', deleteBlock);

// GET /api/equipment/:id/availability
router.get('/equipment/:id/availability', getEquipmentAvailability);

export default router;