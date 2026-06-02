import { Link } from '@react-email/components'
import type { CSSProperties } from 'react'
import EmailLayout from './email-layout'

interface Props {
  authorName: string
  title: string
  description: string
  requestUrl: string
  assignedAppName?: string
  assignedAppLogoUrl?: string
  locale: string
  logoDataUri: string
  appLogoDataUri: string
}

const APP_SLUG = 'inspiration'
const APP_NAME = 'Inspiration'
const APP_PRIMARY = '#7C3AED'

export const NEW_IDEA_SUBJECT: Record<string, string> = {
  en: 'New idea: {title}',
  es: 'Nueva idea: {title}',
  it: 'Nuova idea: {title}',
  ca: 'Nova idea: {title}',
  fr: 'Nouvelle idée : {title}',
  de: 'Neue Idee: {title}',
}

const labels: Record<string, { preview: string; heading: string; cta: string; noDesc: string; from: string }> = {
  en: { preview: 'New idea submitted — 027Apps', heading: 'New idea submitted', cta: 'View idea', noDesc: '(no description)', from: 'from {author} via Inspiration' },
  es: { preview: 'Nueva idea publicada — 027Apps', heading: 'Nueva idea publicada', cta: 'Ver idea', noDesc: '(sin descripción)', from: 'de {author} vía Inspiration' },
  it: { preview: 'Nuova idea pubblicata — 027Apps', heading: 'Nuova idea pubblicata', cta: 'Vedi idea', noDesc: '(nessuna descrizione)', from: 'da {author} tramite Inspiration' },
  ca: { preview: 'Nova idea publicada — 027Apps', heading: 'Nova idea publicada', cta: 'Veure idea', noDesc: '(sense descripció)', from: 'de {author} via Inspiration' },
  fr: { preview: 'Nouvelle idée soumise — 027Apps', heading: 'Nouvelle idée soumise', cta: "Voir l'idée", noDesc: '(aucune description)', from: 'de {author} via Inspiration' },
  de: { preview: 'Neue Idee eingereicht — 027Apps', heading: 'Neue Idee eingereicht', cta: 'Idee ansehen', noDesc: '(keine Beschreibung)', from: 'von {author} via Inspiration' },
}

function t(locale: string, key: string): string {
  const l = labels[locale] ?? labels.en
  return (l as Record<string, string>)[key] ?? key
}

export default function InspirationNewIdeaEmail({ authorName, title, description, requestUrl, assignedAppName, assignedAppLogoUrl, locale, logoDataUri, appLogoDataUri }: Props) {
  const heading = t(locale, 'heading')
  const ctaLabel = t(locale, 'cta')
  const noDesc = t(locale, 'noDesc')
  const rawFrom = t(locale, 'from')

  return (
    <EmailLayout preview={t(locale, 'preview')} appSlug={APP_SLUG} appName={APP_NAME} appPrimaryColor={APP_PRIMARY} locale={locale} logoDataUri={logoDataUri} appLogoDataUri={appLogoDataUri}>
      <h1 style={h1}>{heading}</h1>
      <p style={paragraph}>
        {(() => {
          const parts = rawFrom.split('{author}')
          const nodes: React.ReactNode[] = []
          parts.forEach((p, i) => {
            if (i > 0) nodes.push(<strong key={`s${i}`}>{authorName}</strong>)
            if (p) nodes.push(<span key={`p${i}`}>{p}</span>)
          })
          return nodes
        })()}
      </p>

      <table cellPadding="0" cellSpacing="0" style={ideaBox}>
        <tr>
          <td style={ideaBoxInner}>
            <p style={ideaTitle}>{title}</p>
            {description ? (
              <p style={ideaDesc}>{description}</p>
            ) : (
              <p style={ideaDescMuted}>{noDesc}</p>
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
              {ctaLabel}
            </Link>
          </td>
        </tr>
      </table>
    </EmailLayout>
  )
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

const ctaSection: CSSProperties = {
  padding: '4px 0 0',
}

const ctaButton: CSSProperties = {
  display: 'inline-block',
  padding: '10px 24px',
  color: '#ffffff',
  fontSize: 14,
  fontWeight: 600,
  borderRadius: 8,
  textDecoration: 'none',
}
