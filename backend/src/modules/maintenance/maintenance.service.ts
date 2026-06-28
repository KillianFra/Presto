import { AssetKind, type PrismaClient } from '@prisma/client'
import type { MaintenanceService, PurgeExpiredAssetsResultDto } from './maintenance.types.js'

export function createMaintenanceService(prisma: PrismaClient): MaintenanceService {
  return {
    async purgeExpiredOriginalAssets(now = new Date()): Promise<PurgeExpiredAssetsResultDto> {
      const result = await prisma.asset.updateMany({
        where: {
          kind: AssetKind.ORIGINAL,
          deletedAt: null,
          expiresAt: {
            lte: now,
          },
        },
        data: {
          deletedAt: now,
        },
      })

      return {
        purgedAssets: result.count,
      }
    },
  }
}
