import { Router } from 'express'
import { validate } from '../../shared/middleware/validate.middleware'
import { CreateClientSchema, UpdateClientSchema } from '@lama-stage/shared-types'
import * as controller from './clients.controller'

const router = Router()

router.get('/', controller.getClients)
router.get('/:id', controller.getClientById)
router.post('/', validate(CreateClientSchema), controller.createClient)
router.put('/:id', validate(UpdateClientSchema), controller.updateClient)
router.delete('/:id/permanent', controller.deleteClientPermanent)
router.delete('/:id', controller.deleteClient)
router.patch('/:id/restore', controller.restoreClient)

export default router
