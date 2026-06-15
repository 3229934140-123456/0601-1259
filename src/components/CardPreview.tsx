import type { Card, CardElement } from '@/types'

interface CardPreviewProps {
  card: Card
  width?: number
  height?: number
  side?: 'front' | 'back'
  showNumber?: boolean
  flipped?: boolean
}

export default function CardPreview({ card, width = 120, height, side = 'front', showNumber = true, flipped = false }: CardPreviewProps) {
  const scale = width / 63
  const h = height || width * (88 / 63)
  const elements = side === 'front' ? card.frontElements : card.backElements

  return (
    <div
      className={`relative rounded-lg overflow-hidden shadow-lg transition-transform duration-500 ${flipped ? '[transform:rotateY(180deg)]' : ''}`}
      style={{
        width,
        height: h,
        background: card.background,
        transformStyle: 'preserve-3d',
      }}
    >
      <div className="absolute inset-0 p-2" style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {elements.map(el => (
          <CardElementView key={el.id} element={el} />
        ))}
      </div>

      {card.attributes.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 p-1" style={{ background: 'rgba(0,0,0,0.5)' }}>
          {card.attributes.slice(0, 3).map(attr => (
            <div key={attr.id} className="flex justify-between text-[5px] leading-tight" style={{ color: '#fff' }}>
              <span style={{ fontSize: `${4 * scale}px` }}>{attr.label}</span>
              <span style={{ fontSize: `${4 * scale}px` }}>{attr.value}</span>
            </div>
          ))}
        </div>
      )}

      {showNumber && card.number && (
        <div className="absolute top-0.5 right-1 text-[6px] font-bold" style={{ color: 'rgba(255,255,255,0.7)', fontSize: `${6 * scale}px` }}>
          {card.number}
        </div>
      )}
    </div>
  )
}

function CardElementView({ element }: { element: CardElement }) {
  const style: React.CSSProperties = {
    position: 'absolute',
    left: element.x,
    top: element.y,
    width: element.width || 'auto',
    height: element.height || 'auto',
    color: element.style.color,
    fontSize: element.style.fontSize,
    fontWeight: element.style.fontWeight as any,
    backgroundColor: element.style.backgroundColor,
    borderColor: element.style.borderColor,
    borderWidth: element.style.borderWidth,
    borderRadius: element.style.borderRadius,
    textAlign: element.style.textAlign as any,
    opacity: element.style.opacity,
    transform: element.style.rotation ? `rotate(${element.style.rotation}deg)` : undefined,
  }

  switch (element.type) {
    case 'text':
      return <div style={style}>{element.content}</div>
    case 'rect':
      return <div style={{ ...style, border: element.style.borderWidth ? `${element.style.borderWidth}px solid ${element.style.borderColor || '#fff'}` : '1px solid #fff' }} />
    case 'circle':
      return <div style={{ ...style, borderRadius: '50%', border: element.style.borderWidth ? `${element.style.borderWidth}px solid ${element.style.borderColor || '#fff'}` : '1px solid #fff' }} />
    case 'image':
      return <img src={element.content} style={style} alt="" className="object-cover" />
    case 'icon':
      return <img src={element.content} style={style} alt="" className="object-contain" />
    default:
      return <div style={style}>{element.content}</div>
  }
}
