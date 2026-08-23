import { json, redirect, type AppLoadContext } from '@remix-run/cloudflare'
import { eq } from 'drizzle-orm'
import { getDb, Users } from 'schema'
import invariant from 'tiny-invariant'
import { commitAdminSession, getAdminSession } from '~/adminSession.server'
import { commitSession, getSession } from '~/session.server'
import { verifyUserPassword } from '~/utils/passwordHash.server'

export async function handleLoginIntent(
	formData: FormData,
	request: Request,
	context: AppLoadContext,
	returnUrl: string
) {
	const loginUsername = formData.get('loginUsername')
	const password = formData.get('password')
	invariant(typeof loginUsername === 'string')
	invariant(typeof password === 'string')
	const trimmedLoginUsername = loginUsername.trim()

	const isMaster =
		!!context.env.ADMIN_USERNAME &&
		!!context.env.HOST_PASSWORD &&
		trimmedLoginUsername.toLowerCase() ===
			context.env.ADMIN_USERNAME.trim().toLowerCase() &&
		password === context.env.HOST_PASSWORD

	let displayName: string | null = null
	let role: 'admin' | 'moderator' | 'user' | null = null

	if (isMaster) {
		displayName = trimmedLoginUsername
		role = 'admin'
	} else {
		const db = getDb(context)
		if (db) {
			const [user] = await db
				.select()
				.from(Users)
				.where(eq(Users.username, trimmedLoginUsername))
			if (user?.passwordHash && user.passwordSalt) {
				const valid = await verifyUserPassword(
					password,
					user.passwordHash,
					user.passwordSalt
				)
				if (valid) {
					displayName = user.displayName ?? user.username
					role = user.role
				}
			}
		}
	}

	if (!displayName) {
		return json(
			{ error: 'Forkert brugernavn eller adgangskode.' },
			{ status: 400 }
		)
	}

	const session = await getSession(request.headers.get('Cookie'))
	session.set('username', displayName)
	session.set('role', role)
	const headers = new Headers()
	headers.append('Set-Cookie', await commitSession(session))
	if (role === 'admin') {
		const adminSession = await getAdminSession(request.headers.get('Cookie'))
		adminSession.set('isAdmin', true)
		headers.append('Set-Cookie', await commitAdminSession(adminSession))
	}
	return redirect(returnUrl, { headers })
}
