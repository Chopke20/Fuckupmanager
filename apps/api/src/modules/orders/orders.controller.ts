import { Request, Response, NextFunction } from 'express';
import { CreateOrderSchema, UpdateOrderSchema } from '@lama-stage/shared-types';
import { ordersService } from './orders.service';
import { AppError, EquipmentUnavailableError } from '../../shared/errors/AppError';
import { calculateEquipmentAvailability } from './equipment-availability.service';

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