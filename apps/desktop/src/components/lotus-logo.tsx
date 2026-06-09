import { cn } from '@/lib/utils'

interface LotusLogoProps extends React.SVGProps<SVGSVGElement> {
  /** Show the subtle AI orbit ring around the bloom. */
  showOrbit?: boolean
}

/**
 * Blooming lotus mark with AI accents — neural core, circuit nodes, orbit ring.
 */
export function LotusLogo({ className, showOrbit = true, ...props }: LotusLogoProps) {
  return (
    <svg
      aria-hidden
      className={cn('shrink-0', className)}
      fill="none"
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        <linearGradient id="lotus-petal-outer" x1="20" x2="100" y1="20" y2="100">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="45%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="lotus-petal-inner" x1="30" x2="90" y1="35" y2="85">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <radialGradient id="lotus-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e0f2fe" />
          <stop offset="55%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </radialGradient>
        <filter id="lotus-glow" height="140%" width="140%" x="-20%" y="-20%">
          <feGaussianBlur result="blur" stdDeviation="2" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {showOrbit ? (
        <>
          <circle cx="60" cy="60" opacity="0.35" r="46" stroke="#38bdf8" strokeDasharray="4 6" strokeWidth="1" />
          <circle cx="60" cy="14" fill="#22d3ee" opacity="0.9" r="2.5" />
          <circle cx="104" cy="44" fill="#60a5fa" opacity="0.85" r="2" />
          <circle cx="98" cy="88" fill="#818cf8" opacity="0.8" r="2" />
          <circle cx="22" cy="88" fill="#38bdf8" opacity="0.8" r="2" />
          <circle cx="16" cy="44" fill="#22d3ee" opacity="0.85" r="2" />
          <path
            d="M60 16 L104 44 M104 44 L98 88 M98 88 L22 88 M22 88 L16 44 M16 44 L60 16"
            opacity="0.2"
            stroke="#38bdf8"
            strokeWidth="0.75"
          />
        </>
      ) : null}

      {/* Outer bloom */}
      <g opacity="0.92">
        <ellipse cx="60" cy="78" fill="url(#lotus-petal-outer)" rx="11" ry="24" transform="rotate(0 60 60)" />
        <ellipse cx="60" cy="78" fill="url(#lotus-petal-outer)" rx="11" ry="24" transform="rotate(45 60 60)" />
        <ellipse cx="60" cy="78" fill="url(#lotus-petal-outer)" rx="11" ry="24" transform="rotate(90 60 60)" />
        <ellipse cx="60" cy="78" fill="url(#lotus-petal-outer)" rx="11" ry="24" transform="rotate(135 60 60)" />
        <ellipse cx="60" cy="78" fill="url(#lotus-petal-outer)" rx="11" ry="24" transform="rotate(180 60 60)" />
        <ellipse cx="60" cy="78" fill="url(#lotus-petal-outer)" rx="11" ry="24" transform="rotate(225 60 60)" />
        <ellipse cx="60" cy="78" fill="url(#lotus-petal-outer)" rx="11" ry="24" transform="rotate(270 60 60)" />
        <ellipse cx="60" cy="78" fill="url(#lotus-petal-outer)" rx="11" ry="24" transform="rotate(315 60 60)" />
      </g>

      {/* Inner bloom */}
      <g opacity="0.98">
        <ellipse cx="60" cy="72" fill="url(#lotus-petal-inner)" rx="7" ry="16" transform="rotate(22.5 60 60)" />
        <ellipse cx="60" cy="72" fill="url(#lotus-petal-inner)" rx="7" ry="16" transform="rotate(67.5 60 60)" />
        <ellipse cx="60" cy="72" fill="url(#lotus-petal-inner)" rx="7" ry="16" transform="rotate(112.5 60 60)" />
        <ellipse cx="60" cy="72" fill="url(#lotus-petal-inner)" rx="7" ry="16" transform="rotate(157.5 60 60)" />
        <ellipse cx="60" cy="72" fill="url(#lotus-petal-inner)" rx="7" ry="16" transform="rotate(202.5 60 60)" />
        <ellipse cx="60" cy="72" fill="url(#lotus-petal-inner)" rx="7" ry="16" transform="rotate(247.5 60 60)" />
        <ellipse cx="60" cy="72" fill="url(#lotus-petal-inner)" rx="7" ry="16" transform="rotate(292.5 60 60)" />
        <ellipse cx="60" cy="72" fill="url(#lotus-petal-inner)" rx="7" ry="16" transform="rotate(337.5 60 60)" />
      </g>

      {/* AI neural core */}
      <g filter="url(#lotus-glow)">
        <circle cx="60" cy="58" fill="url(#lotus-core)" r="11" />
        <circle cx="60" cy="58" fill="#f0f9ff" opacity="0.55" r="5" />
        <path d="M60 52 L60 64 M54 58 L66 58 M56 54 L64 62 M64 54 L56 62" stroke="#1e3a8a" strokeLinecap="round" strokeWidth="1.25" />
        <circle cx="60" cy="58" fill="#1e40af" r="2" />
      </g>

      {/* Bud accent */}
      <path d="M60 34 C54 40 54 48 60 52 C66 48 66 40 60 34Z" fill="#7dd3fc" opacity="0.85" />
    </svg>
  )
}
