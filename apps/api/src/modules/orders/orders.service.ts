import { Prisma } from '@prisma/client'
import { CreateOrderSchema, UpdateOrderSchema, CreateOrderEquipmentItemSchema, CreateOrderStageSchema, CreateOrderProductionItemSchema } from '@lama-stage/shared-types'
import { z } from 'zod'
import { EquipmentUnavailableError } from '../../shared/errors/AppError'

import { prisma } from '../../prisma/client'

const orderDetailInclude = {
  client: true,
  equipmentItems: {
    include: {
      equipment: true,
    },
  },
  productionItems: true,
  stages: true,
} as const satisfies Prisma.OrderInclude

export type OrderDetail = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>

export interface EquipmentAvailability {
  equipmentId: string;
  equipmentName: string;
  isAvailable: boolean;
  conflictingOrders: {
    orderId: string;
    orderName: string;
    dateFrom: Date;
    dateTo: Date;
  }[];
}

export class OrdersService {
  private normalizeOrderDates<T extends { dateFrom?: Date | string | null; dateTo?: Date | string | null; startDate?: Date | string | null; endDate?: Date | string | null }>(order: T): T {
    return {
      ...order,
      startDate: order.dateFrom ?? order.startDate ?? null,
      endDate: order.dateTo ?? order.endDate ?? null,
    } as T
  }

  async getAllOrders(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    deletedOnly?: boolean;
    includeDeleted?: boolean;
  }) {
    const pageInput = Number(params?.page)
    const limitInput = Number(params?.limit)
    const page = Number.isFinite(pageInput) && pageInput > 0 ? Math.floor(pageInput) : 1
    const limit = Number.isFinite(limitInput) && limitInput > 0
      ? Math.min(500, Math.floor(limitInput))
      : 10
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {};
    if (params?.deletedOnly) {
      where.isDeleted = true;
    } else if (!params?.includeDeleted) {
      where.isDeleted = false;
    }
    if (params?.status && params.status !== 'all') {
      where.status = params.status;
    }
    if (params?.search?.trim()) {
      const term = params.search.trim();
      where.OR = [
        { name: { contains: term } },
        { venue: { contains: term } },
        { client: { companyName: { contains: term } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dateFrom: 'desc' },
        include: {
          client: true,
          equipmentItems: {
            include: {
              equipment: true,
            },
          },
          productionItems: true,
          stages: true,
        },
      }),
      prisma.order.count({ where }),
    ]);

    const lastPage = Math.ceil(total / limit) || 1;
    return { data: orders.map((o) => this.normalizeOrderDates(o)), meta: { total, page, lastPage } };
  }

  async getOrderById(id: string): Promise<OrderDetail | null> {
    const order = await prisma.order.findFirst({
      where: { id, isDeleted: false },
      include: orderDetailInclude,
    })
    if (!order) return null
    const normalized = this.normalizeOrderDates(order) as OrderDetail
    if (Array.isArray(normalized.productionItems)) {
      normalized.productionItems = normalized.productionItems.map((p) => ({
        ...p,
        rateValue: Number(p.rateValue),
        units: Number(p.units),
      }))
    }
    return normalized
  }

  /**
   * Check equipment availability for given dates
   * Returns list of equipment with their availability status
   */
  async checkEquipmentAvailability(
    equipmentIds: string[],
    dateFrom: Date,
    dateTo: Date,
    excludeOrderId?: string
  ): Promise<EquipmentAvailability[]> {
    const results: EquipmentAvailability[] = [];

    // Get equipment details
    const equipment = await prisma.equipment.findMany({
      where: { id: { in: equipmentIds } },
    });

    for (const eq of equipment) {
      // Find conflicting orders with confirmed status that overlap with requested dates
      const conflictingOrders = await prisma.order.findMany({
        where: {
          id: excludeOrderId ? { not: excludeOrderId } : undefined,
          isDeleted: false,
          status: { notIn: ['CANCELLED', 'ARCHIVED'] },
          // Check for date overlap: (existingStart <= requestedEnd) AND (existingEnd >= requestedStart)
          dateFrom: { lte: dateTo },
          dateTo: { gte: dateFrom },
          equipmentItems: {
            some: {
              equipmentId: eq.id,
              // Check if equipment item has dates that overlap
              OR: [
                // Equipment item uses order dates (no specific dates set)
                { dateFrom: null, dateTo: null },
                // Equipment item has specific dates that overlap
                {
                  dateFrom: { lte: dateTo, not: null },
                  dateTo: { gte: dateFrom, not: null },
                },
              ],
            },
          },
        },
        select: {
          id: true,
          name: true,
          dateFrom: true,
          dateTo: true,
        },
      });

      results.push({
        equipmentId: eq.id,
        equipmentName: eq.name,
        isAvailable: conflictingOrders.length === 0,
        conflictingOrders: conflictingOrders.map((order) => ({
          orderId: order.id,
          orderName: order.name,
          dateFrom: order.dateFrom,
          dateTo: order.dateTo,
        })),
      });
    }

    return results;
  }

  /**
   * Validate that all equipment items in an order are available
   * Throws error if any equipment is not available
   */
  async validateEquipmentAvailability(
    equipmentItems: Array<{ equipmentId?: string | null; dateFrom?: Date | string | null; dateTo?: Date | string | null }>,
    orderId?: string
  ): Promise<void> {
    const itemsWithEquipment = equipmentItems.filter((item) => item.equipmentId);

    if (itemsWithEquipment.length === 0) {
      return;
    }

    const equipmentIds = itemsWithEquipment.map((item) => item.equipmentId as string);
    const requestDateFrom = itemsWithEquipment[0]?.dateFrom || new Date();
    const requestDateTo = itemsWithEquipment[0]?.dateTo || new Date();

    const availability = await this.checkEquipmentAvailability(
      equipmentIds,
      requestDateFrom as Date,
      requestDateTo as Date,
      orderId
    );

    const unavailableItems = availability.filter((item) => !item.isAvailable);

    if (unavailableItems.length > 0) {
      const errorDetails = unavailableItems
        .map((item) =>
          item.conflictingOrders.length > 0
            ? `${item.equipmentName} - zarezerwowany w: ${item.conflictingOrders.map((o) => o.orderName).join(', ')}`
            : `${item.equipmentName} - niedostępny`
        )
        .join('; ');

      throw new EquipmentUnavailableError(`Niektóry sprzęt jest niedostępny: ${errorDetails}`, unavailableItems)
    }
  }

  /** Rok w strefie Europe/Warsaw do numeracji zleceń */
  private getOrderYear(): number {
    const now = new Date();
    try {
      const str = now.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });
      const year = new Date(str).getFullYear();
      return Number.isFinite(year) ? year : now.getFullYear();
    } catch {
      return now.getFullYear();
    }
  }

  async createOrder(orderData: z.infer<typeof CreateOrderSchema>) {
    const { clientId, equipmentItems, parentOrderId, startDate, endDate, stages, productionItems, offerValidityDays, projectContactKey, currency, exchangeRateEur, ...rest } = orderData;
    const defaultStageDate = startDate ? new Date(startDate) : new Date();

    const data: Prisma.OrderUncheckedCreateInput = {
      ...rest,
      dateFrom: startDate,
      dateTo: endDate,
      startDate,
      endDate,
      clientId: clientId,
      parentOrderId: parentOrderId === undefined ? null : parentOrderId,
      offerValidityDays: offerValidityDays ?? 14,
      projectContactKey: projectContactKey ?? null,
      currency: currency ?? 'PLN',
      exchangeRateEur: exchangeRateEur ?? null,
      equipmentItems: {
        create: equipmentItems ? equipmentItems.map((item: z.infer<typeof CreateOrderEquipmentItemSchema>) => ({
          name: item.name,
          description: item.description ?? null,
          category: item.category ?? 'Inne',
          quantity: item.quantity ?? 1,
          unitPrice: item.unitPrice ?? 0,
          days: item.days ?? 1,
          discount: item.discount ?? 0,
          pricingRule: item.pricingRule ? JSON.stringify(item.pricingRule) : null,
          visibleInOffer: item.visibleInOffer ?? true,
          isRental: item.isRental ?? false,
          sortOrder: item.sortOrder ?? 0,
          dateFrom: item.dateFrom ? new Date(item.dateFrom) : startDate,
          dateTo: item.dateTo ? new Date(item.dateTo) : endDate,
          equipmentId: item.equipmentId ?? null,
        })) : [],
      },
      productionItems: {
        create: productionItems ? productionItems.map((item: z.infer<typeof CreateOrderProductionItemSchema>, idx: number) => ({
          name: item.name,
          description: item.description ?? null,
          rateType: item.rateType ?? 'FLAT',
          rateValue: item.rateValue ?? 0,
          units: item.units ?? 1,
          discount: item.discount ?? 0,
          stageIds: item.stageIds ?? null,
          isTransport: item.isTransport ?? false,
          isAutoCalculated: item.isAutoCalculated ?? true,
          isSubcontractor: item.isSubcontractor ?? false,
          visibleInOffer: item.visibleInOffer ?? true,
          sortOrder: item.sortOrder ?? idx,
        })) : [],
      },
    };

    const orderYear = this.getOrderYear();

    const created = await prisma.$transaction(async (tx) => {
      const seq = await tx.orderYearSequence.upsert({
        where: { year: orderYear },
        create: { year: orderYear, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
      });
      const orderNumber = seq.lastNumber;
      const order = await tx.order.create({
        data: {
          ...data,
          orderYear,
          orderNumber,
        },
      });
      const stageRows = Array.isArray(stages) ? stages : []
      if (stageRows.length > 0) {
        await tx.orderStage.createMany({
          data: stageRows.map((s: z.infer<typeof CreateOrderStageSchema>, idx: number) => ({
            orderId: order.id,
            type: s.type ?? 'CUSTOM',
            label: s.label ?? null,
            date: s.date ? new Date(s.date) : defaultStageDate,
            timeStart: s.timeStart ?? null,
            timeEnd: s.timeEnd ?? null,
            notes: s.notes ?? null,
            sortOrder: s.sortOrder ?? idx,
          })),
        })
      }
      return order
    })
    return this.normalizeOrderDates(created)
  }

  async updateOrder(id: string, orderData: z.infer<typeof UpdateOrderSchema>) {
    const { clientId, equipmentItems, parentOrderId, startDate, endDate, stages: stagesInput, productionItems: productionItemsInput, ...rest } = orderData;
    const stages = Array.isArray(stagesInput) ? stagesInput : [];
    const productionItems = Array.isArray(productionItemsInput) ? productionItemsInput : [];
    const defaultStageDate = startDate ?? new Date();

    type StagePayload = z.infer<typeof CreateOrderStageSchema> & { id?: string };
    type ProductionItemPayload = z.infer<typeof CreateOrderProductionItemSchema> & { id?: string };

    const data: Prisma.OrderUncheckedUpdateInput = {
      ...rest,
      dateFrom: startDate,
      dateTo: endDate,
      startDate,
      endDate,
      clientId: clientId,
      parentOrderId: parentOrderId === undefined ? null : parentOrderId,
      ...(equipmentItems !== undefined
        ? {
            equipmentItems: {
              deleteMany: {},
              create: equipmentItems.map((item: z.infer<typeof CreateOrderEquipmentItemSchema>) => ({
                name: item.name,
                description: item.description ?? null,
                category: item.category ?? 'Inne',
                quantity: item.quantity ?? 1,
                unitPrice: item.unitPrice ?? 0,
                days: item.days ?? 1,
                discount: item.discount ?? 0,
                pricingRule: item.pricingRule ? JSON.stringify(item.pricingRule) : null,
                visibleInOffer: item.visibleInOffer ?? true,
                isRental: item.isRental ?? false,
                sortOrder: item.sortOrder ?? 0,
                dateFrom: item.dateFrom ? new Date(item.dateFrom) : startDate,
                dateTo: item.dateTo ? new Date(item.dateTo) : endDate,
                equipmentId: item.equipmentId ?? null,
              })),
            },
          }
        : {}),
      // productionItems i stages – aktualizacja w miejscu w transakcji poniżej (nie przez data)
    };

    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.order.update({ where: { id }, data });

      if (stagesInput !== undefined) {
        const currentStages = await tx.orderStage.findMany({ where: { orderId: id }, orderBy: { sortOrder: 'asc' } });
        const currentStageIds = new Set(currentStages.map((s) => s.id));
        const payloadStageIds = new Set(stages.map((s: StagePayload) => s.id).filter(Boolean) as string[]);

        for (const stage of stages as StagePayload[]) {
          if (stage.id && currentStageIds.has(stage.id)) {
            await tx.orderStage.update({
              where: { id: stage.id },
              data: {
                type: stage.type ?? 'CUSTOM',
                label: stage.label ?? null,
                date: stage.date ? new Date(stage.date) : defaultStageDate,
                timeStart: stage.timeStart ?? null,
                timeEnd: stage.timeEnd ?? null,
                notes: stage.notes ?? null,
                sortOrder: stage.sortOrder ?? 0,
              },
            });
          } else {
            await tx.orderStage.create({
              data: {
                orderId: id,
                type: stage.type ?? 'CUSTOM',
                label: stage.label ?? null,
                date: stage.date ? new Date(stage.date) : defaultStageDate,
                timeStart: stage.timeStart ?? null,
                timeEnd: stage.timeEnd ?? null,
                notes: stage.notes ?? null,
                sortOrder: stage.sortOrder ?? 0,
              },
            });
          }
        }
        for (const old of currentStages) {
          if (!payloadStageIds.has(old.id)) {
            await tx.orderStage.delete({ where: { id: old.id } });
          }
        }
      }

      if (productionItemsInput !== undefined) {
        const currentItems = await tx.orderProductionItem.findMany({ where: { orderId: id }, orderBy: { sortOrder: 'asc' } });
        const currentItemIds = new Set(currentItems.map((p) => p.id));
        const payloadItemIds = new Set(productionItems.map((p: ProductionItemPayload) => p.id).filter(Boolean) as string[]);

        for (let idx = 0; idx < productionItems.length; idx++) {
          const item = productionItems[idx] as ProductionItemPayload;
          if (item.id && currentItemIds.has(item.id)) {
            await tx.orderProductionItem.update({
              where: { id: item.id },
              data: {
                name: item.name,
                description: item.description ?? null,
                rateType: item.rateType ?? 'FLAT',
                rateValue: item.rateValue ?? 0,
                units: item.units ?? 1,
                discount: item.discount ?? 0,
                stageIds: item.stageIds ?? null,
                isTransport: item.isTransport ?? false,
                isAutoCalculated: item.isAutoCalculated ?? true,
                isSubcontractor: item.isSubcontractor ?? false,
                visibleInOffer: item.visibleInOffer ?? true,
                sortOrder: item.sortOrder ?? idx,
              },
            });
          } else {
            await tx.orderProductionItem.create({
              data: {
                orderId: id,
                name: item.name,
                description: item.description ?? null,
                rateType: item.rateType ?? 'FLAT',
                rateValue: item.rateValue ?? 0,
                units: item.units ?? 1,
                discount: item.discount ?? 0,
                stageIds: item.stageIds ?? null,
                isTransport: item.isTransport ?? false,
                isAutoCalculated: item.isAutoCalculated ?? true,
                isSubcontractor: item.isSubcontractor ?? false,
                visibleInOffer: item.visibleInOffer ?? true,
                sortOrder: item.sortOrder ?? idx,
              },
            });
          }
        }
        for (const old of currentItems) {
          if (!payloadItemIds.has(old.id)) {
            await tx.orderProductionItem.delete({ where: { id: old.id } });
          }
        }
      }

      const refreshed = await tx.order.findUnique({
        where: { id },
        include: {
          client: true,
          equipmentItems: { include: { equipment: true } },
          productionItems: true,
          stages: true,
        },
      });
      return refreshed ?? order;
    });

    return this.normalizeOrderDates(updated!)
  }

  async deleteOrder(id: string) {
    return prisma.order.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  async restoreOrder(id: string) {
    return prisma.order.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
      },
    });
  }

  async deleteOrderPermanent(id: string) {
    return prisma.$transaction(async (tx) => {
      await tx.order.updateMany({
        where: { parentOrderId: id },
        data: { parentOrderId: null },
      });
      return tx.order.delete({
        where: { id },
      });
    });
  }
}

export const ordersService = new OrdersService();