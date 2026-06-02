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

interface InspirationClosureEmailProps {
  requestTitle: string
  requestDescription: string
  closureMessage?: string
  appName?: string
  appUrl?: string
  locale: string
}

const year = new Date().getFullYear()

export default function InspirationClosureEmail({
  requestTitle,
  requestDescription,
  closureMessage,
  appName,
  appUrl,
  locale,
}: InspirationClosureEmailProps) {
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
                <span style={closureHeading}>{l.heading}</span>
              </td>
            </tr>
            <tr>
              <td align="center" style={cardTd}>
                <table cellPadding="0" cellSpacing="0" style={cardTable}>
                  <tr>
                    <td style={cardPaddingClosure}>
                      <span style={requestTitleStyle}>
                        &ldquo;{requestTitle}&rdquo;
                      </span>

                      <span style={sectionLabel}>{l.whatYouAsked}</span>
                      <span style={descriptionText}>{requestDescription}</span>

                      <span style={sectionLabel}>{l.whatWasDone}</span>
                      <span style={descriptionText}>
                        {closureMessage || l.defaultClosure}
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            {appName && appUrl && (
              <tr>
                <td align="center" style={appBadgeTd}>
                  <table cellPadding="0" cellSpacing="0" align="center">
                    <tr>
                      <td style={appBadge}>
                        <span style={appBadgeLabel}>{l.appCreated}</span>
                        <Link href={appUrl} style={appBadgeLink}>
                          {appName} &rarr;
                        </Link>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            )}
            <tr>
              <td align="center" style={ctaSection}>
                <table cellPadding="0" cellSpacing="0" align="center">
                  <tr>
                    <td style={buttonWrapper}>
                      <Link href={appUrl || 'https://027apps.com'} style={button}>
                        {appName && appUrl ? l.ctaApp : l.ctaDefault}
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
              <td align="center" style={thankYouSection}>
                <span style={thankYouText}>{l.thankYou}</span>
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

export const CLOSURE_SUBJECT: Record<string, string> = {
  en: "Your idea '{title}' has been completed! — 027apps",
  es: "¡Tu idea '{title}' ha sido completada! — 027apps",
  it: "La tua idea '{title}' è stata completata! — 027apps",
  ca: "La teva idea '{title}' ha estat completada! — 027apps",
  fr: "Votre idée '{title}' a été réalisée ! — 027apps",
  de: "Deine Idee '{title}' wurde umgesetzt! — 027apps",
}

const labels = (locale: string) => {
  const all: Record<
    string,
    {
      preview: string
      heading: string
      whatYouAsked: string
      whatWasDone: string
      defaultClosure: string
      appCreated: string
      ctaApp: string
      ctaDefault: string
      thankYou: string
      footer: string
    }
  > = {
    en: {
      preview: 'Your idea has been completed! — 027Apps',
      heading: '\u{1F389} Your idea has become reality!',
      whatYouAsked: 'What you asked for:',
      whatWasDone: "What we've done:",
      defaultClosure:
        "We've reviewed your idea and made it happen! Thank you for contributing to 027apps.",
      appCreated: 'App created:',
      ctaApp: 'Check it out',
      ctaDefault: 'View in 027apps',
      thankYou: 'Thank you for helping make 027apps better!',
      footer: 'Sent from 027Apps',
    },
    es: {
      preview: '¡Tu idea ha sido completada! — 027Apps',
      heading: '\u{1F389} ¡Tu idea se ha hecho realidad!',
      whatYouAsked: 'Lo que pediste:',
      whatWasDone: 'Lo que se ha hecho:',
      defaultClosure:
        '¡Hemos revisado tu idea y la hemos hecho realidad! Gracias por contribuir a 027apps.',
      appCreated: 'App creada:',
      ctaApp: 'Ver la app',
      ctaDefault: 'Ver en 027apps',
      thankYou: '¡Gracias por ayudar a mejorar 027apps!',
      footer: 'Enviado desde 027Apps',
    },
    it: {
      preview: 'La tua idea è stata completata! — 027Apps',
      heading: '\u{1F389} La tua idea è diventata realtà!',
      whatYouAsked: 'Cosa hai chiesto:',
      whatWasDone: "Cosa è stato fatto:",
      defaultClosure:
        'Abbiamo esaminato la tua idea e l\'abbiamo realizzata! Grazie per aver contribuito a 027apps.',
      appCreated: 'App creata:',
      ctaApp: 'Dai un\'occhiata',
      ctaDefault: 'Vedi su 027apps',
      thankYou: 'Grazie per aver contribuito a migliorare 027apps!',
      footer: 'Inviato da 027Apps',
    },
    ca: {
      preview: 'La teva idea ha estat completada! — 027Apps',
      heading: '\u{1F389} La teva idea s\'ha fet realitat!',
      whatYouAsked: 'El que vas demanar:',
      whatWasDone: 'El que s\'ha fet:',
      defaultClosure:
        'Hem revisat la teva idea i l\'hem feta realitat! Gràcies per contribuir a 027apps.',
      appCreated: 'App creada:',
      ctaApp: 'Veure l\'app',
      ctaDefault: 'Veure a 027apps',
      thankYou: 'Gràcies per ajudar a millorar 027apps!',
      footer: 'Enviat des de 027Apps',
    },
    fr: {
      preview: 'Votre idée a été réalisée ! — 027Apps',
      heading: '\u{1F389} Votre idée est devenue réalité !',
      whatYouAsked: 'Ce que vous avez demandé :',
      whatWasDone: 'Ce qui a été fait :',
      defaultClosure:
        'Nous avons examiné votre idée et l\'avons réalisée ! Merci d\'avoir contribué à 027apps.',
      appCreated: 'App créée :',
      ctaApp: 'Voir l\'app',
      ctaDefault: 'Voir sur 027apps',
      thankYou: 'Merci d\'aider à améliorer 027apps !',
      footer: 'Envoyé depuis 027Apps',
    },
    de: {
      preview: 'Deine Idee wurde umgesetzt! — 027Apps',
      heading: '\u{1F389} Deine Idee ist Wirklichkeit geworden!',
      whatYouAsked: 'Was du vorgeschlagen hast:',
      whatWasDone: 'Was daraus geworden ist:',
      defaultClosure:
        'Wir haben deine Idee geprüft und umgesetzt! Danke, dass du zu 027apps beigetragen hast.',
      appCreated: 'Erstellte App:',
      ctaApp: 'App ansehen',
      ctaDefault: 'Auf 027apps ansehen',
      thankYou: 'Danke, dass du 027apps besser machst!',
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
  padding: '24px 32px 0',
}

const closureHeading: CSSProperties = {
  color: '#0f172a',
  fontSize: '24px',
  fontWeight: '700',
  lineHeight: '1.3',
}

const cardTd: CSSProperties = {
  padding: '20px 32px 0',
}

const cardTable: CSSProperties = {
  width: '100%',
  backgroundColor: '#f8fafc',
  borderCollapse: 'separate',
  borderSpacing: '0',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
}

const cardPaddingClosure: CSSProperties = {
  padding: '24px',
  textAlign: 'left',
}

const requestTitleStyle: CSSProperties = {
  color: '#0f172a',
  fontSize: '16px',
  fontWeight: '600',
  lineHeight: '1.5',
  display: 'block',
  marginBottom: '20px',
  textAlign: 'center',
}

const sectionLabel: CSSProperties = {
  color: '#7C3AED',
  fontSize: '12px',
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  display: 'block',
  marginBottom: '6px',
  marginTop: '16px',
}

const descriptionText: CSSProperties = {
  color: '#475569',
  fontSize: '13px',
  lineHeight: '1.7',
}

const appBadgeTd: CSSProperties = {
  padding: '16px 32px 0',
}

const appBadge: CSSProperties = {
  backgroundColor: '#F5F3FF',
  border: '1px solid #C4B5FD',
  borderRadius: '8px',
  padding: '14px 24px',
  textAlign: 'center',
}

const appBadgeLabel: CSSProperties = {
  color: '#6D28D9',
  fontSize: '12px',
  fontWeight: '600',
  display: 'block',
  marginBottom: '4px',
}

const appBadgeLink: CSSProperties = {
  color: '#7C3AED',
  fontSize: '15px',
  fontWeight: '700',
  textDecoration: 'none',
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

const thankYouSection: CSSProperties = {
  padding: '16px 32px 0',
}

const thankYouText: CSSProperties = {
  color: '#7C3AED',
  fontSize: '14px',
  fontWeight: '600',
  lineHeight: '1.5',
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
