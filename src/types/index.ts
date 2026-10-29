export type FileItem = {
  key: string
  size: number
  lastModified: string
}

export type UploadResponse = {
  upload: {
    url: string
    fields: Record<string, string>
  }
  key: string
  expiresIn: number
  maxFileSize: number
}

export type SharedItem = {
  shareId: string
  objectKey: string
  fileName: string
  ownerSub: string
  createdAt: string
}

export type ExternalShareResponse = {
  shareId: string
  token: string
  expiresAt: number
  expiresInHours: number
  maxDownloads: number
}

export type ExternalShareItem = {
  shareId: string
  fileName: string
  recipientEmail: string
  createdAt: string
  expiresAt: number
  downloadCount: number
  maxDownloads: number
  status: 'active' | 'revoked' | 'expired' | 'limit_reached'
}

export type ExternalLanguage = 'ar' | 'en'

export type DownloadResponse = {
  downloadUrl: string
}

export type ExternalDownloadResponse = DownloadResponse & {
  downloadCount: number
  maxDownloads: number
}

export type InternalShareResponse = {
  alreadyShared?: boolean
}

export type ExternalShareRequest = {
  key: string
  recipientEmail: string
  expiresInHours: number
  maxDownloads: number
}
