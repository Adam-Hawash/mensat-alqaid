// Upload utility - uploads file directly to /api/upload/chunk
// Uses Vercel Blob for storage

const UPLOAD_TIMEOUT = 120_000 // 2 minutes max

function uploadWithTimeout(url: string, options: RequestInit): Promise<Response> {
  return Promise.race([
    fetch(url, options),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('انتهت مهلة الرفع - حاول ملف أصغر')), UPLOAD_TIMEOUT)
    ),
  ])
}

export async function chunkedUpload(
  file: File,
  category: string,
  onProgress?: (pct: number) => void,
  statusMsg?: (msg: string) => void
): Promise<{ filePath: string; fileType: string; filename: string; size: number }> {
  if (statusMsg) statusMsg('جاري الرفع...')
  if (onProgress) onProgress(10)

  const fd = new FormData()
  fd.append('file', file, file.name)
  fd.append('uploadId', crypto.randomUUID())
  fd.append('chunkIndex', '0')
  fd.append('totalChunks', '1')
  fd.append('fileName', file.name)
  fd.append('category', category)

  if (onProgress) onProgress(30)

  const res = await uploadWithTimeout('/api/upload/chunk', { method: 'POST', body: fd })
  const data = await res.json()

  if (onProgress) onProgress(90)

  if (!res.ok) throw new Error(data.error || 'فشل الرفع')

  if (onProgress) onProgress(100)
  if (statusMsg) statusMsg('تم الرفع بنجاح!')
  return data
}
