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
  assignedAppName?: string
  assignedAppLogoUrl?: string
  locale: string
}

const LOGO_DATA_URI = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1NiA1NiIgd2lkdGg9IjU2IiBoZWlnaHQ9IjU2Ij48cmVjdCB3aWR0aD0iNTYiIGhlaWdodD0iNTYiIHJ4PSIxMSIgZmlsbD0iIzlCMUMxQyIvPjxwb2x5bGluZSBwb2ludHM9IjcsMjIgMTQsMjIgMTYuNSwxOCAxOSwyMiAyMiwyMiAyMy41LDI1IDI1LjUsMTAgMjcuNSwzMiAzMCwyMiAzMiwxOCAzNC41LDIyIDQ5LDIyIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjx0ZXh0IHg9IjI4IiB5PSI0NiIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMCIgZm9udC13ZWlnaHQ9IjgwMCIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjc1KSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgbGV0dGVyLXNwYWNpbmc9IjIuNSI+MDI3PC90ZXh0Pjwvc3ZnPg=='

const APP_PRIMARY = '#7C3AED'
const APP_ICON_URL = 'https://027apps.vercel.app/api/apps/inspiration/logo'

const labels = (locale: string) => {
  const all: Record<string, { preview: string; heading: string; cta: string; footer: string; noDesc: string; from: string }> = {
    en: {
      preview: 'New idea submitted — 027Apps',
      heading: 'New idea submitted',
      cta: 'View idea',
      footer: 'Sent from 027Apps',
      noDesc: '(no description)',
      from: 'from {author} via Inspiration',
    },
    es: {
      preview: 'Nueva idea publicada — 027Apps',
      heading: 'Nueva idea publicada',
      cta: 'Ver idea',
      footer: 'Enviado desde 027Apps',
      noDesc: '(sin descripción)',
      from: 'de {author} vía Inspiration',
    },
    it: {
      preview: 'Nuova idea pubblicata — 027Apps',
      heading: 'Nuova idea pubblicata',
      cta: 'Vedi idea',
      footer: 'Inviato da 027Apps',
      noDesc: '(nessuna descrizione)',
      from: 'da {author} tramite Inspiration',
    },
    ca: {
      preview: 'Nova idea publicada — 027Apps',
      heading: 'Nova idea publicada',
      cta: 'Veure idea',
      footer: 'Enviat des de 027Apps',
      noDesc: '(sense descripció)',
      from: 'de {author} via Inspiration',
    },
    fr: {
      preview: 'Nouvelle idée soumise — 027Apps',
      heading: 'Nouvelle idée soumise',
      cta: "Voir l'idée",
      footer: 'Envoyé depuis 027Apps',
      noDesc: '(aucune description)',
      from: 'de {author} via Inspiration',
    },
    de: {
      preview: 'Neue Idee eingereicht — 027Apps',
      heading: 'Neue Idee eingereicht',
      cta: 'Idee ansehen',
      footer: 'Gesendet von 027Apps',
      noDesc: '(keine Beschreibung)',
      from: 'von {author} via Inspiration',
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

export default function InspirationNewIdeaEmail({ authorName, title, description, requestUrl, assignedAppName, assignedAppLogoUrl, locale }: Props) {
  const l = labels(locale)

  return (
    <Html>
      <Head />
      <Preview>{l.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <table cellPadding="0" cellSpacing="0" style={tableInner}>
            <tr>
              <td style={{ ...headerBar, backgroundColor: APP_PRIMARY }}>&nbsp;</td>
            </tr>
            <tr>
              <td align="center" style={logoSection}>
                <table cellPadding="0" cellSpacing="0">
                  <tr>
                    <td style={{ ...logoBadge, backgroundColor: APP_PRIMARY }}>
                      <img src={LOGO_DATA_URI} alt="027" width="44" height="44" style={{ display: 'block', borderRadius: 10 }} />
                    </td>
                    <td style={logoPlus}>
                      <span style={plusText}>+</span>
                    </td>
                    <td>
                      <table cellPadding="0" cellSpacing="0">
                        <tr>
                          <td style={{ ...appBadge, backgroundColor: APP_PRIMARY + '20' }}>
                            <img src={APP_ICON_URL} alt="Inspiration" width="36" height="36" style={{ display: 'block', borderRadius: 6 }} />
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
                  {(() => {
                    const parts = l.from.split('{author}')
                    return parts.map((p, i) => i < parts.length - 1 ? <>{p}<strong>{authorName}</strong></> : p)
                  })()}
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
                {assignedAppName && (
                  <table cellPadding="0" cellSpacing="0" style={assignedBox}>
                    <tr>
                      <td style={assignedBoxInner}>
                        <table cellPadding="0" cellSpacing="0">
                          <tr>
                            <td style={assignedIconCell}>
                              {assignedAppLogoUrl ? (
                                <img src={assignedAppLogoUrl} alt={assignedAppName} width="20" height="20" style={{ display: 'block', borderRadius: 4 }} />
                              ) : (
                                <span style={assignedIconText}>{assignedAppName.slice(0, 2).toUpperCase()}</span>
                              )}
                            </td>
                            <td style={assignedLabelCell}>
                              <span style={assignedLabel}>{assignedAppName}</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                )}
                <table cellPadding="0" cellSpacing="0" style={ctaSection}>
                  <tr>
                    <td align="center">
                      <Link href={requestUrl} style={{ ...ctaButton, backgroundColor: APP_PRIMARY }}>
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
  textAlign: 'center' as const,
  verticalAlign: 'middle' as const,
}

const assignedBox: CSSProperties = {
  width: '100%',
  marginBottom: 16,
}

const assignedBoxInner: CSSProperties = {
  backgroundColor: '#f4f4f5',
  borderRadius: 6,
  padding: '8px 12px',
}

const assignedIconCell: CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: 4,
  backgroundColor: '#e4e4e7',
  textAlign: 'center' as const,
  verticalAlign: 'middle' as const,
  paddingRight: 8,
}

const assignedIconText: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  color: '#52525b',
  lineHeight: '20px',
}

const assignedLabelCell: CSSProperties = {
  verticalAlign: 'middle' as const,
}

const assignedLabel: CSSProperties = {
  fontSize: 13,
  color: '#52525b',
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
