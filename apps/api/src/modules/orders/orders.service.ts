import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import {
  CreateOrderSchema,
  UpdateOrderSchema,
  CreateOrderEquipmentItemSchema,
  CreateOrderStageSchema,
  CreateOrderProductionItemSchema,
  UpdateOrderOfferBlockItemSchema,
  clampOrderOfferBlockTitle,
  validateOrderOfferBlocksForSave,
} from '@lama-stage/shared-types'
import { z } from 'zod'
import { EquipmentUnavailableError } from '../../shared/errors/AppError'

import { prisma } from '../../prisma/client'

const orderDetailInclude = {
  client: true,
  offerBlocks: { orderBy: { sortOrder: 'asc' } },
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
  private static readonly UUID_V4_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  private isUuid(value: unknown): value is string {
    return typeof value === 'string' && OrdersService.UUID_V4_RE.test(value)
  }

  private resolveOfferBlockId(value: unknown): string | null {
    if (value == null || value === '') return null
    return this.isUuid(value) ? value : null
  }

  private assertOfferBlocksValid(
    offerBlocks: z.infer<typeof UpdateOrderOfferBlockItemSchema>[] | undefined,
    equipmentItems: Array<{ offerBlockId?: string | null }> | undefined,
    productionItems: Array<{ offerBlockId?: string | null }> | undefined,
  ) {
    const err = validateOrderOfferBlocksForSave(offerBlocks, equipmentItems, productionItems)
    if (err) {
      const e = new Error(err) as Error & { code?: string }
      e.code = 'OFFER_BLOCKS_VALIDATION'
      throw e
    }
  }

  private async syncOfferBlocks(
    tx: Prisma.TransactionClient,
    orderId: string,
    blocks: z.infer<typeof UpdateOrderOfferBlockItemSchema>[],
  ) {
    const current = await tx.orderOfferBlock.findMany({ where: { orderId }, orderBy: { sortOrder: 'asc' } })
    const currentIds = new Set(current.map((b) => b.id))
    const payloadIds = new Set(blocks.map((b) => b.id))

    for (let idx = 0; idx < blocks.length; idx++) {
      const block = blocks[idx]!
      const title = clampOrderOfferBlockTitle(block.title)
      const sortOrder = block.sortOrder ?? idx
      if (currentIds.has(block.id)) {
        await tx.orderOfferBlock.update({
          where: { id: block.id },
          data: { title, sortOrder },
        })
      } else {
        await tx.orderOfferBlock.create({
          data: {
            id: block.id,
            orderId,
            title,
            sortOrder,
          },
        })
      }
    }

    for (const old of current) {
      if (!payloadIds.has(old.id)) {
        await tx.orderOfferBlock.delete({ where: { id: old.id } })
      }
    }
  }

  private normalizeOrderDates<T extends { dateFrom?: Date | string | null; dateTo?: Date | string | null; startDate?: Date | string | null; endDate?: Date | string | null }>(order: T): T {
    return {
      ...order,
      startDate: order.dateFrom ?? order.startDate ?? null,
      endDate: order.dateTo ?? order.endDate ?? null,
    } as T
  }

  private getDefaultExternalConfirmationDeadline(targetDate: Date | string | null | undefined): Date | null {
    if (!targetDate) return null
    const base = new Date(targetDate)
    if (Number.isNaN(base.getTime())) return null
    base.setDate(base.getDate() - 7)
    base.setHours(23, 59, 59, 999)
    return base
  }

  private resolveExternalConfirmationStatus(
    isExternal: boolean,
    status: string | null | undefined
  ): 'NOT_REQUIRED' | 'PENDING' | 'CONFIRMED' | 'DECLINED' {
    if (!isExternal) return 'NOT_REQUIRED'
    if (status === 'CONFIRMED' || status === 'DECLINED' || status === 'PENDING') return status
    return 'PENDING'
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
    const {
      clientId,
      equipmentItems,
      parentOrderId,
      startDate,
      endDate,
      stages,
      productionItems,
      offerBlocks,
      offerValidityDays,
      projectContactKey,
      currency,
      exchangeRateEur,
      ...rest
    } = orderData;
    const defaultStageDate = startDate ? new Date(startDate) : new Date();
    const blockRows = Array.isArray(offerBlocks) ? offerBlocks : []
    this.assertOfferBlocksValid(blockRows, equipmentItems, productionItems)

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
          externalConfirmationStatus: this.resolveExternalConfirmationStatus(
            item.isRental ?? false,
            item.externalConfirmationStatus ?? null
          ),
          externalConfirmationDeadline: item.externalConfirmationDeadline
            ? new Date(item.externalConfirmationDeadline)
            : this.getDefaultExternalConfirmationDeadline(item.dateFrom ? new Date(item.dateFrom) : startDate),
          externalConfirmedAt: item.externalConfirmedAt ? new Date(item.externalConfirmedAt) : null,
          sortOrder: item.sortOrder ?? 0,
          marginRentalUnits: item.marginRentalUnits ?? null,
          marginRentalUnitCostNet: item.marginRentalUnitCostNet ?? null,
          dateFrom: item.dateFrom ? new Date(item.dateFrom) : startDate,
          dateTo: item.dateTo ? new Date(item.dateTo) : endDate,
          equipmentId: item.equipmentId ?? null,
          offerBlockId: this.resolveOfferBlockId(item.offerBlockId),
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
          externalConfirmationStatus: this.resolveExternalConfirmationStatus(
            item.isSubcontractor ?? false,
            item.externalConfirmationStatus ?? null
          ),
          externalConfirmationDeadline: item.externalConfirmationDeadline
            ? new Date(item.externalConfirmationDeadline)
            : this.getDefaultExternalConfirmationDeadline(startDate),
          externalConfirmedAt: item.externalConfirmedAt ? new Date(item.externalConfirmedAt) : null,
          visibleInOffer: item.visibleInOffer ?? true,
          sortOrder: item.sortOrder ?? idx,
          marginSubcontractorUnits: item.marginSubcontractorUnits ?? null,
          marginSubcontractorUnitCostNet: item.marginSubcontractorUnitCostNet ?? null,
          offerBlockId: this.resolveOfferBlockId(item.offerBlockId),
        })) : [],
      },
    };

    const orderYear = this.getOrderYear();

    const createdId = await prisma.$transaction(async (tx) => {
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
          data: stageRows.map((s: z.infer<typeof CreateOrderStageSchema> & { id?: string }, idx: number) => ({
            id: this.isUuid(s.id) ? s.id : randomUUID(),
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
      if (blockRows.length > 0) {
        await this.syncOfferBlocks(tx, order.id, blockRows)
      }
      return order.id
    })
    const full = await prisma.order.findUnique({
      where: { id: createdId },
      include: orderDetailInclude,
    })
    if (!full) {
      throw new Error('Order create succeeded but order could not be reloaded')
    }
    const normalized = this.normalizeOrderDates(full) as OrderDetail
    if (Array.isArray(normalized.productionItems)) {
      normalized.productionItems = normalized.productionItems.map((p) => ({
        ...p,
        rateValue: Number(p.rateValue),
        units: Number(p.units),
      }))
    }
    return normalized
  }

  async duplicateOrder(id: string): Promise<OrderDetail> {
    const source = await prisma.order.findFirst({
      where: { id, isDeleted: false },
      include: orderDetailInclude,
    })
    if (!source) {
      throw new Error('ORDER_NOT_FOUND')
    }

    const blockIdMap = new Map<string, string>()
    const offerBlocks = (source.offerBlocks ?? []).map((block, idx) => {
      const nextId = randomUUID()
      blockIdMap.set(block.id, nextId)
      return {
        id: nextId,
        title: block.title,
        sortOrder: block.sortOrder ?? idx,
      }
    })

    const stageIdMap = new Map<string, string>()
    const stages = (source.stages ?? []).map((stage, idx) => {
      const nextId = randomUUID()
      stageIdMap.set(stage.id, nextId)
      return {
        id: nextId,
        type: stage.type as 'MONTAZ' | 'EVENT' | 'DEMONTAZ' | 'CUSTOM',
        label: stage.label ?? undefined,
        date: stage.date,
        timeStart: stage.timeStart ?? undefined,
        timeEnd: stage.timeEnd ?? undefined,
        notes: stage.notes ?? undefined,
        sortOrder: stage.sortOrder ?? idx,
      }
    })

    const remapStageIds = (raw: string | null | undefined): string | undefined => {
      if (!raw) return undefined
      try {
        const parsed = JSON.parse(raw) as unknown
        if (!Array.isArray(parsed)) return undefined
        const mapped = parsed
          .map((value) => (typeof value === 'string' ? stageIdMap.get(value) ?? value : null))
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
        return mapped.length > 0 ? JSON.stringify(mapped) : undefined
      } catch {
        return undefined
      }
    }

    const parsePricingRule = (raw: string | null | undefined): { day1: number; nextDays: number } | undefined => {
      if (!raw) return undefined
      try {
        const parsed = JSON.parse(raw) as unknown
        if (!parsed || typeof parsed !== 'object') return undefined
        const obj = parsed as Record<string, unknown>
        const day1 = Number(obj.day1)
        const nextDays = Number(obj.nextDays)
        if (!Number.isFinite(day1) || !Number.isFinite(nextDays)) return undefined
        return { day1, nextDays }
      } catch {
        return undefined
      }
    }

    const duplicated = await this.createOrder({
      name: `${source.name} (kopia)`,
      description: source.description ?? undefined,
      notes: source.notes ?? undefined,
      status: 'DRAFT',
      venue: source.venue ?? undefined,
      venuePlaceId: source.venuePlaceId ?? undefined,
      startDate: source.startDate,
      endDate: source.endDate,
      clientId: source.clientId,
      discountGlobal: source.discountGlobal,
      vatRate: source.vatRate as 0 | 23,
      offerValidityDays: source.offerValidityDays ?? 14,
      projectContactKey: source.projectContactKey as 'RAFAL' | 'MICHAL' | undefined,
      currency: source.currency === 'EUR' ? 'EUR' : 'PLN',
      exchangeRateEur: source.exchangeRateEur ?? undefined,
      isRecurring: false,
      recurringConfig: undefined,
      parentOrderId: undefined,
      stages,
      offerBlocks,
      equipmentItems: (source.equipmentItems ?? []).map((item, idx) => ({
        name: item.name,
        description: item.description ?? undefined,
        category: item.category ?? 'Inne',
        quantity: item.quantity ?? 1,
        unitPrice: item.unitPrice ?? 0,
        days: item.days ?? 1,
        discount: item.discount ?? 0,
        pricingRule: parsePricingRule(item.pricingRule),
        visibleInOffer: item.visibleInOffer ?? true,
        isRental: item.isRental ?? false,
        externalConfirmationStatus: undefined,
        externalConfirmationDeadline: undefined,
        externalConfirmedAt: undefined,
        sortOrder: item.sortOrder ?? idx,
        marginRentalUnits: item.marginRentalUnits ?? undefined,
        marginRentalUnitCostNet: item.marginRentalUnitCostNet ?? undefined,
        dateFrom: (item.dateFrom ?? source.startDate).toISOString(),
        dateTo: (item.dateTo ?? source.endDate).toISOString(),
        equipmentId: item.equipmentId ?? undefined,
        offerBlockId: item.offerBlockId ? blockIdMap.get(item.offerBlockId) ?? undefined : undefined,
      })),
      productionItems: (source.productionItems ?? []).map((item, idx) => ({
        name: item.name,
        description: item.description ?? undefined,
        rateType: (item.rateType as 'DAILY' | 'HOURLY' | 'FLAT') ?? 'FLAT',
        rateValue: Number(item.rateValue ?? 0),
        units: Number(item.units ?? 1),
        discount: item.discount ?? 0,
        stageIds: remapStageIds(item.stageIds),
        isTransport: item.isTransport ?? false,
        isAutoCalculated: item.isAutoCalculated ?? true,
        isSubcontractor: item.isSubcontractor ?? false,
        externalConfirmationStatus: undefined,
        externalConfirmationDeadline: undefined,
        externalConfirmedAt: undefined,
        visibleInOffer: item.visibleInOffer ?? true,
        sortOrder: item.sortOrder ?? idx,
        marginSubcontractorUnits: item.marginSubcontractorUnits ?? undefined,
        marginSubcontractorUnitCostNet: item.marginSubcontractorUnitCostNet ?? undefined,
        offerBlockId: item.offerBlockId ? blockIdMap.get(item.offerBlockId) ?? undefined : undefined,
      })),
    })

    return duplicated
  }

  async updateOrder(id: string, orderData: z.infer<typeof UpdateOrderSchema>) {
    const {
      clientId,
      equipmentItems,
      parentOrderId,
      startDate,
      endDate,
      stages: stagesInput,
      productionItems: productionItemsInput,
      offerBlocks: offerBlocksInput,
      ...rest
    } = orderData;
    const stages = Array.isArray(stagesInput) ? stagesInput : [];
    const productionItems = Array.isArray(productionItemsInput) ? productionItemsInput : [];
    const offerBlocks = Array.isArray(offerBlocksInput) ? offerBlocksInput : undefined;
    const defaultStageDate = startDate ?? new Date();

    if (offerBlocks !== undefined) {
      this.assertOfferBlocksValid(offerBlocks, equipmentItems, productionItems)
    }

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
                externalConfirmationStatus: this.resolveExternalConfirmationStatus(
                  item.isRental ?? false,
                  item.externalConfirmationStatus ?? null
                ),
                externalConfirmationDeadline: item.externalConfirmationDeadline
                  ? new Date(item.externalConfirmationDeadline)
                  : this.getDefaultExternalConfirmationDeadline(item.dateFrom ? new Date(item.dateFrom) : startDate),
                externalConfirmedAt: item.externalConfirmedAt ? new Date(item.externalConfirmedAt) : null,
                sortOrder: item.sortOrder ?? 0,
                marginRentalUnits: item.marginRentalUnits ?? null,
                marginRentalUnitCostNet: item.marginRentalUnitCostNet ?? null,
                dateFrom: item.dateFrom ? new Date(item.dateFrom) : startDate,
                dateTo: item.dateTo ? new Date(item.dateTo) : endDate,
                equipmentId: item.equipmentId ?? null,
                offerBlockId: this.resolveOfferBlockId(item.offerBlockId),
              })),
            },
          }
        : {}),
      // productionItems i stages – aktualizacja w miejscu w transakcji poniżej (nie przez data)
    };

    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.order.update({ where: { id }, data });

      if (offerBlocks !== undefined) {
        await this.syncOfferBlocks(tx, id, offerBlocks)
      }

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
                externalConfirmationStatus: this.resolveExternalConfirmationStatus(
                  item.isSubcontractor ?? false,
                  item.externalConfirmationStatus ?? null
                ),
                externalConfirmationDeadline: item.externalConfirmationDeadline
                  ? new Date(item.externalConfirmationDeadline)
                  : this.getDefaultExternalConfirmationDeadline(startDate),
                externalConfirmedAt: item.externalConfirmedAt ? new Date(item.externalConfirmedAt) : null,
                visibleInOffer: item.visibleInOffer ?? true,
                sortOrder: item.sortOrder ?? idx,
                marginSubcontractorUnits: item.marginSubcontractorUnits ?? null,
                marginSubcontractorUnitCostNet: item.marginSubcontractorUnitCostNet ?? null,
                offerBlockId: this.resolveOfferBlockId(item.offerBlockId),
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
                externalConfirmationStatus: this.resolveExternalConfirmationStatus(
                  item.isSubcontractor ?? false,
                  item.externalConfirmationStatus ?? null
                ),
                externalConfirmationDeadline: item.externalConfirmationDeadline
                  ? new Date(item.externalConfirmationDeadline)
                  : this.getDefaultExternalConfirmationDeadline(startDate),
                externalConfirmedAt: item.externalConfirmedAt ? new Date(item.externalConfirmedAt) : null,
                visibleInOffer: item.visibleInOffer ?? true,
                sortOrder: item.sortOrder ?? idx,
                marginSubcontractorUnits: item.marginSubcontractorUnits ?? null,
                marginSubcontractorUnitCostNet: item.marginSubcontractorUnitCostNet ?? null,
                offerBlockId: this.resolveOfferBlockId(item.offerBlockId),
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
        include: orderDetailInclude,
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