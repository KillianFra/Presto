import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, describe, it } from 'node:test'
import { AssetKind, CreditTransactionType, PaymentStatus, ProjectStatus, ProjectVertical, TransformationStatus } from '@prisma/client'
import { createApp } from '../src/app.js'
import type { AppConfig } from '../src/config/env.js'
import type { AuthService, AuthSessionResult, AuthUser, LoginInput, PasswordResetResult, RegisterInput } from '../src/modules/auth/auth.types.js'
import type { CreditLedgerDto, CreditService, CreditWalletDto } from '../src/modules/credits/credit.types.js'
import type { PaymentService, PaymentWebhookInput } from '../src/modules/payments/payment.types.js'
import type { MaintenanceService } from '../src/modules/maintenance/maintenance.types.js'
import type {
  ProjectService,
  CreateProjectInput,
  ProjectDto,
  UpdateProjectInput,
  ProjectDetailsDto,
  AssetDto,
  CreateOriginalUploadInput,
  SignedOriginalUploadDto,
  ConfirmOriginalAssetInput,
  SignedAssetDownloadDto,
} from '../src/modules/projects/project.types.js'
import type {
  AnalyzeProjectResultDto,
  CreateTransformationInput,
  SuggestionDto,
  TransformationDto,
  TransformationService,
} from '../src/modules/transformations/transformation.types.js'
import type { Logger } from '../src/types/logger.js'

const silentLogger: Logger = {
  info: () => undefined,
  error: () => undefined,
}

const config: Readonly<AppConfig> = {
  nodeEnv: 'test',
  port: 0,
  corsOrigin: 'http://localhost:5173',
  sessionCookieName: 'presto_session',
  sessionTtlDays: 7,
  passwordResetTtlMinutes: 60,
  supabaseUrl: 'https://example.supabase.co',
  supabaseServiceRoleKey: 'service-role-key',
  supabaseStorageBucket: 'presto-assets',
  signedDownloadTtlSeconds: 900,
  originalAssetTtlDays: 30,
  maxImageByteSize: 10 * 1024 * 1024,
  transformationCreditCost: 1,
  mockGeneratedImageMimeType: 'image/png',
  mockGeneratedImageByteSize: 512 * 1024,
  stripeWebhookSecret: '',
  stripeCheckoutBaseUrl: 'https://checkout.stripe.com/c/pay',
  defaultCreditPackCredits: 10,
  defaultCreditPackAmountCents: 990,
  maintenanceSecret: 'maintenance-secret',
  rateLimitWindowMs: 60_000,
  rateLimitMaxRequests: 600,
}

const testUser: AuthUser = {
  id: 'user-1',
  email: 'user@example.com',
}

const projectDto: ProjectDto = {
  id: 'project-1',
  userId: testUser.id,
  title: 'Appartement',
  vertical: ProjectVertical.IMMOBILIER,
  status: ProjectStatus.DRAFT,
  createdAt: '2026-06-18T12:00:00.000Z',
  updatedAt: '2026-06-18T12:00:00.000Z',
}

const assetDto: AssetDto = {
  id: 'asset-1',
  projectId: projectDto.id,
  kind: AssetKind.ORIGINAL,
  storageKey: 'users/user-1/projects/project-1/originals/photo.jpg',
  mimeType: 'image/jpeg',
  byteSize: 120_000,
  expiresAt: '2026-07-18T12:00:00.000Z',
  deletedAt: null,
  createdAt: '2026-06-18T12:00:00.000Z',
}

const suggestionDto: SuggestionDto = {
  id: 'suggestion-1',
  projectId: projectDto.id,
  label: 'Luminosite',
  generatedPrompt: 'Ameliorer la lumiere.',
  selected: false,
  createdAt: '2026-06-18T12:00:00.000Z',
}

const transformationDto: TransformationDto = {
  id: 'transformation-1',
  projectId: projectDto.id,
  suggestionId: suggestionDto.id,
  userPrompt: null,
  internalPrompt: 'Ameliorer la lumiere.\nSimulation IA.',
  status: TransformationStatus.SUCCEEDED,
  providerName: 'mock-image-provider',
  providerRequestId: 'mock-transformation-1',
  costCents: 0,
  durationMs: 250,
  aiDisclosure: 'Simulation IA - visuel transforme automatiquement',
  errorMessage: null,
  resultAssetId: 'generated-asset-1',
  createdAt: '2026-06-18T12:00:00.000Z',
  updatedAt: '2026-06-18T12:00:00.000Z',
}

function createSessionResult(): AuthSessionResult {
  return {
    user: testUser,
    token: 'session-token',
    expiresAt: new Date('2026-06-18T12:00:00.000Z'),
  }
}

class FakeAuthService implements AuthService {
  currentUser: AuthUser | null = testUser

  async register(_input: RegisterInput): Promise<AuthSessionResult> {
    return createSessionResult()
  }

  async login(_input: LoginInput): Promise<AuthSessionResult> {
    return createSessionResult()
  }

  async logout(_token: string | null): Promise<void> {}

  async getCurrentUser(_token: string | null): Promise<AuthUser | null> {
    return this.currentUser
  }

  async requestPasswordReset(_email: string): Promise<PasswordResetResult> {
    return {}
  }

  async resetPassword(_token: string, _password: string): Promise<void> {}
}

class FakeProjectService implements ProjectService {
  async listProjects(_userId: string): Promise<ProjectDto[]> {
    return [projectDto]
  }

  async createProject(_userId: string, _input: CreateProjectInput): Promise<ProjectDto> {
    return projectDto
  }

  async getProject(_userId: string, _projectId: string): Promise<ProjectDetailsDto> {
    return { ...projectDto, assets: [assetDto] }
  }

  async updateProject(_userId: string, _projectId: string, _input: UpdateProjectInput): Promise<ProjectDto> {
    return projectDto
  }

  async deleteProject(_userId: string, _projectId: string): Promise<void> {}

  async createOriginalUploadUrl(
    _userId: string,
    _projectId: string,
    _input: CreateOriginalUploadInput,
  ): Promise<SignedOriginalUploadDto> {
    return {
      storageKey: assetDto.storageKey,
      uploadUrl: 'https://example.supabase.co/upload',
      expiresAt: '2026-06-18T14:00:00.000Z',
    }
  }

  async confirmOriginalAsset(
    _userId: string,
    _projectId: string,
    _input: ConfirmOriginalAssetInput,
  ): Promise<AssetDto> {
    return assetDto
  }

  async listAssets(_userId: string, _projectId: string): Promise<AssetDto[]> {
    return [assetDto]
  }

  async createAssetDownloadUrl(_userId: string, _projectId: string, _assetId: string): Promise<SignedAssetDownloadDto> {
    return {
      asset: assetDto,
      downloadUrl: 'https://example.supabase.co/download',
      expiresAt: '2026-06-18T12:15:00.000Z',
    }
  }
}

class FakeTransformationService implements TransformationService {
  analyzeInput?: { userId: string, projectId: string }
  createInput?: { userId: string, projectId: string, input: CreateTransformationInput }

  async analyzeProject(userId: string, projectId: string): Promise<AnalyzeProjectResultDto> {
    this.analyzeInput = { userId, projectId }
    return {
      project: {
        id: projectId,
        title: projectDto.title,
        vertical: projectDto.vertical,
        status: ProjectStatus.SUGGESTIONS_READY,
      },
      analysis: 'Analyse mockee',
      suggestions: [suggestionDto],
    }
  }

  async listSuggestions(_userId: string, _projectId: string): Promise<SuggestionDto[]> {
    return [suggestionDto]
  }

  async createTransformation(
    userId: string,
    projectId: string,
    input: CreateTransformationInput,
  ): Promise<TransformationDto> {
    this.createInput = { userId, projectId, input }
    return transformationDto
  }

  async listTransformations(_userId: string, _projectId: string): Promise<TransformationDto[]> {
    return [transformationDto]
  }
}

class FakeCreditService implements CreditService {
  async getLedger(_userId: string): Promise<CreditLedgerDto> {
    return {
      wallet: {
        balance: 9,
        updatedAt: '2026-06-18T12:00:00.000Z',
      },
      transactions: [
        {
          id: 'credit-transaction-1',
          type: CreditTransactionType.CONSUMPTION,
          amount: -1,
          balanceAfter: 9,
          reason: 'Image transformation',
          createdAt: '2026-06-18T12:00:00.000Z',
        },
      ],
    }
  }

  async addCredits(_userId: string, _amount: number, _reason: string, _paymentId?: string): Promise<CreditWalletDto> {
    return { balance: 10, updatedAt: '2026-06-18T12:00:00.000Z' }
  }

  async consumeCredits(
    _userId: string,
    _amount: number,
    _reason: string,
    _transformationId: string,
  ): Promise<CreditWalletDto> {
    return { balance: 9, updatedAt: '2026-06-18T12:00:00.000Z' }
  }
}

class FakePaymentService implements PaymentService {
  webhookInput?: PaymentWebhookInput

  async createCheckoutSession(_userId: string, credits?: number, amountCents?: number) {
    return {
      paymentId: 'payment-1',
      checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_mock_payment-1',
      status: PaymentStatus.PENDING,
      credits: credits ?? 10,
      amountCents: amountCents ?? 990,
    }
  }

  async handleWebhook(input: PaymentWebhookInput) {
    this.webhookInput = input
    return {
      paymentId: 'payment-1',
      status: PaymentStatus.SUCCEEDED,
      credited: true,
    }
  }
}

class FakeMaintenanceService implements MaintenanceService {
  async purgeExpiredOriginalAssets() {
    return { purgedAssets: 3 }
  }
}

describe('completed backend routes', () => {
  let server: Server
  let baseUrl: string
  let transformationService: FakeTransformationService
  let paymentService: FakePaymentService

  before(async () => {
    transformationService = new FakeTransformationService()
    paymentService = new FakePaymentService()

    const app = createApp({
      config,
      logger: silentLogger,
      authService: new FakeAuthService(),
      projectService: new FakeProjectService(),
      transformationService,
      creditService: new FakeCreditService(),
      paymentService,
      maintenanceService: new FakeMaintenanceService(),
    })

    await new Promise<void>((resolve, reject) => {
      server = app.listen(0, '127.0.0.1', (error?: Error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })

    const address = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  })

  it('analyzes projects and exposes generated suggestions', async () => {
    const analyzeResponse = await fetch(`${baseUrl}/api/projects/project-1/analyze`, {
      method: 'POST',
      headers: { Cookie: 'presto_session=session-token' },
    })

    assert.equal(analyzeResponse.status, 200)
    assert.deepEqual(transformationService.analyzeInput, {
      userId: testUser.id,
      projectId: 'project-1',
    })
    assert.deepEqual(await analyzeResponse.json(), {
      project: {
        id: 'project-1',
        title: projectDto.title,
        vertical: ProjectVertical.IMMOBILIER,
        status: ProjectStatus.SUGGESTIONS_READY,
      },
      analysis: 'Analyse mockee',
      suggestions: [suggestionDto],
    })

    const suggestionsResponse = await fetch(`${baseUrl}/api/projects/project-1/suggestions`, {
      headers: { Cookie: 'presto_session=session-token' },
    })

    assert.equal(suggestionsResponse.status, 200)
    assert.deepEqual(await suggestionsResponse.json(), { suggestions: [suggestionDto] })
  })

  it('creates transformations and keeps history visible', async () => {
    const createResponse = await fetch(`${baseUrl}/api/projects/project-1/transformations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'presto_session=session-token',
      },
      body: JSON.stringify({ suggestionId: 'suggestion-1' }),
    })

    assert.equal(createResponse.status, 201)
    assert.deepEqual(transformationService.createInput, {
      userId: testUser.id,
      projectId: 'project-1',
      input: { suggestionId: 'suggestion-1', userPrompt: undefined },
    })
    assert.deepEqual(await createResponse.json(), { transformation: transformationDto })

    const listResponse = await fetch(`${baseUrl}/api/projects/project-1/transformations`, {
      headers: { Cookie: 'presto_session=session-token' },
    })

    assert.equal(listResponse.status, 200)
    assert.deepEqual(await listResponse.json(), { transformations: [transformationDto] })
  })

  it('exposes credits and payment checkout/webhook routes', async () => {
    const creditsResponse = await fetch(`${baseUrl}/api/credits`, {
      headers: { Cookie: 'presto_session=session-token' },
    })

    assert.equal(creditsResponse.status, 200)
    assert.deepEqual(await creditsResponse.json(), {
      wallet: {
        balance: 9,
        updatedAt: '2026-06-18T12:00:00.000Z',
      },
      transactions: [
        {
          id: 'credit-transaction-1',
          type: CreditTransactionType.CONSUMPTION,
          amount: -1,
          balanceAfter: 9,
          reason: 'Image transformation',
          createdAt: '2026-06-18T12:00:00.000Z',
        },
      ],
    })

    const checkoutResponse = await fetch(`${baseUrl}/api/payments/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'presto_session=session-token',
      },
      body: JSON.stringify({ credits: 20, amountCents: 1490 }),
    })

    assert.equal(checkoutResponse.status, 201)
    assert.deepEqual(await checkoutResponse.json(), {
      checkout: {
        paymentId: 'payment-1',
        checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_mock_payment-1',
        status: PaymentStatus.PENDING,
        credits: 20,
        amountCents: 1490,
      },
    })

    const webhookResponse = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: 'evt-1',
        type: 'checkout.session.completed',
        checkoutSessionId: 'cs_mock_payment-1',
      }),
    })

    assert.equal(webhookResponse.status, 200)
    assert.deepEqual(paymentService.webhookInput, {
      eventId: 'evt-1',
      type: 'checkout.session.completed',
      checkoutSessionId: 'cs_mock_payment-1',
    })
  })

  it('protects maintenance purge with a secret', async () => {
    const rejectedResponse = await fetch(`${baseUrl}/api/maintenance/purge-expired-assets`, {
      method: 'POST',
      headers: { 'x-maintenance-secret': 'wrong' },
    })

    assert.equal(rejectedResponse.status, 401)

    const acceptedResponse = await fetch(`${baseUrl}/api/maintenance/purge-expired-assets`, {
      method: 'POST',
      headers: { 'x-maintenance-secret': 'maintenance-secret' },
    })

    assert.equal(acceptedResponse.status, 200)
    assert.deepEqual(await acceptedResponse.json(), { purgedAssets: 3 })
  })
})
