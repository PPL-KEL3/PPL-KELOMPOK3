import type { ReactNode } from 'react'
import Link from 'next/link'
import { LokaLogo } from '@/components/ui/LokaLogo'
import { CheckIcon, SparkIcon } from '@/components/ui/AuthIcons'

const cookingImage =
  'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=85'
const cleaningImage =
  'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=85'

const highlights = [
  'Temukan jasa di sekitarmu.',
  'Dukung usaha dan keterampilan lokal.',
  'Bangun peluang ekonomi bersama.',
]

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <aside className="auth-brand" aria-label="Tentang LOKA">
        <div className="auth-brand__ring auth-brand__ring--one" aria-hidden="true" />
        <div className="auth-brand__ring auth-brand__ring--two" aria-hidden="true" />

        <div className="auth-brand__inner">
          <LokaLogo light />

          <div className="auth-brand__copy">
            <p className="auth-brand__eyebrow">
              <span>
                <SparkIcon size={14} />
              </span>
              Tumbuh bersama, dari sekitar
            </p>
            <h2>Temukan Jasa Lokal, Dukung Potensi Sekitar.</h2>
            <p>
              LOKA menghubungkan kamu dengan penyedia jasa lokal terpercaya untuk
              membantu memenuhi kebutuhan sehari-hari sekaligus membuka peluang
              ekonomi bagi masyarakat sekitar.
            </p>
          </div>

          <div className="auth-brand__visual" aria-hidden="true">
            <figure className="auth-brand__photo">
              <img
                src={cookingImage}
                alt=""
                loading="eager"
                referrerPolicy="no-referrer"
              />
              <figcaption className="auth-brand__badge">
                <span className="auth-brand__badge-icon">
                  <CheckIcon size={15} />
                </span>
                <span>
                  <strong>Jasa lokal terpercaya</strong>
                  <small>Dari tetangga, untuk sekitar</small>
                </span>
              </figcaption>
            </figure>
            <figure className="auth-brand__photo auth-brand__photo--small">
              <img
                src={cleaningImage}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </figure>
          </div>

          <ul className="auth-brand__highlights">
            {highlights.map((item) => (
              <li key={item}>
                <span className="auth-brand__check" aria-hidden="true">
                  <CheckIcon size={13} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-main__content">
          <div className="auth-mobile-brand">
            <LokaLogo />
            <p className="auth-mobile-brand__eyebrow">
              <SparkIcon size={13} />
              Tumbuh bersama, dari sekitar
            </p>
            <h2>Temukan Jasa Lokal, Dukung Potensi Sekitar.</h2>
            <ul>
              {highlights.slice(0, 2).map((item) => (
                <li key={item}>
                  <CheckIcon size={12} />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="auth-card">{children}</div>

          <p className="auth-copyright">
            © {new Date().getFullYear()} LOKA. Tumbuh bersama potensi lokal.
            <span>
              <Link href="/">Kembali ke beranda</Link>
            </span>
          </p>
        </div>
      </main>
    </div>
  )
}
