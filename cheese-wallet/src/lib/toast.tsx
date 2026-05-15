import toast from 'react-hot-toast'
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

const CONFIG: Record<ToastType, {
  icon: React.FC<{ size: number; color: string }>
  iconColor: string
  borderColor: string
  duration: number
}> = {
  success: { icon: CheckCircle,  iconColor: '#D4AF37', borderColor: '#D4AF37', duration: 3500 },
  error:   { icon: XCircle,      iconColor: '#EF4444', borderColor: '#EF4444', duration: 5000 },
  warning: { icon: AlertCircle,  iconColor: '#F59E0B', borderColor: '#F59E0B', duration: 4000 },
  info:    { icon: Info,         iconColor: '#60A5FA', borderColor: '#60A5FA', duration: 3500 },
}

function ToastBody({ message, type }: { message: string; type: ToastType }) {
  const { icon: Icon, iconColor, borderColor } = CONFIG[type]
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        background: '#111',
        border: '1px solid rgba(255,255,255,0.08)',
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: '10px',
        padding: '12px 16px',
        maxWidth: '360px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}
    >
      <Icon size={17} color={iconColor} style={{ flexShrink: 0, marginTop: '1px' }} />
      <span style={{ color: '#E5E5E5', fontSize: '13px', lineHeight: '1.5', fontWeight: 500 }}>
        {message}
      </span>
    </div>
  )
}

function show(type: ToastType, message: string) {
  const { duration } = CONFIG[type]
  toast.custom(
    (t) => (
      <div
        style={{
          opacity: t.visible ? 1 : 0,
          transform: t.visible ? 'translateY(0)' : 'translateY(-8px)',
          transition: 'opacity 0.2s, transform 0.2s',
        }}
      >
        <ToastBody message={message} type={type} />
      </div>
    ),
    { duration, id: message }
  )
}

export const notify = {
  success: (msg: string) => show('success', msg),
  error:   (msg: string) => show('error',   msg),
  warning: (msg: string) => show('warning', msg),
  info:    (msg: string) => show('info',    msg),
}
