import {
	json,
	redirect,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
} from '@remix-run/cloudflare'
import { Form, useActionData, useLoaderData } from '@remix-run/react'
import { eq } from 'drizzle-orm'
import { getDb, Users } from 'schema'
import invariant from 'tiny-invariant'
import { commitAdminSession, getAdminSession } from '~/adminSession.server'
import { Button } from '~/components/Button'
import { Disclaimer } from '~/components/Disclaimer'
import { Input } from '~/components/Input'
import { Label } from '~/components/Label'
import { commitSession, getSession } from '~/session.server'
import { hashPassword } from '~/utils/hashPassword.server'
import { hashUserPassword } from '~/utils/passwordHash.server'
import { validatePassword } from '~/utils/validatePassword'

async function findUserByToken(
	context: LoaderFunctionArgs['context'],
	token: string
) {
	const db = getDb(context)
	if (!db) return null
	const tokenHash = await hashPassword(token)
	const [user] = await db
		.select()
		.from(Users)
		.where(eq(Users.inviteTokenHash, tokenHash))
	if (!user) return null
	if (!user.inviteTokenExpires || user.inviteTokenExpires < Date.now())
		return null
	return user
}

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
	const token = new URL(request.url).searchParams.get('token')
	if (!token) return json({ valid: false as const })

	const user = await findUserByToken(context, token)
	if (!user) return json({ valid: false as const })

	return json({ valid: true as const, token, username: user.username })
}

export const action = async ({ request, context }: ActionFunctionArgs) => {
	const formData = await request.formData()
	const token = formData.get('token')
	const displayName = formData.get('displayName')
	const password = formData.get('password')
	const confirmPassword = formData.get('confirmPassword')
	invariant(typeof token === 'string')
	invariant(typeof displayName === 'string')
	invariant(typeof password === 'string')
	invariant(typeof confirmPassword === 'string')

	const user = await findUserByToken(context, token)
	if (!user) {
		return json({ error: 'Linket er ugyldigt eller udløbet.' }, { status: 400 })
	}

	if (!displayName.trim()) {
		return json({ error: 'Indtast et visningsnavn.' }, { status: 400 })
	}

	const passwordError = validatePassword(password)
	if (passwordError) {
		return json({ error: passwordError }, { status: 400 })
	}
	if (password !== confirmPassword) {
		return json({ error: 'Adgangskoderne er ikke ens.' }, { status: 400 })
	}

	const db = getDb(context)
	invariant(db)
	const { hash, salt } = await hashUserPassword(password)
	await db
		.update(Users)
		.set({
			displayName: displayName.trim(),
			passwordHash: hash,
			passwordSalt: salt,
			inviteTokenHash: null,
			inviteTokenExpires: null,
		})
		.where(eq(Users.username, user.username))

	const session = await getSession(request.headers.get('Cookie'))
	session.set('username', displayName.trim())
	session.set('role', user.role)
	const headers = new Headers()
	headers.append('Set-Cookie', await commitSession(session))
	if (user.role === 'admin') {
		const adminSession = await getAdminSession(request.headers.get('Cookie'))
		adminSession.set('isAdmin', true)
		headers.append('Set-Cookie', await commitAdminSession(adminSession))
	}
	return redirect('/', { headers })
}

export default function SetPassword() {
	const data = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()

	if (!data.valid) {
		return (
			<div className="grid min-h-full place-items-center bg-white p-6 text-zinc-800">
				<p className="text-sm text-zinc-500">
					Linket er ugyldigt eller udløbet. Bed en admin om et nyt.
				</p>
			</div>
		)
	}

	return (
		<div className="grid min-h-full place-items-center bg-white p-6 text-zinc-800">
			<div className="w-full max-w-sm">
				<h1 className="text-2xl font-bold text-[#0b565b]">
					Velkommen, {data.username}
				</h1>
				<p className="mb-6 mt-1 text-sm text-zinc-500">
					Vælg et visningsnavn og en adgangskode.
				</p>
				<Form method="post" className="space-y-4">
					<input type="hidden" name="token" value={data.token} />
					<div className="space-y-2">
						<Label htmlFor="displayName">Visningsnavn</Label>
						<Input id="displayName" name="displayName" required autoFocus />
					</div>
					<div className="space-y-2">
						<Label htmlFor="password">Adgangskode</Label>
						<Input id="password" name="password" type="password" required />
						<p className="text-xs text-zinc-500">
							Mindst 8 tegn, med mindst ét stort bogstav og ét tal.
						</p>
					</div>
					<div className="space-y-2">
						<Label htmlFor="confirmPassword">Gentag adgangskode</Label>
						<Input
							id="confirmPassword"
							name="confirmPassword"
							type="password"
							required
						/>
					</div>
					{actionData?.error && (
						<p className="text-sm text-red-500">{actionData.error}</p>
					)}
					<Button
						type="submit"
						className="w-full border-[#0d6d72] bg-[#0d6d72] normal-case text-white hover:border-[#0a565b] hover:bg-[#0a565b] active:border-[#083f44] active:bg-[#083f44]"
					>
						Fortsæt
					</Button>
				</Form>
				<Disclaimer className="mt-8" />
			</div>
		</div>
	)
}
