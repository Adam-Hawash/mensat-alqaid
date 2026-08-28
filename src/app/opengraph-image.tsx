import { ImageResponse } from 'next/og'

export var alt = 'منصة القائد - مستر عمرو رشدي'
export var size = { width: 1200, height: 630 }
export var contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#FFFBF5',
          padding: '60px',
          position: 'relative',
        }}
      >
        {/* Teal accent bar top */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '8px',
            backgroundColor: '#0D9488',
          }}
        />
        {/* Decorative circles */}
        <div
          style={{
            position: 'absolute',
            top: '60px',
            right: '60px',
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            backgroundColor: 'rgba(13, 148, 136, 0.08)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '60px',
            left: '60px',
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: 'rgba(13, 148, 136, 0.05)',
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          {/* Teal badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'rgba(13, 148, 136, 0.1)',
              padding: '8px 24px',
              borderRadius: '9999px',
            }}
          >
            <span style={{ fontSize: '18px' }}>&#127891;</span>
            <span
              style={{
                fontSize: '18px',
                color: '#0D9488',
                fontWeight: 600,
              }}
            >
              منصة تعليمية متكاملة
            </span>
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: '72px',
              fontWeight: 800,
              color: '#0D9488',
              letterSpacing: '-1px',
              marginTop: '8px',
            }}
          >
            منصة القائد
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: '32px',
              color: '#374151',
              fontWeight: 600,
              marginTop: '4px',
            }}
          >
            مستر عمرو رشدي
          </div>

          {/* Description */}
          <div
            style={{
              fontSize: '22px',
              color: '#6B7280',
              marginTop: '12px',
              textAlign: 'center',
              lineHeight: 1.6,
              maxWidth: '800px',
            }}
        >
          نبسّط لك الدراسات والتاريخ ونجعلها سهلة وممتعة!
          <br />
          حصص مباشرة، واجبات أسبوعية، ومتابعة مستمرة
        </div>

          {/* Bottom accent line */}
          <div
            style={{
              width: '80px',
              height: '4px',
              backgroundColor: '#0D9488',
              borderRadius: '2px',
              marginTop: '20px',
            }}
          />
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '6px',
            backgroundColor: '#2DD4BF',
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  )
}
