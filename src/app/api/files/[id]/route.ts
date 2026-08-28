// @ts-nocheck
// Serve files stored as base64 in Media table - OPTIMIZED for video streaming

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    var { id } = await params

    var media = await db.media.findUnique({ where: { id } })
    if (!media || !media.data) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Decode base64 to buffer
    var binaryStr = atob(media.data)
    var bytes = new Uint8Array(binaryStr.length)
    for (var i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i)
    }

    var contentType = media.fileType || 'application/octet-stream'
    var fileName = media.filename || 'download'
    var contentLength = bytes.length

    // Support Range requests for video seeking
    var rangeHeader = request.headers.get('range')

    if (rangeHeader) {
      var parts = rangeHeader.replace(/bytes=/, '').split('-')
      var start = parseInt(parts[0], 10)
      var end = parts[1] ? parseInt(parts[1], 10) : contentLength - 1
      if (start >= contentLength) {
        return new NextResponse('Range Not Satisfiable', { status: 416 })
           }
      end = Math.min(end, contentLength - 1)
      var chunkSize = end - start + 1
      var chunk = bytes.slice(start, end + 1)

      return new NextResponse(chunk, {
        status: 206,
        headers: {
          'Content-Range': 'bytes ' + start + '-' + end + '/' + contentLength,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunkSize),
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    }

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(contentLength),
        'Content-Disposition': 'inline; filename="' + fileName + '"',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error: any) {
    console.error('File serve error:', error)
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}
