import { Router, type Request, type RequestHandler } from 'express'
import { AppError } from '../lib/errors'
import { asyncHandler, sendSuccess } from '../lib/http'
import { asString } from '../lib/validation'
import { requireAuth } from '../middleware/auth.middleware'
import { requireAdmin } from './category.routes'
import { closeVerificationCase, createVerificationCase, deleteVerificationCase, getVerificationCase, listVerificationCases, markVerificationDuplicate, updateVerificationCase } from '../services/payment-verification.service'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseId(raw: unknown, field = 'ID kasus'): string {
  const value = asString(raw).trim()
  if (!UUID_PATTERN.test(value)) throw new AppError(400, 'INVALID_ID', `${field} tidak valid.`)
  return value
}

function body(req: Request): Record<string, unknown> { return (req.body ?? {}) as Record<string, unknown> }

export function createPaymentVerificationRouter(authMiddleware: RequestHandler = requireAuth): Router {
  const router = Router()
  const admin = [authMiddleware, requireAdmin]

  router.get('/admin/payment-verifications', ...admin, asyncHandler(async (req, res) => {
    const rawPage = Number(req.query.page ?? 1)
    const rawPageSize = Number(req.query.pageSize ?? 20)
    const page = Number.isInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 100000) : 1
    const pageSize = Number.isInteger(rawPageSize) && rawPageSize > 0 ? Math.min(rawPageSize, 100) : 20
    const result = await listVerificationCases({ page, pageSize, search: asString(req.query.search).trim() || undefined, status: asString(req.query.status).trim() || undefined, issueType: asString(req.query.issueType).trim() || undefined }, req.auth!.accessToken)
    sendSuccess(res, result)
  }))

  router.post('/admin/payment-verifications', ...admin, asyncHandler(async (req, res) => {
    const input = body(req)
    const result = await createVerificationCase({ paymentId: parseId(input.paymentId, 'Payment ID'), issueType: input.issueType, description: input.description, assignedAdminId: input.assignedAdminId === undefined ? undefined : parseId(input.assignedAdminId, 'Admin ID') }, req.auth!.profile.id, req.auth!.accessToken)
    sendSuccess(res, { case: result }, 201)
  }))

  router.get('/admin/payment-verifications/:caseId', ...admin, asyncHandler(async (req, res) => {
    const result = await getVerificationCase(parseId(req.params.caseId), req.auth!.accessToken)
    sendSuccess(res, { case: result })
  }))

  router.patch('/admin/payment-verifications/:caseId', ...admin, asyncHandler(async (req, res) => {
    const input = body(req)
    const assignedAdminId = input.assignedAdminId === undefined ? undefined : input.assignedAdminId === null ? null : parseId(input.assignedAdminId, 'Admin ID')
    const result = await updateVerificationCase(parseId(req.params.caseId), { status: input.status, decisionNotes: input.decisionNotes, assignedAdminId }, req.auth!.profile.id, req.auth!.accessToken)
    sendSuccess(res, { case: result })
  }))

  router.delete('/admin/payment-verifications/:caseId', ...admin, asyncHandler(async (req, res) => {
    const result = await deleteVerificationCase(parseId(req.params.caseId), req.auth!.profile.id, req.auth!.accessToken)
    sendSuccess(res, { deleted: result })
  }))

  router.post('/admin/payment-verifications/:caseId/close', ...admin, asyncHandler(async (req, res) => {
    const result = await closeVerificationCase(parseId(req.params.caseId), body(req).note, req.auth!.profile.id, req.auth!.accessToken)
    sendSuccess(res, { case: result })
  }))

  router.post('/admin/payment-verifications/:caseId/mark-duplicate', ...admin, asyncHandler(async (req, res) => {
    const input = body(req)
    const result = await markVerificationDuplicate(parseId(req.params.caseId), parseId(input.duplicateOfCaseId, 'Kasus utama'), input.note, req.auth!.profile.id, req.auth!.accessToken)
    sendSuccess(res, { case: result })
  }))

  return router
}

export default createPaymentVerificationRouter()
