import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
} from '@react-email/components'
import type { CSSProperties } from 'react'

interface InvitationEmailProps {
  groupName: string
  inviterName: string
  inviteLink: string
  appName?: string
  locale: string
}

const year = new Date().getFullYear()

export function InvitationEmail({
  groupName,
  inviterName,
  inviteLink,
  appName = '027Apps',
  locale,
}: InvitationEmailProps) {
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
                      <span style={inviterText}>{l.inviterLine(inviterName)}</span>
                      <table cellPadding="0" cellSpacing="0" align="center">
                        <tr>
                          <td style={groupBadge}>
                            <span style={groupBadgeText}>{groupName}</span>
                          </td>
                        </tr>
                      </table>
                      <span style={introText}>{l.intro(appName)}</span>
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
                      <Link href={inviteLink} style={button}>
                        {l.cta}
                      </Link>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style={expirySection}>
                <span style={expiryText}>{l.expiry}</span>
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
                <span style={footerText}>{l.footer(appName)}</span>
                <br />
                <span style={footerCopyright}>&copy; {year} {appName}. All rights reserved.</span>
              </td>
            </tr>
          </table>
        </Container>
      </Body>
    </Html>
  )
}

const labels = (locale: string) => {
  const all: Record<string, {
    preview: string
    heading: string
    inviterLine: (n: string) => string
    intro: (a: string) => string
    cta: string
    expiry: string
    footer: (a: string) => string
  }> = {
    en: {
      preview: 'You have been invited to join a group on 027Apps',
      heading: "You're invited",
      inviterLine: (n) => `${n} has invited you to join their group on 027Apps.`,
      intro: (a) => `Together on ${a}, you'll have a shared space for apps, tasks, and more.`,
      cta: 'Accept invitation',
      expiry: 'This invitation link will expire in 7 days.',
      footer: () => 'Sent from 027Apps',
    },
    es: {
      preview: 'Te han invitado a unirte a un grupo en 027Apps',
      heading: 'Has sido invitado',
      inviterLine: (n) => `${n} te ha invitado a unirte a su grupo en 027Apps.`,
      intro: (a) => `En ${a}, compartiréis un espacio con apps, tareas y mucho más.`,
      cta: 'Aceptar invitación',
      expiry: 'Este enlace de invitación caduca en 7 días.',
      footer: () => 'Enviado desde 027Apps',
    },
    it: {
      preview: 'Sei stato invitato a unirti a un gruppo su 027Apps',
      heading: 'Sei invitato',
      inviterLine: (n) => `${n} ti ha invitato a unirti al suo gruppo su 027Apps.`,
      intro: (a) => `Su ${a}, avrete uno spazio condiviso con app, attività e molto altro.`,
      cta: 'Accetta invito',
      expiry: 'Questo link di invito scade tra 7 giorni.',
      footer: () => 'Inviato da 027Apps',
    },
    ca: {
      preview: "T'han convidat a unir-te a un grup a 027Apps",
      heading: 'Has estat convidat',
      inviterLine: (n) => `${n} t'ha convidat a unir-te al seu grup a 027Apps.`,
      intro: (a) => `A ${a}, compartireu un espai amb aplicacions, tasques i molt més.`,
      cta: "Accepta la invitació",
      expiry: "Aquest enllaç d'invitació caduca en 7 dies.",
      footer: () => 'Enviat des de 027Apps',
    },
    fr: {
      preview: 'Vous avez été invité à rejoindre un groupe sur 027Apps',
      heading: 'Vous êtes invité',
      inviterLine: (n) => `${n} vous a invité à rejoindre son groupe sur 027Apps.`,
      intro: (a) => `Sur ${a}, vous partagerez un espace avec des applications, des tâches et bien plus.`,
      cta: "Accepter l'invitation",
      expiry: "Ce lien d'invitation expire dans 7 jours.",
      footer: () => 'Envoyé depuis 027Apps',
    },
    de: {
      preview: 'Du wurdest eingeladen, einer Gruppe auf 027Apps beizutreten',
      heading: 'Du bist eingeladen',
      inviterLine: (n) => `${n} hat dich eingeladen, seiner Gruppe auf 027Apps beizutreten.`,
      intro: (a) => `Auf ${a} habt ihr einen gemeinsamen Bereich mit Apps, Aufgaben und mehr.`,
      cta: 'Einladung annehmen',
      expiry: 'Dieser Einladungslink läuft in 7 Tagen ab.',
      footer: () => 'Gesendet von 027Apps',
    },
  }
  return all[locale] ?? all.en
}

const main: CSSProperties = {
  backgroundColor: '#f1f5f9',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
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
  backgroundColor: '#0f172a',
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

const inviterText: CSSProperties = {
  color: '#475569',
  fontSize: '14px',
  lineHeight: '1.6',
  display: 'block',
  marginBottom: '14px',
}

const groupBadge: CSSProperties = {
  backgroundColor: '#e2e8f0',
  borderRadius: '6px',
  padding: '8px 20px',
  textAlign: 'center',
}

const groupBadgeText: CSSProperties = {
  color: '#0f172a',
  fontSize: '15px',
  fontWeight: '600',
}

const introText: CSSProperties = {
  color: '#64748b',
  fontSize: '13px',
  lineHeight: '1.5',
  display: 'block',
  marginTop: '14px',
}

const ctaSection: CSSProperties = {
  padding: '24px 32px 0',
}

const buttonWrapper: CSSProperties = {
  borderRadius: '8px',
  textAlign: 'center',
}

const button: CSSProperties = {
  backgroundColor: '#0f172a',
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: '600',
  padding: '13px 32px',
  textDecoration: 'none',
  textAlign: 'center',
}

const expirySection: CSSProperties = {
  padding: '16px 32px 0',
}

const expiryText: CSSProperties = {
  color: '#94a3b8',
  fontSize: '12px',
  lineHeight: '1.5',
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
