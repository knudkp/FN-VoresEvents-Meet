import { createCookieSessionStorage, redirect } from '@remix-run/cloudflare'

export const {
	getSession: getAdminSession,
	commitSession: commitAdminSession,
	destroySession: destroyAdminSession,
} = createCookieSessionStorage({
	cookie: {
		name: '__admin_session',
		secrets: ['fXFCFVvfgxvVUvfvUFVCUfvxxvUCUFC'],
		sameSite: true,
		httpOnly: true,
	},
})

export async function requireAdmin(request: Request) {
	const session = await getAdminSession(request.headers.get('Cookie'))
	if (session.get('isAdmin') !== true) {
		throw redirect('/admin/login')
	}
}
