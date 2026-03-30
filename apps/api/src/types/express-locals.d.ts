import 'express'

declare module 'express-serve-static-core' {
  interface Locals {
    requestId?: string
  }
}
