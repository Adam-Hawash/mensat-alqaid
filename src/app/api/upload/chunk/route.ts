import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

export async function POST(req: NextRequest) {
  try {
    var formData = await req.formData()
    var file = formData.get('file') as File | null
    var uploadId = (formData.get('uploadId') as string) || ''
    var fileName = (formData.get('fileName') as string) || 'file'
    var category = (formData.get('category') as string) || 'general'

    if (!file) {
      return NextResponse.json({ error: 'مفيش ملف' }, { status: 400 })
    }

    var token = process.env.BLOB_READ_WRITE_TOKEN
    if (!token) {
      return NextResponse.json({ error: 'BLOB_READ_WRITE_TOKEN مش متعرف. ضيفه في Vercel > Settings > Environment Variables' }, { status: 500 })
    }

    var ext = fileName.split('.').pop() || ''
    var safeName = fileName.replace(/[^a-zA-Z0-9._\-\u0600-\u06FF]/g, '_')
    var timestamp = Date.now()
    var blobPath = category + '/' + timestamp + '_' + safeName

    var arrayBuffer = await file.arrayBuffer()
    var buffer = Buffer.from(arrayBuffer)

    var blob = await put(blobPath, buffer, {
      access: 'public',
      contentType: file.type || 'application/octet-stream',
    })

    return NextResponse.json({
      filePath: blob.url,
      fileType: file.type || ext,
      filename: fileName,
      size: buffer.length,
      done: true,
    })
  } catch (err: any) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: err.message || 'حصلت مشكلة في الرفع' }, { status: 500 })
  }
}
