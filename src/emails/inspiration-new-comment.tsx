import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
} from '@react-email/components'
import type { CSSProperties } from 'react'

interface InspirationNewCommentEmailProps {
  requestTitle: string
  commentAuthor: string
  commentSnippet: string
  requestUrl: string
  locale: string
}

const year = new Date().getFullYear()

export default function InspirationNewCommentEmail({
  requestTitle,
  commentAuthor,
  commentSnippet,
  requestUrl,
  locale,
}: InspirationNewCommentEmailProps) {
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
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style={headingSection}>
                <span style={heading}>{l.heading}</span>
              </td>
            </tr>
            <tr>
              <td align="center" style={cardTd}>
                <table cellPadding="0" cellSpacing="0" style={cardTable}>
                  <tr>
                    <td align="center" style={cardPadding}>
                      <span style={commentLine}>
                        {l.commentLine(commentAuthor, requestTitle)}
                      </span>
                      <table cellPadding="0" cellSpacing="0" style={snippetTable}>
                        <tr>
                          <td style={snippetCell}>
                            <span style={snippetText}>{commentSnippet}&hellip;</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style={ctaSection}>
                <table cellPadding="0" cellSpacing="0" align="center">
                  <tr>
                    <td style={buttonWrapper}>
                      <Link href={requestUrl} style={button}>
                        {l.cta}
                      </Link>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style={hrSection}>
                <table cellPadding="0" cellSpacing="0" style={hrTable}>
                  <tr>
                    <td style={hrLine}>&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style={footerSection}>
                <span style={footerText}>{l.footer}</span>
                <br />
                <span style={footerCopyright}>
                  &copy; {year} 027Apps. All rights reserved.
                </span>
              </td>
            </tr>
          </table>
        </Container>
      </Body>
    </Html>
  )
}

export const NEW_COMMENT_SUBJECT: Record<string, string> = {
  en: "New comment on '{title}' — 027apps",
  es: "Nuevo comentario en '{title}' — 027apps",
  it: "Nuovo commento su '{title}' — 027apps",
  ca: "Nou comentari a '{title}' — 027apps",
  fr: "Nouveau commentaire sur '{title}' — 027apps",
  de: "Neuer Kommentar zu '{title}' — 027apps",
}

const labels = (locale: string) => {
  const all: Record<
    string,
    {
      preview: string
      heading: string
      commentLine: (author: string, title: string) => string
      cta: string
      footer: string
    }
  > = {
    en: {
      preview: 'New comment on your idea — 027Apps',
      heading: 'New comment on your idea',
      commentLine: (a, t) => `${a} commented on "${t}"`,
      cta: 'View comment',
      footer: 'Sent from 027Apps',
    },
    es: {
      preview: 'Nuevo comentario en tu idea — 027Apps',
      heading: 'Nuevo comentario en tu idea',
      commentLine: (a, t) => `${a} comentó en "${t}"`,
      cta: 'Ver comentario',
      footer: 'Enviado desde 027Apps',
    },
    it: {
      preview: 'Nuovo commento sulla tua idea — 027Apps',
      heading: 'Nuovo commento sulla tua idea',
      commentLine: (a, t) => `${a} ha commentato "${t}"`,
      cta: 'Vedi commento',
      footer: 'Inviato da 027Apps',
    },
    ca: {
      preview: 'Nou comentari a la teva idea — 027Apps',
      heading: 'Nou comentari a la teva idea',
      commentLine: (a, t) => `${a} ha comentat a "${t}"`,
      cta: 'Veure comentari',
      footer: 'Enviat des de 027Apps',
    },
    fr: {
      preview: 'Nouveau commentaire sur votre idée — 027Apps',
      heading: 'Nouveau commentaire sur votre idée',
      commentLine: (a, t) => `${a} a commenté "${t}"`,
      cta: 'Voir le commentaire',
      footer: 'Envoyé depuis 027Apps',
    },
    de: {
      preview: 'Neuer Kommentar zu deiner Idee — 027Apps',
      heading: 'Neuer Kommentar zu deiner Idee',
      commentLine: (a, t) => `${a} hat "${t}" kommentiert`,
      cta: 'Kommentar ansehen',
      footer: 'Gesendet von 027Apps',
    },
  }
  return all[locale] ?? all.en
}

// ── Shared styles (matching invitation.tsx) ──────────────────────────

const main: CSSProperties = {
  backgroundColor: '#f1f5f9',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  padding: '0',
  margin: '0',
}

const container: CSSProperties = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  maxWidth: '520px',
  width: '100%',
}

const tableInner: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
}

const headerBar: CSSProperties = {
  backgroundColor: '#7C3AED',
  height: '4px',
  fontSize: '1px',
  lineHeight: '1px',
}

const logoSection: CSSProperties = {
  padding: '32px 32px 0',
}

const logoBadge: CSSProperties = {
  backgroundColor: '#9B1C1C',
  borderRadius: '12px',
  padding: '8px 14px 6px',
  textAlign: 'center',
}

const logoText: CSSProperties = {
  color: '#ffffff',
  fontSize: '18px',
  fontWeight: '800',
  letterSpacing: '3px',
}

const headingSection: CSSProperties = {
  padding: '20px 32px 0',
}

const heading: CSSProperties = {
  color: '#0f172a',
  fontSize: '22px',
  fontWeight: '700',
  lineHeight: '1.3',
}

const cardTd: CSSProperties = {
  padding: '16px 32px 0',
}

const cardTable: CSSProperties = {
  width: '100%',
  backgroundColor: '#f8fafc',
  borderCollapse: 'separate',
  borderSpacing: '0',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
}

const cardPadding: CSSProperties = {
  padding: '20px',
  textAlign: 'center',
}

const commentLine: CSSProperties = {
  color: '#475569',
  fontSize: '14px',
  lineHeight: '1.6',
  display: 'block',
  marginBottom: '16px',
}

const snippetTable: CSSProperties = {
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: '0',
}

const snippetCell: CSSProperties = {
  backgroundColor: '#f1f5f9',
  borderRadius: '6px',
  padding: '14px 16px',
  textAlign: 'left',
}

const snippetText: CSSProperties = {
  color: '#475569',
  fontSize: '13px',
  lineHeight: '1.6',
  fontStyle: 'italic',
}

const ctaSection: CSSProperties = {
  padding: '24px 32px 0',
}

const buttonWrapper: CSSProperties = {
  borderRadius: '8px',
  textAlign: 'center',
}

const button: CSSProperties = {
  backgroundColor: '#7C3AED',
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: '600',
  padding: '13px 32px',
  textDecoration: 'none',
  textAlign: 'center',
}

const hrSection: CSSProperties = {
  padding: '24px 32px 0',
}

const hrTable: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
}

const hrLine: CSSProperties = {
  height: '1px',
  backgroundColor: '#e2e8f0',
  fontSize: '1px',
  lineHeight: '1px',
}

const footerSection: CSSProperties = {
  padding: '16px 32px 32px',
}

const footerText: CSSProperties = {
  color: '#94a3b8',
  fontSize: '12px',
  display: 'block',
  marginBottom: '4px',
}

const footerCopyright: CSSProperties = {
  color: '#cbd5e1',
  fontSize: '11px',
}
