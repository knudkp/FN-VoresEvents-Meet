import { json, redirect, type ActionFunctionArgs } from '@remix-run/cloudflare'
import { Form, useActionData } from '@remix-run/react'
import { eq } from 'drizzle-orm'
import { useState } from 'react'
import { getDb, Users } from 'schema'
import invariant from 'tiny-invariant'
import { commitAdminSession, getAdminSession } from '~/adminSession'
import { Button } from '~/components/Button'
import { Disclaimer } from '~/components/Disclaimer'
import { Input } from '~/components/Input'
import { Label } from '~/components/Label'
import { commitSession, getSession } from '~/session'
import { ACCESS_AUTHENTICATED_USER_EMAIL_HEADER } from '~/utils/constants'
import { setUsername } from '~/utils/getUsername.server'
import { verifyUserPassword } from '~/utils/passwordHash.server'
import { safeRedirect } from '~/utils/safeReturnUrl'

export const action = async ({ request, context }: ActionFunctionArgs) => {
	const url = new URL(request.url)
	const returnUrl = url.searchParams.get('return-url') ?? '/'
	const accessUsername = request.headers.get(
		ACCESS_AUTHENTICATED_USER_EMAIL_HEADER
	)
	if (accessUsername) throw safeRedirect(returnUrl)

	const formData = await request.formData()
	const intent = formData.get('intent')

	if (intent === 'login') {
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

	const username = formData.get('username')
	invariant(typeof username === 'string')
	return setUsername(username, request, returnUrl)
}

function BrandPanel() {
	return (
		<div className="relative flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden bg-gradient-to-br from-[#10787d] via-[#0b565b] to-[#07373d] p-10 text-center">
			<div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
			<div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-black/10 blur-3xl" />
			<svg
				className="h-16 w-16 drop-shadow-lg"
				viewBox="0 0 24 24"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				aria-hidden="true"
			>
				<defs>
					<linearGradient
						id="voresBolt"
						x1="4"
						y1="2"
						x2="20"
						y2="22"
						gradientUnits="userSpaceOnUse"
					>
						<stop stopColor="#FFD23F" />
						<stop offset="1" stopColor="#F7911B" />
					</linearGradient>
				</defs>
				<path
					d="M13 2 4.5 13.5H11l-1.5 8.5L20 9.5h-6.7L13 2Z"
					fill="url(#voresBolt)"
				/>
			</svg>
			<div>
				<h1 className="text-4xl font-extrabold tracking-tight text-white">
					Vores Events
				</h1>
				<p className="mt-2 text-sm text-white/70">
					Sikre videomøder — når du har brug for det
				</p>
			</div>
			<div className="flex flex-wrap items-center justify-center gap-2">
				{['🎥 Videomøder', '🖥️ Skærmdeling', '⏱️ Ingen tidsgrænse'].map(
					(t) => (
						<span
							key={t}
							className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90 ring-1 ring-white/15"
						>
							{t}
						</span>
					)
				)}
			</div>
		</div>
	)
}

export default function SetUsername() {
	const [mode, setMode] = useState<'guest' | 'login'>('guest')
	const actionData = useActionData<typeof action>()

	return (
		<div className="flex min-h-full flex-col md:flex-row">
			<BrandPanel />
			<div className="flex flex-1 items-center justify-center bg-white p-6 text-zinc-800">
				<div className="w-full max-w-sm">
					<h2 className="text-2xl font-bold text-[#0b565b]">Velkommen</h2>
					<div className="mb-6 mt-2 flex gap-4 text-sm">
						<button
							type="button"
							onClick={() => setMode('guest')}
							className={
								mode === 'guest'
									? 'font-medium text-[#0b565b] underline'
									: 'text-zinc-500 underline'
							}
						>
							Fortsæt som gæst
						</button>
						<button
							type="button"
							onClick={() => setMode('login')}
							className={
								mode === 'login'
									? 'font-medium text-[#0b565b] underline'
									: 'text-zinc-500 underline'
							}
						>
							Log ind
						</button>
					</div>

					{mode === 'guest' ? (
						<Form method="post" className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="username">Visningsnavn</Label>
								<Input
									autoComplete="off"
									autoFocus
									required
									type="text"
									id="username"
									name="username"
									placeholder="F.eks. Knud"
									className="border-zinc-300 bg-white px-3 py-2 focus:border-[#0d6d72] focus:outline-none focus:ring-2 focus:ring-[#0d6d72]/30 dark:border-zinc-300 dark:bg-white dark:text-zinc-900"
								/>
							</div>
							<Button
								type="submit"
								className="w-full border-[#0d6d72] bg-[#0d6d72] normal-case text-white hover:border-[#0a565b] hover:bg-[#0a565b] active:border-[#083f44] active:bg-[#083f44]"
							>
								Fortsæt
							</Button>
						</Form>
					) : (
						<Form method="post" className="space-y-4">
							<input type="hidden" name="intent" value="login" />
							<div className="space-y-2">
								<Label htmlFor="loginUsername">Brugernavn</Label>
								<Input
									autoComplete="off"
									autoFocus
									required
									type="text"
									id="loginUsername"
									name="loginUsername"
									className="border-zinc-300 bg-white px-3 py-2 focus:border-[#0d6d72] focus:outline-none focus:ring-2 focus:ring-[#0d6d72]/30 dark:border-zinc-300 dark:bg-white dark:text-zinc-900"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="password">Adgangskode</Label>
								<Input
									required
									type="password"
									id="password"
									name="password"
									className="border-zinc-300 bg-white px-3 py-2 focus:border-[#0d6d72] focus:outline-none focus:ring-2 focus:ring-[#0d6d72]/30 dark:border-zinc-300 dark:bg-white dark:text-zinc-900"
								/>
							</div>
							{actionData && 'error' in actionData && (
								<p className="text-sm text-red-500">{actionData.error}</p>
							)}
							<Button
								type="submit"
								className="w-full border-[#0d6d72] bg-[#0d6d72] normal-case text-white hover:border-[#0a565b] hover:bg-[#0a565b] active:border-[#083f44] active:bg-[#083f44]"
							>
								Log ind
							</Button>
						</Form>
					)}
					<Disclaimer className="mt-8" />
				</div>
			</div>
		</div>
	)
}
