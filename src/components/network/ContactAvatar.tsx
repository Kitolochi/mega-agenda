interface ContactAvatarProps {
  name: string
  color: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'w-8 h-8 text-[10px]',
  md: 'w-10 h-10 text-xs',
  lg: 'w-14 h-14 text-base',
}

export default function ContactAvatar({ name, color, size = 'md' }: ContactAvatarProps) {
  const initials = name
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-semibold shrink-0`}
      style={{ backgroundColor: color + '30', color }}
    >
      {initials || '?'}
    </div>
  )
}
