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
import { commitAdminSession, getAdminSession } from '~/adminSession'
import { Button } from '~/components/Button'
import { Input } from '~/components/Input'
import { Label } from '~/components/Label'
import { commitSession, getSession } from '~/session'
import { hashUserPassword } from '~/utils/passwordHash.server'
import { validatePassword } from '~/utils/validatePassword'

export const loader = async ({ context }: LoaderFunctionArgs) => {
	const db = getDb(context)
	if (!db) return json({ blocked: 'Ingen database er konfigureret.' as string | null })

	const admins = await db.select().from(Users).where(eq(Users.role, 'admin'))
	if (admins.length > 0) {
		return json({
			blocked: 'Der findes allerede en admin. Log ind i stedet.' as string | null,
		})
	}

	return json({ blocked: null as string | null })
}

export const action = async ({ request, context }: ActionFunctionArgs) => {
	const db = getDb(context)
	if (!db) {
		return json({ error: 'Ingen database er konfigureret.' }, { status: 400 })
	}

	const admins = await db.select().from(Users).where(eq(Users.role, 'admin'))
	if (admins.length > 0) {
		return json(
			{ error: 'Der findes allerede en admin. Log ind i stedet.' },
			{ status: 400 }
		)
	}

	const formData = await request.formData()
	const rawUsername = formData.get('username')
	const email = formData.get('email')
	const displayName = formData.get('displayName')
	const password = formData.get('password')
	const confirmPassword = formData.get('confirmPassword')
	invariant(typeof rawUsername === 'string')
	invariant(typeof email === 'string')
	invariant(typeof displayName === 'string')
	invariant(typeof password === 'string')
	invariant(typeof confirmPassword === 'string')

	const username = rawUsername.trim()
	if (username.length < 4) {
		return json(
			{ error: 'Brugernavn skal være mindst 4 tegn.' },
			{ status: 400 }
		)
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

	const { hash, salt } = await hashUserPassword(password)
	await db.insert(Users).values({
		username,
		email: email.trim(),
		displayName: displayName.trim(),
		role: 'admin',
		passwordHash: hash,
		passwordSalt: salt,
	})

	const session = await getSession(request.headers.get('Cookie'))
	session.set('username', displayName.trim())
	const adminSession = await getAdminSession(request.headers.get('Cookie'))
	adminSession.set('isAdmin', true)
	const headers = new Headers()
	headers.append('Set-Cookie', await commitSession(session))
	headers.append('Set-Cookie', await commitAdminSession(adminSession))
	return redirect('/admin', { headers })
}

export default function AdminSetup() {
	const { blocked } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()

	if (blocked) {
		return (
			<div className="grid min-h-full place-items-center bg-white p-6 text-zinc-800">
				<p className="text-sm text-zinc-500">{blocked}</p>
			</div>
		)
	}

	return (
		<div className="grid min-h-full place-items-center bg-white p-6 text-zinc-800">
			<div className="w-full max-w-sm">
				<h1 className="text-2xl font-bold text-[#0b565b]">Opret den første admin</h1>
				<p className="mb-6 mt-1 text-sm text-zinc-500">
					Denne side virker kun indtil den første admin er oprettet.
				</p>
				<Form method="post" className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="username">Brugernavn</Label>
						<Input id="username" name="username" required minLength={4} />
					</div>
					<div className="space-y-2">
						<Label htmlFor="displayName">Visningsnavn</Label>
						<Input id="displayName" name="displayName" required />
					</div>
					<div className="space-y-2">
						<Label htmlFor="email">E-mail</Label>
						<Input id="email" name="email" type="email" required />
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
						Opret admin
					</Button>
				</Form>
			</div>
		</div>
	)
}
