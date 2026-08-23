import type {
	ActionFunctionArgs,
	LoaderFunctionArgs,
} from '@remix-run/cloudflare'
import { json, redirect } from '@remix-run/cloudflare'
import {
	Form,
	useActionData,
	useLoaderData,
	useNavigate,
	useSearchParams,
} from '@remix-run/react'
import { and, eq, isNull } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { useState } from 'react'
import { getDb, Meetings } from 'schema'
import invariant from 'tiny-invariant'
import { AdminLoginDialog } from '~/components/AdminLoginDialog'
import { Button } from '~/components/Button'
import { Disclaimer } from '~/components/Disclaimer'
import { Input } from '~/components/Input'
import { Label } from '~/components/Label'
import { useUserMetadata } from '~/hooks/useUserMetadata'
import { ACCESS_AUTHENTICATED_USER_EMAIL_HEADER } from '~/utils/constants'
import getUsername, { getUserRole } from '~/utils/getUsername.server'

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
	const directoryUrl = context.USER_DIRECTORY_URL
	const username = await getUsername(request)
	invariant(username)
	const usedAccess = request.headers.has(ACCESS_AUTHENTICATED_USER_EMAIL_HEADER)
	const role = await getUserRole(request)
	return json({ username, usedAccess, directoryUrl, isGuest: role === null })
}

export const action = async ({ request, context }: ActionFunctionArgs) => {
	const room = (await request.formData()).get('room')
	invariant(typeof room === 'string')
	const roomName = room.replace(/ /g, '-')

	const role = await getUserRole(request)
	if (!role) {
		// guests may only join a meeting that's already active, never
		// spin up a new one by typing an arbitrary name
		const db = getDb(context)
		const meeting = db
			? (
					await db
						.select()
						.from(Meetings)
						.where(and(eq(Meetings.roomName, roomName), isNull(Meetings.ended)))
				)[0]
			: undefined
		if (!meeting) {
			return json(
				{
					error:
						'Dette møde findes ikke. Log ud og prøv igen, eller kontakt værten.',
				},
				{ status: 400 }
			)
		}
	}

	return redirect(roomName)
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

export default function Index() {
	const { username, usedAccess, isGuest } = useLoaderData<typeof loader>()
	const navigate = useNavigate()
	const { data } = useUserMetadata(username)
	const [searchParams] = useSearchParams()
	const wasRemoved = searchParams.get('removed') === '1'
	const [newRoomName, setNewRoomName] = useState(() => nanoid(8))
	const actionData = useActionData<typeof action>()

	return (
		<div className="flex min-h-full flex-col md:flex-row">
			<BrandPanel />
			<div className="flex flex-1 items-center justify-center bg-white p-6 text-zinc-800">
				<div className="w-full max-w-sm">
					{wasRemoved && (
						<div className="mb-6 rounded-md bg-red-100 p-3 text-sm text-red-800">
							Du blev fjernet fra mødet af værten.
						</div>
					)}
					<h2 className="text-2xl font-bold text-[#0b565b]">Klar til møde</h2>
					<div className="mb-6 mt-1 flex items-center justify-between gap-3">
						<p className="text-sm text-zinc-500">
							Logget ind som {data?.displayName}
						</p>
						{!usedAccess && (
							<div className="flex items-center gap-3">
								<a
									className="text-sm text-[#0d6d72] underline hover:text-[#0a565b]"
									href="/set-username"
								>
									Skift
								</a>
								<Form method="post" action="/logout">
									<button
										type="submit"
										className="text-sm text-red-600 underline hover:text-red-800"
									>
										Slet
									</button>
								</Form>
							</div>
						)}
					</div>

					{!isGuest && (
						<Form
							className="space-y-2"
							onSubmit={(e) => {
								e.preventDefault()
								const name = newRoomName.trim()
								if (!name) return
								navigate(`/${name.replace(/ /g, '-')}`)
							}}
						>
							<Label htmlFor="newRoom" className="text-zinc-700 dark:text-zinc-700">
								Mødenavn
							</Label>
							<div className="flex gap-3">
								<Input
									id="newRoom"
									value={newRoomName}
									onChange={(e) => setNewRoomName(e.target.value)}
									required
									className="border-zinc-300 bg-white px-3 py-2 focus:border-[#0d6d72] focus:outline-none focus:ring-2 focus:ring-[#0d6d72]/30 dark:border-zinc-300 dark:bg-white dark:text-zinc-900"
								/>
								<Button
									type="submit"
									className="whitespace-nowrap border-[#0d6d72] bg-[#0d6d72] normal-case text-white hover:border-[#0a565b] hover:bg-[#0a565b] active:border-[#083f44] active:bg-[#083f44]"
								>
									Nyt møde
								</Button>
							</div>
						</Form>
					)}

					{(() => {
						const joinForm = (
							<>
								<Form
									className="grid w-full grid-cols-[1fr_auto] items-end gap-3 pt-4"
									method="post"
								>
									<div className="space-y-2">
										<Label
											htmlFor="room"
											className="text-zinc-700 dark:text-zinc-700"
										>
											Mødenavn
										</Label>
										<Input
											name="room"
											id="room"
											required
											className="border-zinc-300 bg-white px-3 py-2 focus:border-[#0d6d72] focus:outline-none focus:ring-2 focus:ring-[#0d6d72]/30 dark:border-zinc-300 dark:bg-white dark:text-zinc-900"
										/>
									</div>
									<Button
										className="normal-case"
										type="submit"
										displayType="secondary"
									>
										Deltag
									</Button>
								</Form>
								{actionData?.error && (
									<p className="pt-2 text-sm text-red-500">
										{actionData.error}
									</p>
								)}
							</>
						)

						return isGuest ? (
							<div className="mt-4">
								<p className="text-sm text-zinc-500">Deltag i et møde</p>
								{joinForm}
							</div>
						) : (
							<details className="mt-4 cursor-pointer">
								<summary className="text-sm text-zinc-500">
									Eller deltag i et møde
								</summary>
								{joinForm}
							</details>
						)
					})()}

					<Disclaimer className="mt-8" />
					<div className="mt-2">
						<AdminLoginDialog />
					</div>
				</div>
			</div>
		</div>
	)
}
