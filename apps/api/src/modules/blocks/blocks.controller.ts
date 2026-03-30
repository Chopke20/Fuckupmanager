import { Request, Response } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../prisma/client'
import { z } from 'zod'

const createBlockSchema = z.object({
  equipmentId: z.string().uuid(),
  quantity: z.number().int().positive(),
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
  note: z.string().optional(),
});

const updateBlockSchema = createBlockSchema.partial();

export const getBlocks = async (req: Request, res: Response) => {
  try {
    const { equipmentId, dateFrom, dateTo } = req.query;

    const where: Prisma.EquipmentBlockWhereInput = {}
    if (equipmentId) where.equipmentId = String(equipmentId)
    if (dateFrom || dateTo) {
      const and: Prisma.EquipmentBlockWhereInput[] = []
      if (dateFrom) and.push({ dateFrom: { gte: new Date(dateFrom as string) } })
      if (dateTo) and.push({ dateTo: { lte: new Date(dateTo as string) } })
      where.AND = and
    }

    const blocks = await prisma.equipmentBlock.findMany({
      where,
      include: {
        equipment: {
          select: {
            id: true,
            name: true,
            internalCode: true,
          },
        },
      },
      orderBy: { dateFrom: 'asc' },
    });

    res.json(blocks);
  } catch (error) {
    console.error('Error fetching blocks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createBlock = async (req: Request, res: Response) => {
  try {
    const validatedData = createBlockSchema.parse(req.body);

    const equipment = await prisma.equipment.findUnique({
      where: { id: validatedData.equipmentId },
    });

    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    const block = await prisma.equipmentBlock.create({
      data: {
        ...validatedData,
        dateFrom: new Date(validatedData.dateFrom),
        dateTo: new Date(validatedData.dateTo),
      },
      include: {
        equipment: {
          select: {
            id: true,
            name: true,
            internalCode: true,
          },
        },
      },
    });

    res.status(201).json(block);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error creating block:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateBlock = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = updateBlockSchema.parse(req.body);

    const block = await prisma.equipmentBlock.findUnique({
      where: { id },
    });

    if (!block) {
      return res.status(404).json({ error: 'Block not found' });
    }

    const { dateFrom: df, dateTo: dt, ...rest } = validatedData
    const updatedData: Prisma.EquipmentBlockUpdateInput = {
      ...rest,
      ...(df !== undefined ? { dateFrom: new Date(df) } : {}),
      ...(dt !== undefined ? { dateTo: new Date(dt) } : {}),
    }

    const updatedBlock = await prisma.equipmentBlock.update({
      where: { id },
      data: updatedData,
      include: {
        equipment: {
          select: {
            id: true,
            name: true,
            internalCode: true,
          },
        },
      },
    });

    res.json(updatedBlock);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error updating block:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteBlock = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const block = await prisma.equipmentBlock.findUnique({
      where: { id },
    });

    if (!block) {
      return res.status(404).json({ error: 'Block not found' });
    }

    await prisma.equipmentBlock.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting block:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getEquipmentAvailability = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'Missing from or to parameters' });
    }

    const fromStr = from as string;
    const toStr = to as string;
    const dateFrom = new Date(fromStr);
    const dateTo = new Date(toStr);

    const equipment = await prisma.equipment.findUnique({
      where: { id },
    });

    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    const reservations = await prisma.equipmentReservation.findMany({
      where: {
        equipmentId: id,
        date: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
    });

    const blocks = await prisma.equipmentBlock.findMany({
      where: {
        equipmentId: id,
        OR: [
          { dateFrom: { lte: dateTo }, dateTo: { gte: dateFrom } },
        ],
      },
    });

    const reservedByDay = new Map<string, number>();
    reservations.forEach(r => {
      const dateKey = r.date.toISOString().split('T')[0] as string;
      reservedByDay.set(dateKey, (reservedByDay.get(dateKey) || 0) + r.quantity);
    });

    blocks.forEach(block => {
      const start = new Date(block.dateFrom);
      const end = new Date(block.dateTo);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().split('T')[0] as string;
        reservedByDay.set(dateKey, (reservedByDay.get(dateKey) || 0) + block.quantity);
      }
    });

    const availability = Array.from(reservedByDay.entries()).map(([date, reserved]) => ({
      date,
      reserved,
      available: Math.max(0, equipment.stockQuantity - reserved),
      stockQuantity: equipment.stockQuantity,
    }));

    res.json({
      equipmentId: id,
      equipmentName: equipment.name,
      stockQuantity: equipment.stockQuantity,
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString(),
      availability,
      summary: {
        maxReserved: Math.max(...availability.map(a => a.reserved), 0),
        minAvailable: Math.min(...availability.map(a => a.available), equipment.stockQuantity),
      },
    });
  } catch (error) {
    console.error('Error calculating availability:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
