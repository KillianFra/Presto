export interface PurgeExpiredAssetsResultDto {
  purgedAssets: number
}

export interface MaintenanceService {
  purgeExpiredOriginalAssets(now?: Date): Promise<PurgeExpiredAssetsResultDto>
}
