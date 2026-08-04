import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  amount?: string
  description?: string
  approved?: boolean
  note?: string
  approvalsUrl?: string
}

export function PaymentApprovalDecisionEmail({
  amount = '$0.00',
  description = 'your payment',
  approved = true,
  note = '',
  approvalsUrl = 'https://cognito-finance-core.lovable.app/approvals',
}: Props) {
  const headline = approved ? 'Your payment was approved' : 'Your payment was denied'
  return (
    <Html>
      <Head />
      <Preview>{`${amount} — ${approved ? 'approved' : 'denied'}`}</Preview>
      <Body style={body}>
        <Container style={card}>
          <Text style={brand}>Glass Bank</Text>
          <Heading style={h1}>{headline}</Heading>
          <Text style={text}>
            {approved
              ? 'The account owner approved this payment and it has been sent.'
              : 'The account owner did not approve this payment. No money was moved.'}
          </Text>
          <Section style={panel}>
            <Text style={amountStyle}>{amount}</Text>
            <Text style={muted}>{description}</Text>
            {note ? <Text style={muted}>Note: {note}</Text> : null}
          </Section>
          <Link href={approvalsUrl} style={button}>
            View details
          </Link>
          <Hr style={hr} />
          <Text style={footer}>
            This is an automated notification about activity on your Glass Bank
            business account.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const body = { backgroundColor: '#0a0a0a', fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif', margin: 0, padding: '32px 0' }
const card = { backgroundColor: '#141414', border: '1px solid #262626', borderRadius: '18px', margin: '0 auto', maxWidth: '480px', padding: '32px' }
const brand = { color: '#c4f542', fontSize: '13px', fontWeight: 700, letterSpacing: '0.12em', margin: '0 0 20px', textTransform: 'uppercase' as const }
const h1 = { color: '#fafafa', fontSize: '22px', fontWeight: 600, lineHeight: '1.3', margin: '0 0 12px' }
const text = { color: '#a3a3a3', fontSize: '15px', lineHeight: '1.6', margin: '0 0 20px' }
const panel = { backgroundColor: '#0f0f0f', border: '1px solid #262626', borderRadius: '12px', padding: '20px', marginBottom: '24px' }
const amountStyle = { color: '#fafafa', fontSize: '30px', fontWeight: 700, margin: '0 0 4px' }
const muted = { color: '#8a8a8a', fontSize: '14px', margin: '0 0 2px' }
const button = { backgroundColor: '#c4f542', borderRadius: '999px', color: '#0a0a0a', display: 'inline-block', fontSize: '15px', fontWeight: 600, padding: '13px 26px', textDecoration: 'none' }
const hr = { borderColor: '#262626', margin: '28px 0 16px' }
const footer = { color: '#6b6b6b', fontSize: '12px', lineHeight: '1.6', margin: 0 }

export const template = {
  component: PaymentApprovalDecisionEmail,
  displayName: 'Payment approval decision',
  subject: (data: Record<string, unknown>) =>
    `${(data?.amount as string) ?? 'Your payment'} was ${data?.approved ? 'approved' : 'denied'}`,
  previewData: {
    amount: '$12,500.00',
    description: 'Wire to Acme Supply Co.',
    approved: true,
    note: '',
    approvalsUrl: 'https://cognito-finance-core.lovable.app/approvals',
  },
} satisfies TemplateEntry
