import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
} from '@react-email/components'
import type { CSSProperties } from 'react'

interface Props {
  authorName: string
  title: string
  description: string
  requestUrl: string
  appName?: string
  appLogoUrl?: string
  locale: string
}

const year = new Date().getFullYear()

const labels = (locale: string) => {
  const all: Record<string, { preview: string; heading: string; cta: string; footer: string; noDesc: string; via: string }> = {
    en: {
      preview: 'New idea submitted — 027Apps',
      heading: 'New idea submitted',
      cta: 'View idea',
      footer: 'Sent from 027Apps',
      noDesc: '(no description)',
      via: 'via',
    },
    es: {
      preview: 'Nueva idea publicada — 027Apps',
      heading: 'Nueva idea publicada',
      cta: 'Ver idea',
      footer: 'Enviado desde 027Apps',
      noDesc: '(sin descripción)',
      via: 'vía',
    },
    it: {
      preview: 'Nuova idea pubblicata — 027Apps',
      heading: 'Nuova idea pubblicata',
      cta: 'Vedi idea',
      footer: 'Inviato da 027Apps',
      noDesc: '(nessuna descrizione)',
      via: 'tramite',
    },
    ca: {
      preview: 'Nova idea publicada — 027Apps',
      heading: 'Nova idea publicada',
      cta: 'Veure idea',
      footer: 'Enviat des de 027Apps',
      noDesc: '(sense descripció)',
      via: 'a través de',
    },
    fr: {
      preview: 'Nouvelle idée soumise — 027Apps',
      heading: 'Nouvelle idée soumise',
      cta: "Voir l'idée",
      footer: 'Envoyé depuis 027Apps',
      noDesc: '(aucune description)',
      via: 'via',
    },
    de: {
      preview: 'Neue Idee eingereicht — 027Apps',
      heading: 'Neue Idee eingereicht',
      cta: 'Idee ansehen',
      footer: 'Gesendet von 027Apps',
      noDesc: '(keine Beschreibung)',
      via: 'via',
    },
  }
  return all[locale] ?? all.en
}

export const NEW_IDEA_SUBJECT: Record<string, string> = {
  en: 'New idea: {title}',
  es: 'Nueva idea: {title}',
  it: 'Nuova idea: {title}',
  ca: 'Nova idea: {title}',
  fr: 'Nouvelle idée : {title}',
  de: 'Neue Idee: {title}',
}

export default function InspirationNewIdeaEmail({ authorName, title, description, requestUrl, appName, appLogoUrl, locale }: Props) {
  const l = labels(locale)

  return (
    <Html>
      <Head />
      <Preview>{l.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <table cellPadding="0" cellSpacing="0" style={tableInner}>
            <tr>
              <td style={headerBar}>&nbsp;</td>
            </tr>
            <tr>
              <td align="center" style={logoSection}>
                <table cellPadding="0" cellSpacing="0">
                  <tr>
                    <td style={logoBadge}>
                      <span style={logoText}>027</span>
                    </td>
                    <td style={logoPlus}>
                      <span style={plusText}>+</span>
                    </td>
                    <td>
                      <table cellPadding="0" cellSpacing="0">
                        <tr>
                          <td style={appBadge}>
                            {appLogoUrl ? (
                              <img src={appLogoUrl} alt={appName ?? ''} width="36" height="36" style={{ display: 'block', borderRadius: 6 }} />
                            ) : (
                              <span style={appBadgeText}>{appName?.slice(0, 2).toUpperCase() ?? '?'}</span>
                            )}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style={contentSection}>
                <h1 style={h1}>{l.heading}</h1>
                <p style={paragraph}>
                  <strong>{authorName}</strong> {appName ? `${l.via} ${appName}` : ''}
                </p>
                <table cellPadding="0" cellSpacing="0" style={ideaBox}>
                  <tr>
                    <td style={ideaBoxInner}>
                      <p style={ideaTitle}>{title}</p>
                      {description ? (
                        <p style={ideaDesc}>{description}</p>
                      ) : (
                        <p style={ideaDescMuted}>{l.noDesc}</p>
                      )}
                    </td>
                  </tr>
                </table>
                <table cellPadding="0" cellSpacing="0" style={ctaSection}>
                  <tr>
                    <td align="center">
                      <Link href={requestUrl} style={ctaButton}>
                        {l.cta}
                      </Link>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style={footerSection}>
                <p style={footerText}>{l.footer}</p>
              </td>
            </tr>
          </table>
        </Container>
      </Body>
    </Html>
  )
}

const main: CSSProperties = {
  backgroundColor: '#f4f4f5',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
  padding: '24px 12px',
}

const container: CSSProperties = {
  maxWidth: 520,
  margin: '0 auto',
}

const tableInner: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  backgroundColor: '#ffffff',
  borderRadius: 12,
  overflow: 'hidden',
}

const headerBar: CSSProperties = {
  height: 4,
  backgroundColor: '#7C3AED',
}

const logoSection: CSSProperties = {
  padding: '32px 32px 0',
}

const logoBadge: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 10,
  backgroundColor: '#7C3AED',
  textAlign: 'center' as const,
  verticalAlign: 'middle' as const,
}

const logoText: CSSProperties = {
  color: '#ffffff',
  fontSize: 16,
  fontWeight: 700,
  lineHeight: '44px',
}

const logoPlus: CSSProperties = {
  padding: '0 8px',
  verticalAlign: 'middle' as const,
}

const plusText: CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: '#a1a1aa',
}

const appBadge: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 8,
  backgroundColor: '#e4e4e7',
  textAlign: 'center' as const,
  verticalAlign: 'middle' as const,
}

const appBadgeText: CSSProperties = {
  color: '#52525b',
  fontSize: 13,
  fontWeight: 700,
  lineHeight: '36px',
}

const contentSection: CSSProperties = {
  padding: '24px 32px',
}

const h1: CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  color: '#18181b',
  margin: '0 0 12px',
}

const paragraph: CSSProperties = {
  fontSize: 14,
  color: '#52525b',
  lineHeight: '20px',
  margin: '0 0 16px',
}

const ideaBox: CSSProperties = {
  width: '100%',
  backgroundColor: '#f4f4f5',
  borderRadius: 8,
  marginBottom: 20,
}

const ideaBoxInner: CSSProperties = {
  padding: '12px 16px',
}

const ideaTitle: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: '#18181b',
  margin: '0 0 6px',
}

const ideaDesc: CSSProperties = {
  fontSize: 13,
  color: '#52525b',
  lineHeight: '18px',
  margin: 0,
}

const ideaDescMuted: CSSProperties = {
  fontSize: 13,
  color: '#a1a1aa',
  fontStyle: 'italic',
  margin: 0,
}

const ctaSection: CSSProperties = {
  padding: '4px 0 0',
}

const ctaButton: CSSProperties = {
  display: 'inline-block',
  padding: '10px 24px',
  backgroundColor: '#7C3AED',
  color: '#ffffff',
  fontSize: 14,
  fontWeight: 600,
  borderRadius: 8,
  textDecoration: 'none',
}

const footerSection: CSSProperties = {
  padding: '16px 32px',
  borderTop: '1px solid #e4e4e7',
}

const footerText: CSSProperties = {
  fontSize: 12,
  color: '#a1a1aa',
  textAlign: 'center' as const,
  margin: 0,
}
