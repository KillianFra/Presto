export interface SignedUploadUrlInput {
  storageKey: string
  contentType: string
}

export interface SignedUploadUrlResult {
  uploadUrl: string
  expiresAt: Date
}

export interface SignedDownloadUrlResult {
  downloadUrl: string
  expiresAt: Date
}

export interface StorageService {
  createSignedUploadUrl(input: SignedUploadUrlInput): Promise<SignedUploadUrlResult>
  createSignedDownloadUrl(storageKey: string): Promise<SignedDownloadUrlResult>
}
