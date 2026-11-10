import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 20, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  }
}

export function WhatsAppIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 11.6a8 8 0 0 1-11.8 7L4 20l1.4-4.1A8 8 0 1 1 20 11.6Z" />
      <path d="M9 8.5c.3-.6 1.1-.7 1.4-.2l.8 1.2c.2.3.1.7-.2.9l-.5.4c.4 1 1.2 1.8 2.2 2.2l.4-.5c.2-.3.6-.4.9-.2l1.2.8c.5.3.4 1.1-.2 1.4-.7.4-1.6.5-2.4.2-1.8-.6-3.2-2-3.8-3.8-.3-.8-.2-1.7.2-2.4Z" />
    </svg>
  )
}

export function MapPinIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

export function StoreIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 10v9h16v-9" />
      <path d="M3 10l2-6h14l2 6" />
      <path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
      <path d="M10 19v-5h4v5" />
    </svg>
  )
}

export function ExternalLinkIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" />
    </svg>
  )
}
