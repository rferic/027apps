import type { Metadata } from "next";
import Link from "next/link";
import "./landing.css";
import { s } from "@/lib/landing-style";

export const metadata: Metadata = {
  title: "027Apps \u2014 your family app",
  description:
    "A self-hostable modular platform for families: finances, members and modules on your phone.",
};

/** Static landing ported from the approved mockup (docs/mockups/landing). */
export default function LandingPage() {
  return (
    <div className="lp dark v2 app-landing">
      <div className="wrap">
        <nav className="nav">
          <a className="brand lockup" href="#">
            <svg
              className="pulse"
              viewBox="0 0 48 26"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline
                points="2,14 9,14 11.5,10 14,14 17,14 18.5,16.5 20.5,1.5 22.5,23 25,14 27,10.5 29.5,14 46,14"
                transform="translate(0,-1)"
              />
            </svg>
            <img
              src="/brand/wordmark-bare-dark.svg"
              alt="027Apps"
              height="22"
            />
          </a>
          <div className="links">
            <a href="#modulos">Modules</a>
            <Link href="/self-host">Self-host</Link>
            <a href="#android">Android</a>
          </div>
          <div className="actions">
            <details className="lang">
              <summary aria-label="Language">EN ▾</summary>
              <div className="lang-menu">
                <a href="#" aria-current="true">
                  Español
                </a>
                <a href="#" aria-current="true">English</a>
                <a href="#">Català</a>
                <a href="#">Galego</a>
                <a href="#">Euskara</a>
                <a href="#">Português</a>
                <a href="#">Français</a>
                <a href="#">Italiano</a>
                <a href="#">Deutsch</a>
              </div>
            </details>
            <a
              className="btn ghost icon-btn"
              href="https://github.com/rferic/027apps"
              aria-label="GitHub"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.57 2.34 1.12 2.91.85.09-.66.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05a9.4 9.4 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.6.69.49A10.02 10.02 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z" />
              </svg>
            </a>
            <Link className="btn primary" href="/login">
              Open panel
            </Link>
          </div>
        </nav>
      </div>

      <header className="center-hero">
        <div className="hero-glow"></div>
        <div className="wrap" style={s("position: relative")}>
          <span
            className="badge"
            style={s(
              "display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--border); border-radius: 999px; padding: 5px 12px; font-size: 11px; color: var(--muted)",
            )}
          >
            <b style={s("color: #1cc29f")}>●</b> MIT · Self-hostable · 9 languages
          </span>
          <h1>
            The app for
            <br />
            <span style={s("color: #1cc29f")}>your family.</span>
          </h1>
          <p className="lead">
            Finances, categories and members on your phone. One instance you own, without ads or a closed platform.
          </p>
          <div className="hero-actions">
            <a
              className="btn primary"
              href="https://github.com/rferic/027apps/releases"
            >
              Download app
            </a>
            <a className="btn ghost" href="https://github.com/rferic/027apps">
              View on GitHub
            </a>
          </div>
          <p style={s("margin-top: 14px")}>
            <span className="note-pill">
              <b>●</b> App in development · these screens are the planned design
            </span>
          </p>

          <div className="tabs">
            <span className="on">Overview</span>
            <span>Finances</span>
            <span>Categories</span>
            <span>Members</span>
            <span>Modules</span>
          </div>

          <div className="phones">
            <div className="phone lg">
              <div className="notch"></div>
              <div className="screen">
                <div className="ph-head">
                  <span>Finances</span>
                  <span>ER</span>
                </div>
                <div className="ph-card">
                  <div className="k">Balance this month</div>
                  <div className="v teal">1.842,50 €</div>
                </div>
                <div className="ph-card">
                  <div className="k">Spending by category</div>
                  <div className="ph-bars">
                    <i style={s("height: 42%")}></i>
                    <i style={s("height: 68%")}></i>
                    <i className="hi" style={s("height: 92%")}></i>
                    <i style={s("height: 50%")}></i>
                    <i style={s("height: 74%")}></i>
                    <i style={s("height: 34%")}></i>
                  </div>
                </div>
                <div className="ph-list">
                  <div className="ph-item">
                    <span className="ph-dot">H</span>
                    <span className="who">Mortgage</span>
                    <span className="amt neg">−820,00 €</span>
                  </div>
                  <div className="ph-item">
                    <span className="ph-dot">C</span>
                    <span className="who">School</span>
                    <span className="amt neg">−240,00 €</span>
                  </div>
                  <div className="ph-item">
                    <span className="ph-dot">N</span>
                    <span className="who">Salary</span>
                    <span className="amt pos">+2.400,00 €</span>
                  </div>
                </div>
                <div className="ph-tabs">
                  <b>Home</b>
                  <span>Categories</span>
                  <span>Members</span>
                  <span>Modules</span>
                </div>
              </div>
            </div>
            <div className="phone lg">
              <div className="notch"></div>
              <div className="screen">
                <div className="ph-head">
                  <span>Members</span>
                  <span>4</span>
                </div>
                <div className="ph-list">
                  <div className="ph-item">
                    <span className="mini-avatar">ER</span>
                    <span className="who">Eric</span>
                    <span className="amt">super_admin</span>
                  </div>
                  <div className="ph-item">
                    <span className="mini-avatar">MR</span>
                    <span className="who">Marta</span>
                    <span className="amt">admin</span>
                  </div>
                  <div className="ph-item">
                    <span className="mini-avatar">LR</span>
                    <span className="who">Lucas</span>
                    <span className="amt">user</span>
                  </div>
                  <div className="ph-item">
                    <span className="mini-avatar">NR</span>
                    <span className="who">Nora</span>
                    <span className="amt">user</span>
                  </div>
                </div>
                <div className="ph-card" style={s("margin-top: 10px")}>
                  <div className="k">Categories</div>
                  <div className="v">3</div>
                </div>
                <div className="ph-tabs">
                  <span>Home</span>
                  <span>Categories</span>
                  <b>Members</b>
                  <span>Modules</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="section" id="modulos">
        <div className="wrap">
          <div className="section-head">
            <h2 className="display">
              The app,
              <br />
              <span className="dim">inside.</span>
            </h2>
            <span className="index">01–04 / APP MODULES</span>
          </div>

          <div className="feature-rows">
            <article className="feature-row">
              <div className="copy">
                <p className="eyebrow">
                  <strong>01</strong> / FINANCES
                </p>
                <h3>The family money, clear.</h3>
                <p>
                  Expenses and income in your currency and format. Every category with its budget and history, no spreadsheets.
                </p>
              </div>
              <div className="visual">
                <div className="phone">
                  <div className="notch"></div>
                  <div className="screen">
                    <div className="ph-head">
                      <span>This month</span>
                      <span>ER</span>
                    </div>
                    <div className="ph-card">
                      <div className="k">Balance</div>
                      <div className="v teal">1.842,50 €</div>
                    </div>
                    <div className="ph-card">
                      <div className="k">Home · 62%</div>
                      <div className="ph-bars">
                        <i className="hi" style={s("height: 62%")}></i>
                        <i style={s("height: 26%")}></i>
                        <i style={s("height: 18%")}></i>
                        <i style={s("height: 12%")}></i>
                      </div>
                    </div>
                    <div className="ph-list">
                      <div className="ph-item">
                        <span className="ph-dot">H</span>
                        <span className="who">Mortgage</span>
                        <span className="amt neg">−820,00 €</span>
                      </div>
                      <div className="ph-item">
                        <span className="ph-dot">L</span>
                        <span className="who">Utilities</span>
                        <span className="amt neg">−64,20 €</span>
                      </div>
                    </div>
                    <div className="ph-tabs">
                      <b>Home</b>
                      <span>Categories</span>
                      <span>Members</span>
                      <span>Modules</span>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            <article className="feature-row flip">
              <div className="copy">
                <p className="eyebrow">
                  <strong>02</strong> / CATEGORIES
                </p>
                <h3>Every group, with its permissions.</h3>
                <p>
                  Home, school, leisure — whatever you need. Each category groups its members and decides what each one sees.
                </p>
              </div>
              <div className="visual">
                <div className="phone">
                  <div className="notch"></div>
                  <div className="screen">
                    <div className="ph-head">
                      <span>Categories</span>
                      <span>+</span>
                    </div>
                    <div className="ph-card">
                      <div className="k">Home</div>
                      <div className="v">3 members</div>
                    </div>
                    <div className="ph-card">
                      <div className="k">School</div>
                      <div className="v">2 members</div>
                    </div>
                    <div className="ph-card">
                      <div className="k">Ocio</div>
                      <div className="v">4 members</div>
                    </div>
                    <div className="ph-tabs">
                      <span>Home</span>
                      <b>Categories</b>
                      <span>Members</span>
                      <span>Modules</span>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            <article className="feature-row">
              <div className="copy">
                <p className="eyebrow">
                  <strong>03</strong> / MEMBERS
                </p>
                <h3>Invite, don&apos;t create by hand.</h3>
                <p>
                  Your family joins with an invitation. Pick their role and category; the rest comes with it.
                </p>
              </div>
              <div className="visual">
                <div className="phone">
                  <div className="notch"></div>
                  <div className="screen">
                    <div className="ph-head">
                      <span>Members</span>
                      <span>4</span>
                    </div>
                    <div className="ph-list">
                      <div className="ph-item">
                        <span className="mini-avatar">ER</span>
                        <span className="who">Eric</span>
                        <span className="amt">super_admin</span>
                      </div>
                      <div className="ph-item">
                        <span className="mini-avatar">MR</span>
                        <span className="who">Marta</span>
                        <span className="amt">admin</span>
                      </div>
                      <div className="ph-item">
                        <span className="mini-avatar">LR</span>
                        <span className="who">Lucas</span>
                        <span className="amt">user</span>
                      </div>
                      <div className="ph-item">
                        <span className="mini-avatar">NR</span>
                        <span className="who">Nora</span>
                        <span className="amt">user</span>
                      </div>
                    </div>
                    <div className="ph-tabs">
                      <span>Home</span>
                      <span>Categories</span>
                      <b>Members</b>
                      <span>Modules</span>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            <article className="feature-row flip">
              <div className="copy">
                <p className="eyebrow">
                  <strong>04</strong> / MODULES
                </p>
                <h3>Turn on only what you use.</h3>
                <p>
                  Finances, categories, API… Modules switch on and off without touching the rest. The app shows only what is active.
                </p>
              </div>
              <div className="visual">
                <div className="phone">
                  <div className="notch"></div>
                  <div className="screen">
                    <div className="ph-head">
                      <span>Modules</span>
                      <span>4/6</span>
                    </div>
                    <div className="ph-toggle">
                      <span className="who">Finances</span>
                      <span className="ph-switch on"></span>
                    </div>
                    <div className="ph-toggle">
                      <span className="who">Categories</span>
                      <span className="ph-switch on"></span>
                    </div>
                    <div className="ph-toggle">
                      <span className="who">Members</span>
                      <span className="ph-switch on"></span>
                    </div>
                    <div className="ph-toggle">
                      <span className="who">API v1</span>
                      <span className="ph-switch"></span>
                    </div>
                    <div className="ph-toggle">
                      <span className="who">Notifications</span>
                      <span className="ph-switch"></span>
                    </div>
                    <div className="ph-tabs">
                      <span>Home</span>
                      <span>Categories</span>
                      <span>Members</span>
                      <b>Modules</b>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="section" id="panel">
        <div className="wrap split">
          <div>
            <p className="eyebrow">
              <strong>05</strong> / THE PANEL
            </p>
            <h2 className="display" style={s("margin-top: 16px")}>
              The desktop
              <br />
              <span className="dim">side.</span>
            </h2>
            <p className="lead" style={s("font-size: 16px")}>
              Members, invitations, categories, modules, API keys and MCP. The panel lives in the browser and is where everything is set up.
            </p>
            <div className="hero-actions">
              <Link className="btn primary" href="/self-host">
                Self-host the project
              </Link>
              <a className="btn ghost" href="https://github.com/rferic/027apps">
                View on GitHub
              </a>
            </div>
          </div>
          <div className="window">
            <div className="bar">
              <i></i>
              <i></i>
              <i></i>
            </div>
            <div
              className="screen"
              style={s("grid-template-columns: 110px 1fr; min-height: 300px")}
            >
              <div className="side" style={s("padding: 10px 8px")}>
                <div className="dot on"></div>
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
              <div className="main" style={s("padding: 14px")}>
                <div className="topbar">
                  <span className="title">Home</span>
                  <span className="pill">Todo listo</span>
                  <span className="avatar">ER</span>
                </div>
                <div className="kpis">
                  <div className="card">
                    <div className="k">Members</div>
                    <div className="v">4</div>
                  </div>
                  <div className="card">
                    <div className="k">Invitaciones</div>
                    <div className="v">1</div>
                  </div>
                </div>
                <div className="card">
                  <div className="k">Modules activos</div>
                  <div className="v">6</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="android">
        <div className="wrap android-close">
          <div>
            <p className="eyebrow">
              <strong>08</strong> / ANDROID
            </p>
            <h2 className="display" style={s("margin-top: 16px")}>
              The same app,
              <br />
              <span className="dim">in your pocket.</span>
            </h2>
            <p className="lead" style={s("font-size: 16px")}>
              The app is in development. The signed APK will be published on GitHub Releases and can be downloaded without an account.
            </p>
            <div className="hero-actions">
              <a
                className="btn primary"
                href="https://github.com/rferic/027apps/releases"
              >
                Download app
              </a>
              <a className="btn ghost" href="https://github.com/rferic/027apps">
                Code on GitHub
              </a>
            </div>
          </div>
          <div className="phone">
            <div className="notch"></div>
            <div className="screen">
              <div className="ph-head">
                <span>027Apps</span>
                <span>ER</span>
              </div>
              <div className="ph-card">
                <div className="k">Balance this month</div>
                <div className="v teal">1.842,50 €</div>
              </div>
              <div className="ph-card">
                <div className="k">Members</div>
                <div className="v">4</div>
              </div>
              <div className="ph-card">
                <div className="k">Modules activos</div>
                <div className="v">6</div>
              </div>
              <div className="ph-tabs">
                <b>Home</b>
                <span>Members</span>
                <span>Modules</span>
                <span>Settings</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="faq">
        <div className="wrap">
          <div className="section-head">
            <h2 className="display">
              Questions
              <br />
              <span className="dim">frequently asked.</span>
            </h2>
            <span className="index">07 / FAQ</span>
          </div>
          <div className="faq">
            <details open>
              <summary>How much does it cost?</summary>
              <p>
                027Apps is MIT and self-hosted: no subscription. You pay for your hosting (the Vercel and Supabase free tiers are enough for a family).
              </p>
            </details>
            <details>
              <summary>Where is my data?</summary>
              <p>
                In your instance: your Supabase project and your domain. No ads, no profiles, no server of ours in between.
              </p>
            </details>
            <details>
              <summary>How do I join?</summary>
              <p>
                With an invitation from the admin. The link opens the app, you choose a password and you are in; there is no public signup.
              </p>
            </details>
            <details>
              <summary>Is the app available?</summary>
              <p>
                It is in development. When there is a release, the signed APK will be on GitHub Releases and can be downloaded without an account.
              </p>
            </details>
            <details>
              <summary>In which languages?</summary>
              <p>
                Nine: English, Spanish, Catalan, Galician, Basque, Portuguese, French, Italian and German.
              </p>
            </details>
          </div>
        </div>
      </section>

      <footer className="wrap footer">
        <div className="row">
          <span className="lockup footer-brand">
            <svg
              className="pulse"
              viewBox="0 0 48 26"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline
                points="2,14 9,14 11.5,10 14,14 17,14 18.5,16.5 20.5,1.5 22.5,23 25,14 27,10.5 29.5,14 46,14"
                transform="translate(0,-1)"
              />
            </svg>
            <img
              src="/brand/wordmark-bare-dark.svg"
              alt="027Apps"
              height="17"
            />
          </span>
          <span>
            <a href="https://github.com/rferic/027apps">GitHub</a> ·{" "}
            <Link href="/self-host">Self-host</Link> ·{" "}
            <Link href="/login">Open panel</Link> · MIT
          </span>
        </div>
        <div className="row" style={s("margin-top: 14px; opacity: .8")}>
          <span>Your group, your apps, your data.</span>
          <span>Made for your family.</span>
        </div>
      </footer>
    </div>
  );
}
