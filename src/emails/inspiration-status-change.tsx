import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
} from '@react-email/components'
import type { CSSProperties } from 'react'
import { BRAND_COLOR } from './email-layout'

interface InspirationStatusChangeEmailProps {
  requestTitle: string
  oldStatus: string
  newStatus: string
  message?: string
  requestUrl: string
  locale: string
}

const year = new Date().getFullYear()

const statusColors: Record<string, string> = {
  pending: '#F59E0B',
  reviewing: '#3B82F6',
  approved: '#10B981',
  in_progress: '#F97316',
  completed: '#7C3AED',
  rejected: '#EF4444',
  on_hold: '#6B7280',
  duplicate: '#8B5CF6',
}

const statusLabelsByLocale: Record<string, Record<string, string>> = {
  en: {
    pending: 'Pending',
    reviewing: 'In review',
    approved: 'Approved',
    in_progress: 'In progress',
    completed: 'Completed',
    rejected: 'Rejected',
    on_hold: 'On hold',
    duplicate: 'Duplicate',
  },
  es: {
    pending: 'Pendiente',
    reviewing: 'En revisión',
    approved: 'Aprobado',
    in_progress: 'En progreso',
    completed: 'Completado',
    rejected: 'Rechazado',
    on_hold: 'En espera',
    duplicate: 'Duplicado',
  },
  it: {
    pending: 'In attesa',
    reviewing: 'In revisione',
    approved: 'Approvato',
    in_progress: 'In corso',
    completed: 'Completato',
    rejected: 'Rifiutato',
    on_hold: 'In sospeso',
    duplicate: 'Duplicato',
  },
  ca: {
    pending: 'Pendent',
    reviewing: 'En revisió',
    approved: 'Aprovat',
    in_progress: 'En progrés',
    completed: 'Completat',
    rejected: 'Rebutjat',
    on_hold: 'En espera',
    duplicate: 'Duplicat',
  },
  fr: {
    pending: 'En attente',
    reviewing: 'En cours d\'examen',
    approved: 'Approuvé',
    in_progress: 'En cours',
    completed: 'Terminé',
    rejected: 'Rejeté',
    on_hold: 'En suspens',
    duplicate: 'Doublon',
  },
  de: {
    pending: 'Ausstehend',
    reviewing: 'In Prüfung',
    approved: 'Genehmigt',
    in_progress: 'In Bearbeitung',
    completed: 'Abgeschlossen',
    rejected: 'Abgelehnt',
    on_hold: 'Zurückgestellt',
    duplicate: 'Duplikat',
  },
}

function statusLabel(status: string, locale: string): string {
  return statusLabelsByLocale[locale]?.[status] ?? statusLabelsByLocale.en[status] ?? status
}

function badgeStyle(color: string): CSSProperties {
  return {
    backgroundColor: color,
    borderRadius: '6px',
    padding: '6px 14px',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: '600',
    textAlign: 'center',
    whiteSpace: 'nowrap',
  }
}

const arrowStyle: CSSProperties = {
  color: '#94a3b8',
  fontSize: '16px',
  fontWeight: '600',
  padding: '0 8px',
}

export default function InspirationStatusChangeEmail({
  requestTitle,
  oldStatus,
  newStatus,
  message,
  requestUrl,
  locale,
}: InspirationStatusChangeEmailProps) {
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
                      <span style={titleLine}>&ldquo;{requestTitle}&rdquo;</span>
                      <table cellPadding="0" cellSpacing="0" align="center" style={badgeRow}>
                        <tr>
                          <td style={badgeStyle(statusColors[oldStatus] ?? statusColors.pending)}>
                            <span>{statusLabel(oldStatus, locale)}</span>
                          </td>
                          <td style={arrowCell}>
                            <span style={arrowStyle}>&rarr;</span>
                          </td>
                          <td style={badgeStyle(statusColors[newStatus] ?? statusColors.completed)}>
                            <span>{statusLabel(newStatus, locale)}</span>
                          </td>
                        </tr>
                      </table>
                      {message && (
                        <table cellPadding="0" cellSpacing="0" style={messageTable}>
                          <tr>
                            <td style={messageCell}>
                              <span style={messageLabel}>{l.adminNote}</span>
                              <span style={messageText}>{message}</span>
                            </td>
                          </tr>
                        </table>
                      )}
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

export const STATUS_CHANGE_SUBJECT: Record<string, string> = {
  en: 'Your idea status has changed — 027apps',
  es: 'El estado de tu idea ha cambiado — 027apps',
  it: 'Lo stato della tua idea è cambiato — 027apps',
  ca: "L'estat de la teva idea ha canviat — 027apps",
  fr: 'Le statut de votre idée a changé — 027apps',
  de: 'Der Status deiner Idee hat sich geändert — 027apps',
}

const labels = (locale: string) => {
  const all: Record<
    string,
    {
      preview: string
      heading: string
      adminNote: string
      cta: string
      footer: string
    }
  > = {
    en: {
      preview: 'Your idea status has changed — 027Apps',
      heading: 'Your idea status has changed',
      adminNote: 'Note from the team:',
      cta: 'View details',
      footer: 'Sent from 027Apps',
    },
    es: {
      preview: 'El estado de tu idea ha cambiado — 027Apps',
      heading: 'El estado de tu idea ha cambiado',
      adminNote: 'Nota del equipo:',
      cta: 'Ver detalles',
      footer: 'Enviado desde 027Apps',
    },
    it: {
      preview: 'Lo stato della tua idea è cambiato — 027Apps',
      heading: 'Lo stato della tua idea è cambiato',
      adminNote: 'Nota del team:',
      cta: 'Vedi dettagli',
      footer: 'Inviato da 027Apps',
    },
    ca: {
      preview: "L'estat de la teva idea ha canviat — 027Apps",
      heading: "L'estat de la teva idea ha canviat",
      adminNote: "Nota de l'equip:",
      cta: 'Veure detalls',
      footer: 'Enviat des de 027Apps',
    },
    fr: {
      preview: 'Le statut de votre idée a changé — 027Apps',
      heading: 'Le statut de votre idée a changé',
      adminNote: "Note de l'équipe :",
      cta: 'Voir les détails',
      footer: 'Envoyé depuis 027Apps',
    },
    de: {
      preview: 'Der Status deiner Idee hat sich geändert — 027Apps',
      heading: 'Der Status deiner Idee hat sich geändert',
      adminNote: 'Hinweis vom Team:',
      cta: 'Details ansehen',
      footer: 'Gesendet von 027Apps',
    },
  }
  return all[locale] ?? all.en
}

// ── Shared styles ────────────────────────────────────────────────────

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
  backgroundColor: BRAND_COLOR,
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

const titleLine: CSSProperties = {
  color: '#0f172a',
  fontSize: '15px',
  fontWeight: '600',
  lineHeight: '1.5',
  display: 'block',
  marginBottom: '16px',
}

const badgeRow: CSSProperties = {
  width: 'auto',
  borderCollapse: 'separate',
  borderSpacing: '0',
}

const arrowCell: CSSProperties = {
  verticalAlign: 'middle',
}

const messageTable: CSSProperties = {
  width: '100%',
  marginTop: '16px',
  borderCollapse: 'separate',
  borderSpacing: '0',
}

const messageCell: CSSProperties = {
  backgroundColor: '#f1f5f9',
  borderRadius: '6px',
  padding: '14px 16px',
  textAlign: 'left',
}

const messageLabel: CSSProperties = {
  color: '#64748b',
  fontSize: '12px',
  fontWeight: '600',
  display: 'block',
  marginBottom: '6px',
}

const messageText: CSSProperties = {
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
