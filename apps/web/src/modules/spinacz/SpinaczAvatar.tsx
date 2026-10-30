/** Własny spinacz (nie oryginalne assety Microsoft) — oczy + brwi na metalowym drucie. */

export type SpinaczMood = 'idle' | 'talk' | 'think' | 'send' | 'done' | 'mad'

interface SpinaczAvatarProps {
  mood?: SpinaczMood
  size?: number
  className?: string
}

export default function SpinaczAvatar({ mood = 'idle', size = 72, className = '' }: SpinaczAvatarProps) {
  const browLift = mood === 'mad' || mood === 'talk' ? -2 : mood === 'think' ? 2 : 0
  const eyeScaleY = mood === 'done' ? 0.35 : 1
  const sway =
    mood === 'send'
      ? 'spinacz-sway-fast'
      : mood === 'idle'
        ? 'spinacz-sway'
        : mood === 'think'
          ? 'spinacz-bob'
          : ''

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      className={`${sway} ${className}`.trim()}
      aria-hidden
    >
      <defs>
        <linearGradient id="spinacz-metal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d8dce2" />
          <stop offset="45%" stopColor="#9aa3ad" />
          <stop offset="100%" stopColor="#6b7380" />
        </linearGradient>
        <filter id="spinacz-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* ciało — wygięty spinacz */}
      <g filter="url(#spinacz-soft)" fill="none" stroke="url(#spinacz-metal)" strokeLinecap="round">
        <path
          d="M38 12
             C 22 12, 18 28, 28 36
             C 36 42, 48 40, 52 32
             C 56 24, 48 18, 40 22
             C 30 27, 28 40, 34 48
             C 40 56, 48 62, 48 70
             C 48 76, 40 78, 36 74"
          strokeWidth="7"
        />
        <path
          d="M38 12
             C 22 12, 18 28, 28 36
             C 36 42, 48 40, 52 32
             C 56 24, 48 18, 40 22
             C 30 27, 28 40, 34 48
             C 40 56, 48 62, 48 70
             C 48 76, 40 78, 36 74"
          stroke="#eef1f4"
          strokeWidth="2.2"
          opacity="0.55"
        />
      </g>

      {/* brwi */}
      <g transform={`translate(0 ${browLift})`} stroke="#1a1d22" strokeWidth="2.4" strokeLinecap="round">
        <path d={mood === 'mad' ? 'M28 28 L36 26' : 'M28 27 L36 27'} />
        <path d={mood === 'mad' ? 'M42 26 L50 28' : 'M42 27 L50 27'} />
      </g>

      {/* oczy */}
      <g transform={`scale(1 ${eyeScaleY})`} style={{ transformOrigin: '39px 34px' }}>
        <ellipse cx="32.5" cy="34" rx="5.2" ry="5.8" fill="#f7f8fa" stroke="#1a1d22" strokeWidth="1.2" />
        <ellipse cx="45.5" cy="34" rx="5.2" ry="5.8" fill="#f7f8fa" stroke="#1a1d22" strokeWidth="1.2" />
        <circle cx="33.2" cy="34.4" r="2.1" fill="#15181c" className={mood === 'idle' ? 'spinacz-blink' : ''} />
        <circle cx="46.2" cy="34.4" r="2.1" fill="#15181c" className={mood === 'idle' ? 'spinacz-blink' : ''} />
        <circle cx="31.6" cy="32.8" r="0.7" fill="#fff" opacity="0.9" />
        <circle cx="44.6" cy="32.8" r="0.7" fill="#fff" opacity="0.9" />
      </g>
    </svg>
  )
}
