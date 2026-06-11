/** Shared stroke-style SVG icons (Lucide paths), sized via className. */

interface IconProps {
  className?: string
}

function Stroke({ className, children }: IconProps & { children: React.ReactNode }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function ChevronIcon({ className }: IconProps): React.JSX.Element {
  return (
    <Stroke className={className}>
      <path d="m6 9 6 6 6-6" />
    </Stroke>
  )
}

export function PlusIcon({ className }: IconProps): React.JSX.Element {
  return (
    <Stroke className={className}>
      <path d="M12 5v14M5 12h14" />
    </Stroke>
  )
}

export function XIcon({ className }: IconProps): React.JSX.Element {
  return (
    <Stroke className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Stroke>
  )
}

export function CheckIcon({ className }: IconProps): React.JSX.Element {
  return (
    <Stroke className={className}>
      <path d="M20 6 9 17l-5-5" />
    </Stroke>
  )
}

export function ArrowLeftIcon({ className }: IconProps): React.JSX.Element {
  return (
    <Stroke className={className}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </Stroke>
  )
}

export function ArrowRightIcon({ className }: IconProps): React.JSX.Element {
  return (
    <Stroke className={className}>
      <path d="M5 12h14M12 5l7 7-7 7" />
    </Stroke>
  )
}

export function ArrowUpIcon({ className }: IconProps): React.JSX.Element {
  return (
    <Stroke className={className}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </Stroke>
  )
}

export function DotsIcon({ className }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  )
}

export function GearIcon({ className }: IconProps): React.JSX.Element {
  return (
    <Stroke className={className}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </Stroke>
  )
}

/** Tiny progress ring used for topic mastery and other inline score displays. */
export function MiniRing({ pct, className }: { pct: number; className?: string }): React.JSX.Element {
  const r = 7
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 18 18" className={`-rotate-90 ${className ?? ''}`} aria-hidden="true">
      <circle cx="9" cy="9" r={r} fill="none" stroke="var(--color-cream-300)" strokeWidth="2.5" />
      <circle
        cx="9"
        cy="9"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct / 100)}
      />
    </svg>
  )
}
