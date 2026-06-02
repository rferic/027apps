import {
  Body,
  Container,
  Head,
  Html,
  Preview,
} from '@react-email/components'
import type { CSSProperties, ReactNode } from 'react'

interface Props {
  children: ReactNode
  preview: string
  appSlug: string
  appName: string
  appPrimaryColor: string
  locale: string
}

const footerLabels: Record<string, string> = {
  en: 'Sent from 027Apps',
  es: 'Enviado desde 027Apps',
  it: 'Inviato da 027Apps',
  ca: 'Enviat des de 027Apps',
  fr: 'Envoyé depuis 027Apps',
  de: 'Gesendet von 027Apps',
}

export default function EmailLayout({ children, preview, appSlug, appName, appPrimaryColor, locale }: Props) {
  const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : null
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? vercelUrl ?? 'https://027apps.vercel.app'
  const appLogoUrl = `${base}/api/apps/${appSlug}/logo`
  const footer = footerLabels[locale] ?? footerLabels.en

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <table cellPadding="0" cellSpacing="0" style={tableInner}>
            <tr>
              <td style={{ ...headerBar, backgroundColor: appPrimaryColor }}>&nbsp;</td>
            </tr>
            <tr>
              <td align="center" style={logoSection}>
                <table cellPadding="0" cellSpacing="0">
                  <tr>
                    <td style={badge}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="44" height="44" style={{ display: 'block' }}>
                        <rect width="56" height="56" rx="11" fill={appPrimaryColor} />
                        <polyline points="7,22 14,22 16.5,18 19,22 22,22 23.5,25 25.5,10 27.5,32 30,22 32,18 34.5,22 49,22" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <text x="28" y="46" fontFamily="apple-system,BlinkMacSystemFont,sans-serif" fontSize="10" fontWeight="800" fill="rgba(255,255,255,0.75)" textAnchor="middle" letterSpacing="2.5">027</text>
                      </svg>
                    </td>
                    <td style={plusSpacer}>
                      <span style={plusText}>+</span>
                    </td>
                    <td>
                      <table cellPadding="0" cellSpacing="0">
                        <tr>
                          <td style={{ ...iconBox, backgroundColor: appPrimaryColor + '20' }}>
                            <img src={appLogoUrl} alt={appName} width="36" height="36" style={{ display: 'block', borderRadius: 6 }} />
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
                {children}
              </td>
            </tr>
            <tr>
              <td style={footerSection}>
                <p style={footerText}>{footer}</p>
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
}

const logoSection: CSSProperties = {
  padding: '32px 32px 0',
}

const badge: CSSProperties = {
  borderRadius: 10,
}

const plusSpacer: CSSProperties = {
  padding: '0 8px',
  verticalAlign: 'middle' as const,
}

const plusText: CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: '#a1a1aa',
}

const iconBox: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 8,
  textAlign: 'center' as const,
  verticalAlign: 'middle' as const,
}

const contentSection: CSSProperties = {
  padding: '24px 32px',
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
