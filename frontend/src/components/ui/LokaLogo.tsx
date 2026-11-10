import Link from 'next/link'

interface LokaLogoProps {
  light?: boolean
  href?: string
  className?: string
}

export function LokaLogo({ light = false, href = '/', className = '' }: LokaLogoProps) {
  return (
    <Link
      href={href}
      className={`logo ${light ? 'logo--light' : ''} ${className}`.trim()}
      aria-label="LOKA, kembali ke beranda"
    >
      <span className="logo__mark" aria-hidden="true">
        <span />
        <span />
      </span>
      <span>LOKA</span>
    </Link>
  )
}
