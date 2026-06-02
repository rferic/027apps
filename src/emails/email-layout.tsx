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
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://027apps.vercel.app'
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
                      <img src={`${base}/logo.svg`} alt="027" width="44" height="44" style={{ display: 'block', borderRadius: 10 }} />
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
  width: 44,
  height: 44,
  borderRadius: 10,
  overflow: 'hidden',
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
