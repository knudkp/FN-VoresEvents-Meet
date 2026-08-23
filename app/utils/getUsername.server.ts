import { commitSession, getSession } from '~/session'
import { ACCESS_AUTHENTICATED_USER_EMAIL_HEADER } from './constants'
import { safeRedirect } from './safeReturnUrl'

export async function setUsername(
	username: string,
	request: Request,
	returnUrl: string = '/'
) {
	const session = await getSession(request.headers.get('Cookie'))
	session.set('username', username)
	throw safeRedirect(returnUrl, {
		headers: {
			'Set-Cookie': await commitSession(session),
		},
	})
}

/**
 * Utility for getting the username. In prod, this basically
 * just consists of getting the Cf-Access-Authenticated-User-Email
 * header, but in dev we allow manually setting this via the
 * username query param.
 */
export default async function getUsername(request: Request) {
	const accessUsername = request.headers.get(
		ACCESS_AUTHENTICATED_USER_EMAIL_HEADER
	)
	if (accessUsername) return accessUsername

	const session = await getSession(request.headers.get('Cookie'))
	const sessionUsername = session.get('username')
	if (typeof sessionUsername === 'string') return sessionUsername

	return null
}

/**
 * Whether the current visitor logged in with a real account (admin,
 * moderator or user, via /set-username's "Log ind" tab, /set-password,
 * or the ADMIN_USERNAME+HOST_PASSWORD bootstrap) rather than just
 * typing a free-text display name as a guest. Guests get null here.
 */
export async function getUserRole(
	request: Request
): Promise<'admin' | 'moderator' | 'user' | null> {
	const session = await getSession(request.headers.get('Cookie'))
	const role = session.get('role')
	if (role === 'admin' || role === 'moderator' || role === 'user') return role
	return null
}
