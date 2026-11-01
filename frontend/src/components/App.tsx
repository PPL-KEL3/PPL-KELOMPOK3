'use client'

import { useState, type ReactNode } from 'react'

const heroImage =
  'https://images.unsplash.com/photo-1622572771591-6ca7813cc39d?auto=format&fit=crop&w=1400&q=85'
const communityImage =
  'https://images.unsplash.com/photo-1572402123736-c79526db405a?auto=format&fit=crop&w=1200&q=85'

type IconName =
  | 'arrow'
  | 'check'
  | 'community'
  | 'income'
  | 'menu'
  | 'need'
  | 'potential'
  | 'spark'
  | 'visibility'
  | 'x'

const iconPaths: Record<IconName, ReactNode> = {
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  community: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  income: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 6v12" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </>
  ),
  need: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4M11 8v6M8 11h6" />
    </>
  ),
  potential: (
    <>
      <path d="M12 2a7 7 0 0 0-4 12.74V18h8v-3.26A7 7 0 0 0 12 2Z" />
      <path d="M9 22h6M9 18h6" />
    </>
  ),
  spark: (
    <>
      <path d="m12 3-1.6 4.4L6 9l4.4 1.6L12 15l1.6-4.4L18 9l-4.4-1.6L12 3Z" />
      <path d="m5 15-.8 2.2L2 18l2.2.8L5 21l.8-2.2L8 18l-2.2-.8L5 15Z" />
    </>
  ),
  visibility: (
    <>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  x: (
    <>
      <path d="m6 6 12 12M18 6 6 18" />
    </>
  ),
}

function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      {iconPaths[name]}
    </svg>
  )
}

function Logo({ light = false }: { light?: boolean }) {
  return (
    <a className={`logo ${light ? 'logo--light' : ''}`} href="#beranda" aria-label="LOKA, kembali ke beranda">
      <span className="logo__mark" aria-hidden="true">
        <span />
        <span />
      </span>
      <span>LOKA</span>
    </a>
  )
}

function ButtonLink({
  children,
  href,
  variant = 'primary',
  withArrow = false,
}: {
  children: ReactNode
  href: string
  variant?: 'primary' | 'secondary' | 'light'
  withArrow?: boolean
}) {
  return (
    <a className={`button button--${variant}`} href={href}>
      <span>{children}</span>
      {withArrow && <Icon name="arrow" size={18} />}
    </a>
  )
}

const navLinks = [
  ['Beranda', '#beranda'],
  ['Tentang LOKA', '#tentang'],
  ['Cara Kerja', '#cara-kerja'],
  ['Dampak', '#dampak'],
]

function Header() {
  const [open, setOpen] = useState(false)

  return (
    <header className="site-header">
      <div className="container header__inner">
        <Logo />
        <nav className="desktop-nav" aria-label="Navigasi utama">
          {navLinks.map(([label, href]) => (
            <a href={href} key={href}>
              {label}
            </a>
          ))}
        </nav>
        <div className="header__actions">
          <ButtonLink href="#tentang">Kenali LOKA</ButtonLink>
          <button
            className="menu-button"
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Tutup menu' : 'Buka menu'}
          >
            <Icon name={open ? 'x' : 'menu'} />
          </button>
        </div>
      </div>
      <div className={`mobile-menu ${open ? 'mobile-menu--open' : ''}`} id="mobile-menu">
        <nav className="container" aria-label="Navigasi seluler">
          {navLinks.map(([label, href]) => (
            <a href={href} key={href} onClick={() => setOpen(false)}>
              {label}
              <Icon name="arrow" size={18} />
            </a>
          ))}
          <ButtonLink href="#tentang">Kenali LOKA</ButtonLink>
        </nav>
      </div>
    </header>
  )
}

function SectionIntro({
  eyebrow,
  title,
  description,
  align = 'left',
}: {
  eyebrow: string
  title: string
  description?: string
  align?: 'left' | 'center'
}) {
  return (
    <div className={`section-intro section-intro--${align}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {description && <p className="section-intro__description">{description}</p>}
    </div>
  )
}

function Hero() {
  return (
    <section className="hero" id="beranda">
      <div className="hero__texture" aria-hidden="true" />
      <div className="container hero__grid">
        <div className="hero__content">
          <div className="mission-pill">
            <span>
              <Icon name="spark" size={15} />
            </span>
            Tumbuh bersama, dari sekitar
          </div>
          <h1>
            Setiap Keahlian Punya Peluang. <em>Setiap Orang Punya Kesempatan.</em>
          </h1>
          <p className="hero__lead">
            LOKA menghubungkan masyarakat dengan penyedia jasa lokal untuk membuka peluang penghasilan dan
            memperluas akses terhadap layanan di lingkungan sekitar.
          </p>
          <div className="hero__actions">
            <ButtonLink href="#tentang" withArrow>
              Kenali LOKA
            </ButtonLink>
            <ButtonLink href="#cara-kerja" variant="secondary">
              Pelajari Cara Kerja
            </ButtonLink>
          </div>
          <div className="hero__trust">
            <div className="avatar-stack" aria-hidden="true">
              <span>AR</span>
              <span>DI</span>
              <span>NM</span>
            </div>
            <p>
              <strong>Ruang untuk bertumbuh</strong>
              <br />
              bagi potensi masyarakat lokal
            </p>
          </div>
        </div>

        <div className="hero__visual">
          <div className="hero__image-wrap">
            <img src={heroImage} alt="Pelaku usaha lokal melayani warga di sebuah kedai lingkungan" />
          </div>
          <div className="floating-card floating-card--top">
            <span className="icon-badge">
              <Icon name="community" size={20} />
            </span>
            <p>
              <strong>Dekat & relevan</strong>
              <small>Berawal dari lingkungan sekitar</small>
            </p>
          </div>
          <div className="floating-card floating-card--bottom">
            <span className="floating-card__number">01</span>
            <p>
              <strong>Potensi lokal</strong>
              <small>Lebih mudah dikenal</small>
            </p>
            <span className="mini-check">
              <Icon name="check" size={14} />
            </span>
          </div>
          <div className="hero__shape" aria-hidden="true" />
        </div>
      </div>
      <div className="container hero__footnote">
        <span>Platform untuk komunitas</span>
        <span className="line" />
        <span>Terinspirasi oleh SDG 1</span>
      </div>
    </section>
  )
}

function About() {
  return (
    <section className="section about" id="tentang">
      <div className="container about__grid">
        <div className="about__visual">
          <div className="about__image">
            <img src={communityImage} alt="Pedagang sayur lokal menata hasil bumi di pasar" />
          </div>
          <div className="about__quote">
            <span>“</span>
            <p>Keahlian yang terlihat, membuka pintu kesempatan.</p>
          </div>
          <div className="dot-pattern" aria-hidden="true" />
        </div>
        <div className="about__content">
          <SectionIntro eyebrow="Tentang LOKA" title="Menghubungkan Kebutuhan dengan Potensi Lokal." />
          <p>
            Di sekitar kita, banyak orang memiliki keterampilan yang bermanfaat—mulai dari perbaikan,
            perawatan, hingga usaha rumahan. Namun, kesempatan mereka sering terbatas karena hanya dikenal
            lewat rekomendasi dari mulut ke mulut.
          </p>
          <p>
            LOKA hadir sebagai ruang digital yang membantu potensi tersebut lebih mudah terlihat,
            dikenali, dan terhubung dengan masyarakat yang membutuhkan.
          </p>
          <div className="about__principles">
            <div>
              <Icon name="check" size={17} />
              <span>Berpihak pada potensi lokal</span>
            </div>
            <div>
              <Icon name="check" size={17} />
              <span>Mudah dipahami semua kalangan</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const steps = [
  {
    icon: 'need' as IconName,
    number: '01',
    title: 'Kenali Kebutuhan',
    copy: 'Setiap orang memiliki kebutuhan layanan sehari-hari yang berbeda di lingkungan tempat tinggalnya.',
  },
  {
    icon: 'potential' as IconName,
    number: '02',
    title: 'Temukan Potensi Lokal',
    copy: 'Pekerja dan penyedia jasa lokal memiliki keterampilan yang dapat menjawab kebutuhan tersebut.',
  },
  {
    icon: 'community' as IconName,
    number: '03',
    title: 'Terhubung dan Berkembang',
    copy: 'LOKA mempertemukan keduanya untuk membuka akses dan peluang ekonomi yang lebih luas.',
  },
]

function HowItWorks() {
  return (
    <section className="section how" id="cara-kerja">
      <div className="container">
        <SectionIntro
          eyebrow="Cara LOKA Bekerja"
          title="Sederhana, dekat, dan saling menguatkan."
          description="Sebuah jembatan yang membantu kebutuhan sehari-hari bertemu dengan keterampilan yang ada di sekitar."
          align="center"
        />
        <div className="steps">
          {steps.map((step, index) => (
            <article className="step-card" key={step.number}>
              <div className="step-card__top">
                <span className="step-card__icon">
                  <Icon name={step.icon} size={27} />
                </span>
                <span className="step-card__number">{step.number}</span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
              {index < steps.length - 1 && (
                <span className="step-connector" aria-hidden="true">
                  <Icon name="arrow" size={18} />
                </span>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

const values = [
  {
    icon: 'income' as IconName,
    title: 'Peluang Penghasilan',
    copy: 'Memperluas kesempatan masyarakat untuk memperoleh penghasilan dari keterampilan yang dimiliki.',
  },
  {
    icon: 'visibility' as IconName,
    title: 'Keterampilan Lebih Terlihat',
    copy: 'Membantu jasa dan keahlian masyarakat lokal dikenal oleh lebih banyak orang.',
  },
  {
    icon: 'community' as IconName,
    title: 'Komunitas Lebih Terhubung',
    copy: 'Mempermudah masyarakat mengenal dan mendukung potensi jasa di sekitarnya.',
  },
]

function Impact() {
  return (
    <section className="section impact" id="dampak">
      <div className="container">
        <div className="impact__header">
          <SectionIntro
            eyebrow="Pemberdayaan Komunitas"
            title="Dari Lingkungan Sekitar, Untuk Peluang yang Lebih Luas."
          />
          <p>Perubahan besar dapat dimulai dari satu koneksi yang bermakna di lingkungan terdekat.</p>
        </div>
        <div className="value-grid">
          {values.map((value) => (
            <article className="value-card" key={value.title}>
              <span className="value-card__icon">
                <Icon name={value.icon} size={26} />
              </span>
              <h3>{value.title}</h3>
              <p>{value.copy}</p>
              <span className="value-card__line" />
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function Sdg() {
  return (
    <section className="section sdg">
      <div className="container sdg__panel">
        <div className="sdg__badge" aria-label="Sustainable Development Goal 1, No Poverty">
          <span className="sdg__number">1</span>
          <span className="sdg__label">
            NO
            <br />
            POVERTY
          </span>
          <span className="sdg__symbol" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </div>
        <div className="sdg__content">
          <p className="eyebrow eyebrow--light">Selaras dengan SDG 1</p>
          <h2>Mendukung Pemberdayaan Ekonomi Menuju Indonesia Tanpa Kemiskinan.</h2>
          <p>
            LOKA mendukung semangat SDG 1 dengan membantu masyarakat lokal memperoleh visibilitas yang
            lebih baik dan akses terhadap peluang ekonomi. Kami percaya teknologi dapat menjadi jembatan
            menuju komunitas yang lebih tangguh dan inklusif.
          </p>
          <div className="sdg__note">
            <span>
              <Icon name="spark" size={18} />
            </span>
            <p>
              <strong>Kontribusi yang bertanggung jawab</strong>
              <br />
              Berfokus pada akses dan pemberdayaan, tanpa klaim dampak yang berlebihan.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function ClosingCta() {
  return (
    <section className="closing">
      <div className="closing__rings" aria-hidden="true" />
      <div className="container closing__content">
        <span className="closing__icon">
          <Icon name="spark" size={24} />
        </span>
        <h2>Potensi Lokal Layak Mendapat Kesempatan Lebih Besar.</h2>
        <p>Kenali LOKA dan bagaimana teknologi dapat membantu mempertemukan kebutuhan masyarakat dengan keterampilan lokal.</p>
        <ButtonLink href="#tentang" variant="light" withArrow>
          Kenali LOKA Lebih Dekat
        </ButtonLink>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__brand">
          <Logo light />
          <p>Ruang digital untuk menghubungkan kebutuhan masyarakat dengan potensi jasa lokal.</p>
          <span className="footer__sdg">Mendukung semangat SDG 1 — Tanpa Kemiskinan</span>
        </div>
        <div className="footer__links">
          <div>
            <h3>Navigasi</h3>
            {navLinks.map(([label, href]) => (
              <a href={href} key={href}>
                {label}
              </a>
            ))}
          </div>
          <div>
            <h3>Hubungi Kami</h3>
            <a href="mailto:halo@loka.id">halo@loka.id</a>
            <span>Indonesia</span>
          </div>
        </div>
      </div>
      <div className="container footer__bottom">
        <p>© {new Date().getFullYear()} LOKA. Tumbuh bersama potensi lokal.</p>
        <p>Dibuat untuk komunitas Indonesia.</p>
      </div>
    </footer>
  )
}

export default function App() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <About />
        <HowItWorks />
        <Impact />
        <Sdg />
        <ClosingCta />
      </main>
      <Footer />
    </>
  )
}
