import Link from "next/link";
import { GitHubIcon } from "@/components/landing/github-icon";
import { LocaleSync } from "@/components/landing/locale-sync";
import { TechIcon, type TechName } from "@/components/landing/tech-icon";
import { LANDING_LANGUAGES, languageLabel, landingHref, translator, type LandingPage } from "@/lib/landing/i18n";
import { s } from "@/lib/landing-style";
import type { Locale } from "@027apps/i18n/types.js";

/** Static landing ported from the approved mockup (docs/mockups/landing). */
export function SelfHostLanding({ locale }: { locale: Locale }) {
  const t = translator(locale);
  const page: LandingPage = "selfhost";
  return (
    <div className="lp dark v2 selfhost">
      <LocaleSync locale={locale} />
      <div className="wrap">
        <nav className="nav">
          <Link className="brand lockup" href={landingHref(locale, "app")}>
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
          </Link>
          <div className="links">
            <Link href={landingHref(locale, "app")}>{t("Family app")}</Link>
            <a href="#tecnologias">{t("Technologies")}</a>
            <a href="#montarlo">{t("How to set it up")}</a>
            <a href="https://github.com/rferic/027apps/blob/main/docs/self-hosting.md">{t("Documentation")}{" "}</a>
          </div>
          <div className="actions">
            <details className="lang">
              <summary aria-label={t("Language")}>{languageLabel(locale)} ▾</summary>
              <div className="lang-menu">
                {LANDING_LANGUAGES.map(({ code, label }) => (
                  <a
                    key={code}
                    href={landingHref(code, page)}
                    hrefLang={code}
                    aria-current={code === locale ? "true" : undefined}
                  >
                    {label}
                  </a>
                ))}
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
            <Link className="btn primary" href="/panel" prefetch={false}>{t("Open panel")}</Link>
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
            <b style={s("color: #1cc29f")}>●</b>{" "}{t("MIT · Next.js + Supabase · Documentation included")}{" "}</span>
          <h1>{t("Your own")}{" "}<br />
            <span style={s("color: #1cc29f")}>{t("instance.")}</span>
          </h1>
          <p className="lead">{t("The desktop panel, API v1 and the MCP server. Run 027Apps on your Vercel and Supabase; your data stays home.")}{" "}</p>
          <div className="hero-actions">
            <a
              className="btn primary"
              href="https://github.com/rferic/027apps/blob/main/docs/self-hosting.md"
            >{t("Self-hosting guide")}{" "}</a>
            <a className="btn ghost" href="https://github.com/rferic/027apps">
              <GitHubIcon />{" "}{t("View on GitHub")}{" "}</a>
          </div>
          <p className="sub">
            {t("For the family there is an app ·")}{" "}
            <Link href={landingHref(locale, "app")} style={s("color: #1cc29f")}>{t("see the app →")}{" "}</Link>
          </p>
        </div>
      </header>

      <div className="wrap app-shot" style={s("margin-top: 8px")}>
        <div className="window app2">
          <div className="bar">
            <i></i>
            <i></i>
            <i></i>
          </div>
          <div className="screen">
            <aside className="side">
              <div className="side-brand">
                {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
                <img src="/brand/wordmark-bare-dark.svg" alt="" />
              </div>
              <a className="nav-item on">
                <span className="bullet"></span>{t("Home")}{" "}</a>
              <a className="nav-item">
                <span className="bullet"></span>{t("Members")}{" "}</a>
              <a className="nav-item">
                <span className="bullet"></span>{t("Categories")}{" "}</a>
              <a className="nav-item">
                <span className="bullet"></span>{t("Invitations")}{" "}</a>
              <a className="nav-item">
                <span className="bullet"></span>{t("Modules")}{" "}</a>
              <a className="nav-item">
                <span className="bullet"></span>{t("API keys")}{" "}</a>
              <a className="nav-item">
                <span className="bullet"></span>{t("Settings")}{" "}</a>
              <div className="side-foot">Eric · super_admin</div>
            </aside>
            <div className="main">
              <div className="topbar">
                <span className="title">{t("Home")}</span>
                <span className="pill">{t("Everything ready")}</span>
                <span className="search">{t("Search…")}</span>
                <span className="avatar">ER</span>
              </div>
              <div className="kpis">
                <div className="card">
                  <div className="k">{t("Balance this month")}</div>
                  <div className="v teal">1.842,50 €</div>
                </div>
                <div className="card">
                  <div className="k">{t("Members")}</div>
                  <div className="v">4</div>
                </div>
                <div className="card">
                  <div className="k">{t("Active modules")}</div>
                  <div className="v">6</div>
                </div>
              </div>
              <div className="content-grid">
                <div className="card">
                  <div className="k">{t("Spending by category")}</div>
                  <div className="chart">
                    <i style={s("height: 38%")}></i>
                    <i style={s("height: 62%")}></i>
                    <i className="hi" style={s("height: 90%")}></i>
                    <i style={s("height: 48%")}></i>
                    <i style={s("height: 72%")}></i>
                    <i style={s("height: 30%")}></i>
                    <i style={s("height: 55%")}></i>
                    <i style={s("height: 44%")}></i>
                  </div>
                  <div className="legend">
                    <span>
                      <i style={s("background:#1cc29f")}></i>{t("Home")}{" "}</span>
                    <span>
                      <i style={s("background:#2f333a")}></i>{t("Leisure")}{" "}</span>
                    <span>
                      <i style={s("background:#2f333a")}></i>{t("School")}{" "}</span>
                  </div>
                </div>
                <div className="card">
                  <div className="k">{t("Members")}</div>
                  <div className="list-row">
                    <span className="mini-avatar">ER</span>
                    <span className="who">Eric</span>
                    <span className="role">super_admin</span>
                  </div>
                  <div className="list-row">
                    <span className="mini-avatar">MR</span>
                    <span className="who">Marta</span>
                    <span className="role">admin</span>
                  </div>
                  <div className="list-row">
                    <span className="mini-avatar">LR</span>
                    <span className="who">Lucas</span>
                    <span className="role">user</span>
                  </div>
                  <div className="list-row">
                    <span className="mini-avatar">NR</span>
                    <span className="who">Nora</span>
                    <span className="role">user</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="section" id="incluye" style={s("margin-top: 56px")}>
        <div className="wrap">
          <div className="section-head">
            <h2 className="display">{t("What you get")}{" "}<br />
              <span className="dim">{t("from one instance.")}</span>
            </h2>
            <span className="index">{t("01–09 / INCLUDED")}</span>
          </div>
          <div className="grid-3">
            <article className="module">
              <div className="ico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18M16 15h2" />
                </svg>
              </div>
              <h3>{t("Finances")}{" "}<span className="soon">{t("Soon")}</span></h3>
              <p>{t("Currencies, budgets per category and the family history.")}</p>
            </article>
            <article className="module">
              <div className="ico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 16 9 5 9-5" />
                </svg>
              </div>
              <h3>{t("Categories")}</h3>
              <p>{t("Groups, their members and the permissions of each one.")}</p>
            </article>
            <article className="module">
              <div className="ico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c.6-3.2 2.7-5 5.5-5s4.9 1.8 5.5 5" /><circle cx="17" cy="9" r="2.4" /><path d="M15.4 14.6c2.6-.3 4.4 1.3 5.1 4.4" />
                </svg>
              </div>
              <h3>{t("Members")}</h3>
              <p>{t("Roles, invitations and deactivation from one list.")}</p>
            </article>
            <article className="module">
              <div className="ico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.6" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.6" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
                </svg>
              </div>
              <h3>{t("Modules")}</h3>
              <p>{t("Turn modules on and off and grant them per member.")}</p>
            </article>
            <article className="module">
              <div className="ico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" />
                </svg>
              </div>
              <h3>API v1</h3>
              <p>{t("Keys with scopes to integrate the app, scripts or third parties.")}</p>
            </article>
            <article className="module">
              <div className="ico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 1.5" />
                </svg>
              </div>
              <h3>{t("MCP server")}</h3>
              <p>{t("Connect agents with OAuth and scoped permissions.")}</p>
            </article>
            <article className="module">
              <div className="ico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M10.5 5h3" />
                </svg>
              </div>
              <h3>{t("Android app")}{" "}<span className="soon">{t("In development")}</span></h3>
              <p>{t("The same instance for the family, on the phone.")}</p>
            </article>
            <article className="module">
              <div className="ico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 19h16" />
                </svg>
              </div>
              <h3>{t("Backups")}</h3>
              <p>{t("Daily encrypted dump and a restore drill.")}</p>
            </article>
            <article className="module">
              <div className="ico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.3 3.8 5.2 3.8 8.5s-1.3 6.2-3.8 8.5c-2.5-2.3-3.8-5.2-3.8-8.5S9.5 5.8 12 3.5Z" />
                </svg>
              </div>
              <h3>{t("9 languages")}</h3>
              <p>{t("Interface and emails localized from day one.")}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section" id="tecnologias">
        <div className="wrap">
          <div className="section-head">
            <h2 className="display">{t("Built")}{" "}<br />
              <span className="dim">{t("on proven technology.")}</span>
            </h2>
            <span className="index">{t("02 / TECHNOLOGIES")}</span>
          </div>
          <div className="tech-grid">
            <div className="tech">
              <span className="tech-icon"><TechIcon name="next" /></span>
              <span className="tech-body"><b>Next.js 16</b><span>{t("Web panel and API v1")}</span></span>
              <img className="tech-logo" src="/logos/nextdotjs.svg" alt="" width="20" height="20" />
            </div>
            <div className="tech">
              <span className="tech-icon"><TechIcon name="typescript" /></span>
              <span className="tech-body"><b>React 19 + TypeScript</b><span>{t("End-to-end typed interface")}</span></span>
              <img className="tech-logo" src="/logos/react.svg" alt="" width="20" height="20" />
            </div>
            <div className="tech">
              <span className="tech-icon"><TechIcon name="supabase" /></span>
              <span className="tech-body"><b>Supabase</b><span>{t("Postgres, Auth, Realtime and Storage")}</span></span>
              <img className="tech-logo" src="/logos/supabase.svg" alt="" width="20" height="20" />
            </div>
            <div className="tech">
              <span className="tech-icon"><TechIcon name="tailwind" /></span>
              <span className="tech-body"><b>Tailwind CSS</b><span>{t("Design with semantic tokens")}</span></span>
              <img className="tech-logo" src="/logos/tailwindcss.svg" alt="" width="20" height="20" />
            </div>
            <div className="tech">
              <span className="tech-icon"><TechIcon name="kotlin" /></span>
              <span className="tech-body"><b>Kotlin + Compose</b><span>{t("Native Android app")}</span></span>
              <img className="tech-logo" src="/logos/kotlin.svg" alt="" width="20" height="20" />
            </div>
            <div className="tech">
              <span className="tech-icon"><TechIcon name="pnpm" /></span>
              <span className="tech-body"><b>pnpm monorepo</b><span>{t("Core, i18n, admin and Android")}</span></span>
              <img className="tech-logo" src="/logos/pnpm.svg" alt="" width="20" height="20" />
            </div>
            <div className="tech">
              <span className="tech-icon"><TechIcon name="vercel" /></span>
              <span className="tech-body"><b>Vercel</b><span>{t("Deploy and functions in the EU")}</span></span>
              <img className="tech-logo" src="/logos/vercel.svg" alt="" width="20" height="20" />
            </div>
            <div className="tech">
              <span className="tech-icon"><TechIcon name="resend" /></span>
              <span className="tech-body"><b>Resend</b><span>{t("Invitations and transactional email")}</span></span>
              <img className="tech-logo" src="/logos/resend.svg" alt="" width="20" height="20" />
            </div>
            <div className="tech">
              <span className="tech-icon"><TechIcon name="mit" /></span>
              <span className="tech-body"><b>MIT</b><span>{t("Free license, no small print")}</span></span>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="montarlo">
        <div className="wrap">
          <div className="section-head">
            <h2 className="display">{t("Four steps.")}{" "}<br />
              <span className="dim">{t("One instance.")}</span>
            </h2>
            <span className="index">{t("03 / HOW TO SET IT UP")}</span>
          </div>
          <div className="steps">
            <div className="step">
              <b>1</b>
              <h3>{t("Clone the repo")}</h3>
              <p>
                <code>git clone</code>{" "}{t("and")}{" "}<code>pnpm install</code>{t(". The whole monorepo, app included.")}{" "}</p>
            </div>
            <div className="step">
              <b>2</b>
              <h3>{t("Create Supabase")}</h3>
              <p>{t("A Postgres + Auth project and its keys. Migrations included.")}{" "}</p>
            </div>
            <div className="step">
              <b>3</b>
              <h3>{t("Configure and migrate")}</h3>
              <p>{t("Environment variables,")}{" "}<code>db push</code>{" "}{t("and the first super_admin with the wizard.")}{" "}</p>
            </div>
            <div className="step">
              <b>4</b>
              <h3>{t("Deploy")}</h3>
              <p>{t("Vercel, domain and email with Resend. The family joins by invitation.")}{" "}</p>
            </div>
          </div>
          <div className="term" style={s("margin-top: 22px")}>
            <span>$</span> git clone <b>https://github.com/rferic/027apps</b>
            <br />
            <span>{t("# full guide: docs/self-hosting.md")}</span>
          </div>
        </div>
      </section>

      <section className="section" id="arquitectura">
        <div className="wrap split">
          <div>
            <p className="eyebrow">
              <strong>04</strong>{" / "}{t("ARCHITECTURE")}
            </p>
            <h2 className="display" style={s("margin-top: 16px")}>{t("All together,")}{" "}<br />
              <span className="dim">{t("no surprises.")}</span>
            </h2>
            <p className="lead" style={s("font-size: 16px")}>{t("A panel to administer, an API to integrate and an app for the family. Everything talks to your database.")}{" "}</p>
            <ul className="check-list">
              <li>
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="m3 8.5 3 3 7-7" />
                </svg>{t("Invitation-only signup")}{" "}</li>
              <li>
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="m3 8.5 3 3 7-7" />
                </svg>{t("Roles and permissions per category")}{" "}</li>
              <li>
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="m3 8.5 3 3 7-7" />
                </svg>{t("Daily encrypted backups")}{" "}</li>
              <li>
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="m3 8.5 3 3 7-7" />
                </svg>{t("No ads or third parties")}{" "}</li>
            </ul>
          </div>
          <div className="panel">
            <div className="arch">
              <div className="box">
                <b>{t("Web panel")}</b>
                <span>Next.js</span>
              </div>
              <span className="arrow">→</span>
              <div className="box">
                <b>API v1</b>
                <span>{t("keys and sessions")}</span>
              </div>
              <span className="arrow">→</span>
              <div className="box">
                <b>Postgres</b>
                <span>Supabase</span>
              </div>
            </div>
            <div className="arch">
              <div className="box">
                <b>{t("Android app")}</b>
                <span>Kotlin</span>
              </div>
              <span className="arrow">→</span>
              <div className="box">
                <b>API v1</b>
                <span>Bearer</span>
              </div>
            </div>
            <div className="arch">
              <div className="box">
                <b>MCP</b>
                <span>{t("agents")}</span>
              </div>
              <span className="arrow">→</span>
              <div className="box">
                <b>API v1</b>
                <span>OAuth</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="faq">
        <div className="wrap">
          <div className="section-head">
            <h2 className="display">{t("Questions")}{" "}<br />
              <span className="dim">{t("technical.")}</span>
            </h2>
            <span className="index">{t("05 / FAQ")}</span>
          </div>
          <div className="faq">
            <details open>
              <summary>{t("What do I need to set it up?")}</summary>
              <p>{t("A Supabase project (Postgres + Auth) and a Vercel account, or your own server. The repository guide covers keys, migrations, domain, email and the first admin.")}{" "}</p>
            </details>
            <details>
              <summary>{t("How much does it cost?")}</summary>
              <p>{t("The license is MIT: no subscription. You pay for your hosting; the Vercel and Supabase free tiers are enough for a family.")}{" "}</p>
            </details>
            <details>
              <summary>{t("How do I update it?")}</summary>
              <p>{t("Same flow as development:")}{" "}<code>git pull</code>{t(", migrations and deploy. CI applies the migrations per environment.")}{" "}</p>
            </details>
            <details>
              <summary>{t("Where is the data?")}</summary>
              <p>{t("In your Supabase project and your domain. No servers of ours in between and no third-party analytics.")}{" "}</p>
            </details>
            <details>
              <summary>{t("And the family app?")}</summary>
              <p>{t("It is the other side: download it from GitHub Releases and it talks to your instance through API v1. The panel remains the desktop part.")}{" "}</p>
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
            <a href="https://github.com/rferic/027apps/blob/main/docs/self-hosting.md">{t("Guide")}{" "}</a>{" "}
            · <Link href={landingHref(locale, "app")}>{t("App")}</Link> · <Link href="/panel" prefetch={false}>{t("Open panel")}</Link> · MIT
          </span>
        </div>
        <div className="row" style={s("margin-top: 14px; opacity: .8")}>
          <span>{t("Your group, your apps, your data.")}</span>
          <span>{t("Made for your family.")}</span>
        </div>
      </footer>
    </div>
  );
}
