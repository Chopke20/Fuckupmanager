import { Router } from 'express'
import {
  getEquipment,
  getEquipmentById,
  getNextCode,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  restoreEquipment,
  deleteEquipmentPermanent,
  getEquipmentCategories,
  getEquipmentAvailability,
  getResourceSubcategories,
  clearResourceSubcategory,
  renameResourceSubcategory,
} from './equipment.controller'
import { validate } from '../../shared/middleware/validate.middleware'
import { CreateEquipmentSchema } from '@lama-stage/shared-types'

const router = Router()

router.get('/', getEquipment)
router.get('/categories', getEquipmentCategories)
router.get('/availability', getEquipmentAvailability)
router.get('/resource-subcategories', getResourceSubcategories)
router.patch('/resource-subcategories/:name/clear', clearResourceSubcategory)
router.patch('/resource-subcategories/:name/rename', renameResourceSubcategory)
router.get('/next-code', getNextCode)
router.get('/:id', getEquipmentById)
router.post('/', validate(CreateEquipmentSchema), createEquipment)
router.put('/:id', validate(CreateEquipmentSchema.partial()), updateEquipment)
router.delete('/:id/permanent', deleteEquipmentPermanent)
router.delete('/:id', deleteEquipment)
router.patch('/:id/restore', restoreEquipment)

export default router