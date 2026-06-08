import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
} from '@react-email/components'
import type { CSSProperties } from 'react'

interface TodoAssignedEmailProps {
  taskTitle: string
  groupName: string
  assignedBy: string
  todoUrl: string
  appName?: string
}

const year = new Date().getFullYear()

export function TodoAssignedEmail({
  taskTitle,
  groupName,
  assignedBy,
  todoUrl,
  appName = '027Apps',
}: TodoAssignedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>You have been assigned a task: {taskTitle}</Preview>
      <Body style={main}>
        <Container style={container}>
          <table cellPadding="0" cellSpacing="0" style={tableInner}>
            <tr><td style={headerBar}>&nbsp;</td></tr>
            <tr>
              <td align="center" style={logoSection}>
                <table cellPadding="0" cellSpacing="0"><tr><td style={logoBadge}><span style={logoText}>027</span></td></tr></table>
              </td>
            </tr>
            <tr>
              <td align="center" style={headingSection}>
                <span style={heading}>Task assigned to you</span>
              </td>
            </tr>
            <tr>
              <td align="center" style={cardTd}>
                <table cellPadding="0" cellSpacing="0" style={cardTable}>
                  <tr>
                    <td align="center" style={cardPadding}>
                      <span style={inviterText}>{assignedBy} assigned you a task in {groupName}:</span>
                      <table cellPadding="0" cellSpacing="0" align="center">
                        <tr><td style={groupBadge}><span style={groupBadgeText}>{taskTitle}</span></td></tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style={ctaSection}>
                <table cellPadding="0" cellSpacing="0" align="center">
                  <tr><td style={buttonWrapper}><Link href={todoUrl} style={button}>View task</Link></td></tr>
                </table>
              </td>
            </tr>
            <tr><td style={hrSection}><table cellPadding="0" cellSpacing="0" style={hrTable}><tr><td style={hrLine}>&nbsp;</td></tr></table></td></tr>
            <tr>
              <td align="center" style={footerSection}>
                <span style={footerText}>Sent from {appName}</span><br />
                <span style={footerCopyright}>&copy; {year} {appName}. All rights reserved.</span>
              </td>
            </tr>
          </table>
        </Container>
      </Body>
    </Html>
  )
}

const main: CSSProperties = { backgroundColor: '#f1f5f9', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif', padding: '0', margin: '0' }
const container: CSSProperties = { backgroundColor: '#ffffff', margin: '0 auto', maxWidth: '520px', width: '100%' }
const tableInner: CSSProperties = { width: '100%', borderCollapse: 'collapse' }
const headerBar: CSSProperties = { backgroundColor: '#0f172a', height: '4px', fontSize: '1px', lineHeight: '1px' }
const logoSection: CSSProperties = { padding: '32px 32px 0' }
const logoBadge: CSSProperties = { backgroundColor: '#9B1C1C', borderRadius: '12px', padding: '8px 14px 6px', textAlign: 'center' }
const logoText: CSSProperties = { color: '#ffffff', fontSize: '18px', fontWeight: '800', letterSpacing: '3px' }
const headingSection: CSSProperties = { padding: '20px 32px 0' }
const heading: CSSProperties = { color: '#0f172a', fontSize: '22px', fontWeight: '700', lineHeight: '1.3' }
const cardTd: CSSProperties = { padding: '16px 32px 0' }
const cardTable: CSSProperties = { width: '100%', backgroundColor: '#f8fafc', borderCollapse: 'separate', borderSpacing: '0', border: '1px solid #e2e8f0', borderRadius: '8px' }
const cardPadding: CSSProperties = { padding: '20px', textAlign: 'center' }
const inviterText: CSSProperties = { color: '#475569', fontSize: '14px', lineHeight: '1.6', display: 'block', marginBottom: '14px' }
const groupBadge: CSSProperties = { backgroundColor: '#e2e8f0', borderRadius: '6px', padding: '8px 20px', textAlign: 'center' }
const groupBadgeText: CSSProperties = { color: '#0f172a', fontSize: '15px', fontWeight: '600' }
const ctaSection: CSSProperties = { padding: '24px 32px 0' }
const buttonWrapper: CSSProperties = { borderRadius: '8px', textAlign: 'center' }
const button: CSSProperties = { backgroundColor: '#0f172a', borderRadius: '8px', color: '#ffffff', display: 'inline-block', fontSize: '14px', fontWeight: '600', padding: '13px 32px', textDecoration: 'none', textAlign: 'center' }
const hrSection: CSSProperties = { padding: '24px 32px 0' }
const hrTable: CSSProperties = { width: '100%', borderCollapse: 'collapse' }
const hrLine: CSSProperties = { height: '1px', backgroundColor: '#e2e8f0', fontSize: '1px', lineHeight: '1px' }
const footerSection: CSSProperties = { padding: '16px 32px 32px' }
const footerText: CSSProperties = { color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }
const footerCopyright: CSSProperties = { color: '#cbd5e1', fontSize: '11px' }

export default TodoAssignedEmail
