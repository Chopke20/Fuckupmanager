import { Request, Response, NextFunction } from 'express';
import { CreateOrderSchema, UpdateOrderSchema } from '@lama-stage/shared-types';
import { ordersService } from './orders.service';
import { AppError, EquipmentUnavailableError } from '../../shared/errors/AppError';
import { calculateEquipmentAvailability } from './equipment-availability.service';
import { prisma } from '../../prisma/client';

export const getAllOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = req.query.page != null ? Number(req.query.page) : 1;
    const limit = req.query.limit != null ? Number(req.query.limit) : 10;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const deletedOnly = req.query.deletedOnly === 'true' || req.query.deletedOnly === '1';
    const includeDeleted = req.query.includeDeleted === 'true' || req.query.includeDeleted === '1';
    const result = await ordersService.getAllOrders({ page, limit, status, search, deletedOnly, includeDeleted });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getOrderById = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  if (!id) return next(new AppError('Missing ID', 400));
  
  ordersService.getOrderById(id)
    .then(order => {
      if (!order) {
        return res.status(404).json({ error: { message: 'Zlecenie nie zostało znalezione', code: 'NOT_FOUND' } });
      }
      res.json({ data: order });
    })
    .catch(next);
};

export const createOrder = (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = CreateOrderSchema.parse(req.body);
    ordersService.createOrder(validatedData)
      .then(order => res.status(201).json({ success: true, data: order }))
      .catch((error: unknown) => {
        if (error instanceof EquipmentUnavailableError) {
          return res.status(409).json({
            success: false,
            message: error.message,
            code: error.code,
            details: error.details,
          });
        }
        next(error);
      });
  } catch (error) {
    next(error);
  }
};

export const duplicateOrder = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  if (!id) return next(new AppError('Missing ID', 400));

  ordersService.duplicateOrder(id)
    .then(order => res.status(201).json({ success: true, data: order }))
    .catch((error: unknown) => {
      if (error instanceof Error && error.message === 'ORDER_NOT_FOUND') {
        return res.status(404).json({ error: { message: 'Zlecenie nie zostało znalezione', code: 'NOT_FOUND' } });
      }
      next(error);
    });
};

export const updateOrder = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!id) return next(new AppError('Missing ID', 400));
    const validatedData = UpdateOrderSchema.parse(req.body);
    
    ordersService.updateOrder(id, validatedData)
      .then(order => res.json({ success: true, data: order }))
      .catch((error: unknown) => {
        if (error instanceof EquipmentUnavailableError) {
          return res.status(409).json({
            success: false,
            message: error.message,
            code: error.code,
            details: error.details,
          });
        }
        next(error);
      });
  } catch (error) {
    next(error);
  }
};

export const deleteOrder = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  if (!id) return next(new AppError('Missing ID', 400));
  
  ordersService.deleteOrder(id)
    .then(() => res.json({ success: true, message: 'Zlecenie przeniesiono do kosza' }))
    .catch(next);
};

export const restoreOrder = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  if (!id) return next(new AppError('Missing ID', 400));

  ordersService.restoreOrder(id)
    .then(() => res.json({ success: true, message: 'Zlecenie przywrócone z kosza' }))
    .catch(next);
};

export const deleteOrderPermanent = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  if (!id) return next(new AppError('Missing ID', 400));

  ordersService.deleteOrderPermanent(id)
    .then(() => res.json({ success: true, message: 'Zlecenie usunięte na stałe' }))
    .catch(next);
};

export const checkEquipmentAvailability = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { equipmentIds, dateFrom, dateTo, excludeOrderId, excludeBlockId, requests } = req.body;

    if (!equipmentIds || !Array.isArray(equipmentIds) || equipmentIds.length === 0) {
      throw new AppError('equipmentIds jest wymagane i musi być tablicą', 400);
    }

    if (!dateFrom || !dateTo) {
      throw new AppError('dateFrom i dateTo są wymagane', 400);
    }

    const availability = await calculateEquipmentAvailability({
      equipmentIds,
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
      excludeOrderId,
      excludeBlockIds: excludeBlockId ? [excludeBlockId] : undefined,
      requests: Array.isArray(requests) ? requests : undefined,
    });

    res.json({
      success: true,
      data: availability,
    });
  } catch (error) {
    next(error);
  }
};

export const getOrderConflicts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Legacy method - now uses checkEquipmentAvailability
    const { id } = req.params;
    if (!id) throw new AppError('Missing ID', 400);

    const order = await ordersService.getOrderById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Zlecenie nie zostało znalezione' });
    }

    const equipmentIds = order.equipmentItems
      .filter((item) => item.equipmentId)
      .map((item) => item.equipmentId as string);

    if (equipmentIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const availability = await ordersService.checkEquipmentAvailability(
      equipmentIds,
      order.dateFrom,
      order.dateTo,
      id
    );

    const conflicts = availability.filter((item) => !item.isAvailable);

    res.json({
      success: true,
      data: conflicts,
    });
  } catch (error) {
    next(error);
  }
};

const ACTIVE_ORDER_STATUSES = new Set(['OFFER_SENT', 'CONFIRMED', 'COMPLETED']);
const CANCELLED_ORDER_STATUSES = new Set(['CANCELLED', 'ARCHIVED']);

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

export const getOverviewConflicts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const daysAheadRaw = Number(req.query.daysAhead ?? 45);
    const daysAhead = Number.isFinite(daysAheadRaw) ? Math.max(1, Math.min(120, Math.floor(daysAheadRaw))) : 45;
    const from = startOfToday();
    const to = endOfDay(new Date(from.getTime() + daysAhead * 24 * 60 * 60 * 1000));

    const [orders, blocks] = await Promise.all([
      prisma.order.findMany({
        where: {
          isDeleted: false,
          status: { notIn: ['CANCELLED', 'ARCHIVED'] },
          dateFrom: { lte: to },
          dateTo: { gte: from },
          equipmentItems: {
            some: {
              equipmentId: { not: null },
            },
          },
        },
        select: {
          id: true,
          name: true,
          status: true,
          dateFrom: true,
          dateTo: true,
          equipmentItems: {
            where: { equipmentId: { not: null } },
            select: {
              equipmentId: true,
              quantity: true,
              dateFrom: true,
              dateTo: true,
              equipment: { select: { id: true, name: true, stockQuantity: true } },
            },
          },
        },
      }),
      prisma.equipmentBlock.findMany({
        where: {
          dateFrom: { lte: to },
          dateTo: { gte: from },
        },
        select: {
          id: true,
          equipmentId: true,
          quantity: true,
          dateFrom: true,
          dateTo: true,
          equipment: { select: { id: true, name: true, stockQuantity: true } },
        },
      }),
    ]);

    type ConflictCell = {
      key: string;
      date: string;
      equipmentId: string;
      equipmentName: string;
      stockQuantity: number;
      reservedQuantity: number;
      orderIds: Set<string>;
      orderNames: Set<string>;
      hasBlock: boolean;
    };

    const cells = new Map<string, ConflictCell>();
    const getCell = (equipmentId: string, equipmentName: string, stockQuantity: number, dateIso: string): ConflictCell => {
      const key = `${equipmentId}:${dateIso}`;
      const existing = cells.get(key);
      if (existing) return existing;
      const created: ConflictCell = {
        key,
        date: dateIso,
        equipmentId,
        equipmentName,
        stockQuantity,
        reservedQuantity: 0,
        orderIds: new Set(),
        orderNames: new Set(),
        hasBlock: false,
      };
      cells.set(key, created);
      return created;
    };

    for (const order of orders) {
      if (CANCELLED_ORDER_STATUSES.has(order.status)) continue;
      for (const item of order.equipmentItems) {
        const eq = item.equipment;
        if (!eq || !item.equipmentId) continue;
        const itemFrom = item.dateFrom ?? order.dateFrom;
        const itemTo = item.dateTo ?? order.dateTo;
        const overlapFrom = itemFrom > from ? itemFrom : from;
        const overlapTo = itemTo < to ? itemTo : to;
        if (overlapFrom > overlapTo) continue;
        const qty = Math.max(1, Math.floor(item.quantity ?? 1));
        for (let d = new Date(overlapFrom); d <= overlapTo; d.setDate(d.getDate() + 1)) {
          const dateIso = d.toISOString().slice(0, 10);
          const cell = getCell(eq.id, eq.name, eq.stockQuantity ?? 0, dateIso);
          cell.reservedQuantity += qty;
          cell.orderIds.add(order.id);
          cell.orderNames.add(order.name);
        }
      }
    }

    for (const block of blocks) {
      const eq = block.equipment;
      if (!eq) continue;
      const blockStart = new Date(Math.max(block.dateFrom.getTime(), from.getTime()));
      const blockEnd = new Date(Math.min(block.dateTo.getTime(), to.getTime()));
      for (let d = new Date(blockStart); d <= blockEnd; d.setDate(d.getDate() + 1)) {
        const dateIso = d.toISOString().slice(0, 10);
        const cell = getCell(eq.id, eq.name, eq.stockQuantity ?? 0, dateIso);
        cell.reservedQuantity += Math.max(1, Math.floor(block.quantity ?? 1));
        cell.hasBlock = true;
      }
    }

    const conflicts = Array.from(cells.values())
      .filter((c) => c.reservedQuantity > c.stockQuantity)
      .map((c) => {
        const exceededBy = c.reservedQuantity - c.stockQuantity;
        const severity = exceededBy >= 2 ? 'high' : 'medium';
        const cause =
          c.orderNames.size > 1
            ? 'ten sam sprzęt występuje równolegle w kilku zleceniach'
            : 'zarezerwowano większą ilość niż dostępny stan';
        return {
          id: c.key,
          description: `${c.equipmentName}: ${cause} (${c.reservedQuantity}/${c.stockQuantity}).`,
          severity,
          equipmentName: c.equipmentName,
          orderIds: Array.from(c.orderIds),
          date: c.date,
          reservedQuantity: c.reservedQuantity,
          stockQuantity: c.stockQuantity,
          exceededBy,
          hasBlock: c.hasBlock,
        };
      })
      .sort((a, b) => (a.date === b.date ? b.exceededBy - a.exceededBy : a.date.localeCompare(b.date)));

    res.json({ data: conflicts });
  } catch (error) {
    next(error);
  }
};

export const getOverviewPendingExternal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const daysAheadRaw = Number(req.query.daysAhead ?? 7);
    const daysAhead = Number.isFinite(daysAheadRaw) ? Math.max(1, Math.min(60, Math.floor(daysAheadRaw))) : 7;
    const hardHoursRaw = Number(req.query.hardHours ?? 72);
    const hardHours = Number.isFinite(hardHoursRaw) ? Math.max(1, Math.min(240, Math.floor(hardHoursRaw))) : 72;
    const now = new Date();
    const horizon = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const orders = await prisma.order.findMany({
      where: {
        isDeleted: false,
        status: { in: Array.from(ACTIVE_ORDER_STATUSES) },
        dateFrom: { lte: horizon },
      },
      select: {
        id: true,
        name: true,
        status: true,
        dateFrom: true,
        stages: { select: { id: true, date: true } },
        equipmentItems: {
          where: {
            isRental: true,
            externalConfirmationStatus: { notIn: ['NOT_REQUIRED', 'CONFIRMED'] },
          },
          select: {
            id: true,
            name: true,
            dateFrom: true,
            externalConfirmationStatus: true,
          },
        },
        productionItems: {
          where: {
            isSubcontractor: true,
            externalConfirmationStatus: { notIn: ['NOT_REQUIRED', 'CONFIRMED'] },
          },
          select: {
            id: true,
            name: true,
            stageIds: true,
            externalConfirmationStatus: true,
          },
        },
      },
      orderBy: { dateFrom: 'asc' },
    });

    const pending: Array<{
      id: string;
      description: string;
      severity: 'high' | 'medium' | 'low';
      kind: 'subcontractor' | 'rental';
      orderId: string;
      orderName: string;
      label: string;
      date: string;
    }> = [];

    for (const order of orders) {
      for (const item of order.equipmentItems) {
        const eventDate = item.dateFrom ?? order.dateFrom;
        const hoursToEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursToEvent < 0 || eventDate > horizon) continue;
        const isHard = item.externalConfirmationStatus === 'DECLINED' || hoursToEvent <= hardHours;
        pending.push({
          id: `rental:${item.id}`,
          description: isHard
            ? 'Wynajem bez potwierdzenia (hard alert).'
            : 'Wynajem oczekuje na potwierdzenie.',
          severity: isHard ? 'high' : 'medium',
          kind: 'rental',
          orderId: order.id,
          orderName: order.name,
          label: item.name,
          date: eventDate.toISOString().slice(0, 10),
        });
      }

      for (const item of order.productionItems) {
        let eventDate = order.dateFrom;
        if (item.stageIds) {
          try {
            const ids = JSON.parse(item.stageIds) as unknown;
            if (Array.isArray(ids)) {
              const stageDates = order.stages
                .filter((s) => ids.includes(s.id))
                .map((s) => s.date)
                .sort((a, b) => a.getTime() - b.getTime());
              if (stageDates[0]) eventDate = stageDates[0];
            }
          } catch {
            // no-op
          }
        }
        const hoursToEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursToEvent < 0 || eventDate > horizon) continue;
        const isHard = item.externalConfirmationStatus === 'DECLINED' || hoursToEvent <= hardHours;
        pending.push({
          id: `subcontractor:${item.id}`,
          description: isHard
            ? 'Podwykonawca bez potwierdzenia (hard alert).'
            : 'Podwykonawca oczekuje na potwierdzenie.',
          severity: isHard ? 'high' : 'medium',
          kind: 'subcontractor',
          orderId: order.id,
          orderName: order.name,
          label: item.name,
          date: eventDate.toISOString().slice(0, 10),
        });
      }
    }

    pending.sort((a, b) => {
      if (a.date === b.date) {
        if (a.severity === b.severity) return a.orderName.localeCompare(b.orderName);
        return a.severity === 'high' ? -1 : 1;
      }
      return a.date.localeCompare(b.date);
    });

    res.json({ data: pending });
  } catch (error) {
    next(error);
  }
};