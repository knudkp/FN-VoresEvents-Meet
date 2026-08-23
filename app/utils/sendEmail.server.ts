import type { Env } from '~/types/Env'

export async function sendSetPasswordEmail(
	env: Env,
	{
		to,
		username,
		setPasswordUrl,
	}: { to: string; username: string; setPasswordUrl: string }
): Promise<boolean> {
	if (!env.RESEND_API_KEY) return false

	const from = env.RESEND_FROM_EMAIL ?? 'Vores Events <onboarding@resend.dev>'

	const response = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${env.RESEND_API_KEY}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			from,
			to,
			subject: 'Din adgang til Vores Events',
			html: `<p>Hej ${username},</p><p>Der er oprettet en bruger til dig i Vores Events. Klik på linket for at vælge visningsnavn og adgangskode:</p><p><a href="${setPasswordUrl}">${setPasswordUrl}</a></p>`,
		}),
	})

	if (!response.ok) {
		console.error('Failed to send set-password email', await response.text())
		return false
	}
	return true
}
