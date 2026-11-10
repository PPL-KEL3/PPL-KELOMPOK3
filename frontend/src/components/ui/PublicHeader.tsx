import Link from 'next/link'
import { LokaLogo } from './LokaLogo'

export function PublicHeader() {
  return (
    <header className="pub-header">
      <div className="pub-header__inner">
        <LokaLogo />
        <nav className="pub-header__actions" aria-label="Navigasi halaman publik">
          <Link href="/" className="pub-header__home">
            Beranda
          </Link>
          <Link href="/login" className="pub-header__login">
            Masuk
          </Link>
          <Link href="/register" className="pub-header__register">
            Daftar
          </Link>
        </nav>
      </div>
    </header>
  )
}
