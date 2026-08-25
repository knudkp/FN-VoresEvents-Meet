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
import { AdminPanelDialog } from '~/components/AdminPanelDialog'
import { AuthChoiceForm } from '~/components/AuthChoiceForm'
import { BrandPanel } from '~/components/BrandPanel'
import { Button } from '~/components/Button'
import { HelpDialog } from '~/components/HelpDialog'
import { Input } from '~/components/Input'
import { Label } from '~/components/Label'
import { Tooltip } from '~/components/Tooltip'
import { useUserMetadata } from '~/hooks/useUserMetadata'
import { ACCESS_AUTHENTICATED_USER_EMAIL_HEADER } from '~/utils/constants'
import getUsername, {
	getUserRole,
	setUsername,
} from '~/utils/getUsername.server'
import { handleLoginIntent } from '~/utils/loginAction.server'
import { normalizeGuestDisplayName } from '~/utils/validateDisplayName'

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
	const directoryUrl = context.USER_DIRECTORY_URL
	const username = await getUsername(request)
	const usedAccess = request.headers.has(ACCESS_AUTHENTICATED_USER_EMAIL_HEADER)
	const role = await getUserRole(request)
	return json({
		username,
		usedAccess,
		directoryUrl,
		isGuest: role === null,
		isAdmin: role === 'admin',
	})
}

export const action = async ({ request, context }: ActionFunctionArgs) => {
	const formData = await request.formData()

	const room = formData.get('room')
	if (typeof room === 'string') {
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
							.where(
								and(eq(Meetings.roomName, roomName), isNull(Meetings.ended))
							)
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

	const intent = formData.get('intent')
	if (intent === 'login') {
		return handleLoginIntent(formData, request, context, '/')
	}

	const username = formData.get('username')
	invariant(typeof username === 'string')
	const normalized = normalizeGuestDisplayName(username)
	if (!normalized.ok) {
		return json({ error: normalized.error }, { status: 400 })
	}
	return setUsername(normalized.value, request, '/')
}

export default function Index() {
	const { username, usedAccess, isGuest, isAdmin } =
		useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()

	if (!username) {
		return (
			<div className="flex min-h-full flex-col md:flex-row">
				<BrandPanel />
				<div className="relative flex flex-1 items-center justify-center bg-white p-6 text-zinc-800">
					<HelpDialog />
					<div className="mx-auto w-full max-w-sm text-center">
						<h2 className="text-[1.575rem] font-black text-[#0b565b]">
							Velkommen til fleksMeet
						</h2>
						<AuthChoiceForm error={actionData?.error} />
					</div>
				</div>
			</div>
		)
	}

	return (
		<Dashboard
			username={username}
			usedAccess={usedAccess}
			isGuest={isGuest}
			isAdmin={isAdmin}
			actionData={actionData}
		/>
	)
}

function Dashboard({
	username,
	usedAccess,
	isGuest,
	isAdmin,
	actionData,
}: {
	username: string
	usedAccess: boolean
	isGuest: boolean
	isAdmin: boolean
	actionData: { error?: string } | undefined
}) {
	const navigate = useNavigate()
	const { data } = useUserMetadata(username)
	const [searchParams] = useSearchParams()
	const wasRemoved = searchParams.get('removed') === '1'
	const [newRoomName, setNewRoomName] = useState(() => nanoid(8))

	return (
		<div className="flex min-h-full flex-col md:flex-row">
			<BrandPanel />
			<div className="relative flex flex-1 items-center justify-center bg-white p-6 text-zinc-800">
				<HelpDialog />
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
								<Tooltip content="Skift dit visningsnavn">
									<a
										className="text-sm text-[#0d6d72] underline hover:text-[#0a565b]"
										href="/set-username"
										aria-label="Skift visningsnavn"
									>
										Skift
									</a>
								</Tooltip>
								<Tooltip content="Log ud">
									<Form method="post" action="/logout">
										<button
											type="submit"
											className="text-sm text-red-600 underline hover:text-red-800"
											aria-label="Log ud"
										>
											Slet
										</button>
									</Form>
								</Tooltip>
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
							<Label
								htmlFor="newRoom"
								className="text-zinc-700 dark:text-zinc-700"
							>
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
								<Tooltip content="Opret og start et nyt møde">
									<Button
										type="submit"
										className="whitespace-nowrap border-[#0d6d72] bg-[#0d6d72] normal-case text-white hover:border-[#0a565b] hover:bg-[#0a565b] active:border-[#083f44] active:bg-[#083f44]"
										aria-label="Opret og start et nyt møde"
									>
										Nyt møde
									</Button>
								</Tooltip>
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
									<Tooltip content="Deltag i mødet">
										<Button
											className="normal-case"
											type="submit"
											displayType="secondary"
											aria-label="Deltag i mødet"
										>
											Deltag
										</Button>
									</Tooltip>
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

					<div className="mt-8 flex items-center gap-3">
						{isAdmin ? <AdminPanelDialog /> : <AdminLoginDialog />}
						{!usedAccess && (
							<Tooltip content="Log ud">
								<Form method="post" action="/logout">
									<button
										type="submit"
										className="text-xs text-zinc-400 underline hover:text-zinc-600"
										aria-label="Log ud"
									>
										Log ud
									</button>
								</Form>
							</Tooltip>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
