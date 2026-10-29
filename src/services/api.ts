import type {
  DownloadResponse,
  ExternalDownloadResponse,
  ExternalShareItem,
  ExternalShareRequest,
  ExternalShareResponse,
  FileItem,
  InternalShareResponse,
  SharedItem,
  UploadResponse,
} from '../types'

type RequestOptions = {
  accessToken?: string
  method?: 'POST' | 'DELETE'
  body?: object
}

function fetchApi(path: string, options: RequestOptions) {
  const { accessToken, method, body } = options

  return fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    ...(method ? { method } : {}),
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

async function requestJson<T>(
  path: string,
  options: RequestOptions,
  errorPrefix: string,
  useServerMessage = false,
): Promise<T> {
  const response = await fetchApi(path, options)

  // List/upload/download requests historically check status before reading JSON.
  if (!useServerMessage && !response.ok) {
    throw new Error(`${errorPrefix}: ${response.status}`)
  }

  const data: T & { message?: string } = await response.json()

  // Sharing requests also surface the backend's JSON error message.
  if (!response.ok) {
    throw new Error(data.message || `${errorPrefix}: ${response.status}`)
  }

  return data
}

export function getFiles(accessToken: string) {
  return requestJson<{ files?: FileItem[] }>(
    '/files', { accessToken }, 'API request failed',
  )
}

export function getSharedFiles(accessToken: string) {
  return requestJson<{ shares?: SharedItem[] }>(
    '/shares', { accessToken }, 'Shared files request failed',
  )
}

export function getExternalShares(accessToken: string) {
  return requestJson<{ shares?: ExternalShareItem[] }>(
    '/external-shares', { accessToken }, 'External shares request failed',
  )
}

export function requestUpload(accessToken: string, file: File) {
  return requestJson<UploadResponse>(
    '/uploads',
    {
      accessToken,
      method: 'POST',
      body: {
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
      },
    },
    'Upload request failed',
  )
}

export async function uploadToStorage(
  upload: UploadResponse['upload'],
  file: File,
) {
  const formData = new FormData()

  Object.entries(upload.fields).forEach(([key, value]) => {
    formData.append(key, value)
  })

  formData.append('file', file)

  const response = await fetch(upload.url, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`S3 upload failed: ${response.status}`)
  }
}

export function getDownload(accessToken: string, key: string) {
  return requestJson<DownloadResponse>(
    '/downloads',
    { accessToken, method: 'POST', body: { key } },
    'Download request failed',
  )
}

export function getSharedDownload(accessToken: string, key: string) {
  return requestJson<DownloadResponse>(
    '/downloads',
    { accessToken, method: 'POST', body: { key } },
    'Shared download failed',
  )
}

export async function deleteFile(accessToken: string, key: string) {
  const response = await fetchApi('/files', {
    accessToken,
    method: 'DELETE',
    body: { key },
  })

  if (!response.ok) {
    throw new Error(`Delete request failed: ${response.status}`)
  }
  // A successful delete does not require a JSON response body.
}

export function shareFile(
  accessToken: string,
  key: string,
  recipientEmail: string,
) {
  return requestJson<InternalShareResponse>(
    '/shares',
    { accessToken, method: 'POST', body: { key, recipientEmail } },
    'Share request failed',
    true,
  )
}

export function createExternalShare(
  accessToken: string,
  body: ExternalShareRequest,
) {
  return requestJson<ExternalShareResponse>(
    '/external-shares',
    { accessToken, method: 'POST', body },
    'External share request failed',
    true,
  )
}

export function revokeExternalShare(accessToken: string, shareId: string) {
  return requestJson<{ message?: string }>(
    '/external-shares',
    { accessToken, method: 'DELETE', body: { shareId } },
    'Revoke request failed',
    true,
  )
}

export function getExternalDownload(token: string) {
  return requestJson<ExternalDownloadResponse>(
    '/external-download',
    { method: 'POST', body: { token } },
    'External download failed',
    true,
  )
}
