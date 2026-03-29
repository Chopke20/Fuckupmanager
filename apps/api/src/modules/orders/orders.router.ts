import { Router } from 'express';
import { validate } from '../../shared/middleware/validate.middleware';
import { CreateOrderSchema, UpdateOrderSchema } from '@lama-stage/shared-types';
import {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
  restoreOrder,
  deleteOrderPermanent,
  checkEquipmentAvailability,
  getOrderConflicts,
} from './orders.controller';
import {
  listOrderDocumentExports,
  getOrderDocumentExport,
  deleteOrderDocumentExport,
  createOrderDocumentExport,
  getOrderDocumentDraft,
  updateOrderDocumentDraft,
} from './order-documents.controller';
import { generateOfferClientDescription } from '../ai/ai.controller';

const router = Router();

router.get('/', getAllOrders);
router.post('/availability', checkEquipmentAvailability);
router.get('/conflicts', getOrderConflicts);
router.get('/:id', getOrderById);
router.get('/:id/documents/exports', listOrderDocumentExports);
router.get('/:id/documents/exports/:exportId', getOrderDocumentExport);
router.delete('/:id/documents/exports/:exportId', deleteOrderDocumentExport);
router.post('/:id/documents/exports', createOrderDocumentExport);
router.get('/:id/documents/draft', getOrderDocumentDraft);
router.put('/:id/documents/draft', updateOrderDocumentDraft);
/** OpenRouter: opis oferty dla klienta — ten sam prefiks co draft (`/:id/documents/...`), żeby proxy i routing nie zwracały 404. */
router.post('/:id/documents/offer-client-description', generateOfferClientDescription);
router.post('/', validate(CreateOrderSchema), createOrder);
router.put('/:id', validate(UpdateOrderSchema.partial()), updateOrder);
router.delete('/:id/permanent', deleteOrderPermanent);
router.delete('/:id', deleteOrder);
router.patch('/:id/restore', restoreOrder);

export { router as ordersRouter };
