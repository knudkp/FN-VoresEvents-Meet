import type { ActionFunction, LoaderFunctionArgs } from '@remix-run/cloudflare'
import { json, redirect } from '@remix-run/cloudflare'
import { Form, useLoaderData, useNavigate } from '@remix-run/react'
import { nanoid } from 'nanoid'
import invariant from 'tiny-invariant'
import { Button, ButtonLink } from '~/components/Button'
import { Disclaimer } from '~/components/Disclaimer'
import { Input } from '~/components/Input'
import { Label } from '~/components/Label'
import { useUserMetadata } from '~/hooks/useUserMetadata'
import { ACCESS_AUTHENTICATED_USER_EMAIL_HEADER } from '~/utils/constants'
import getUsername from '~/utils/getUsername.server'

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
	const directoryUrl = context.USER_DIRECTORY_URL
	const username = await getUsername(request)
	invariant(username)
	const usedAccess = request.headers.has(ACCESS_AUTHENTICATED_USER_EMAIL_HEADER)
	return json({ username, usedAccess, directoryUrl })
}

export const action: ActionFunction = async ({ request }) => {
	const room = (await request.formData()).get('room')
	invariant(typeof room === 'string')
	return redirect(room.replace(/ /g, '-'))
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
	const { username, usedAccess } = useLoaderData<typeof loader>()
	const navigate = useNavigate()
	const { data } = useUserMetadata(username)

	return (
		<div className="flex min-h-full flex-col md:flex-row">
			<BrandPanel />
			<div className="flex flex-1 items-center justify-center bg-white p-6 text-zinc-800">
				<div className="w-full max-w-sm">
					<h2 className="text-2xl font-bold text-[#0b565b]">Klar til møde</h2>
					<div className="mb-6 mt-1 flex items-center justify-between gap-3">
						<p className="text-sm text-zinc-500">
							Logget ind som {data?.displayName}
						</p>
						{!usedAccess && (
							
								className="text-sm text-[#0d6d72] underline hover:text-[#0a565b]"
								href="/set-username"
							>
								Skift
							</a>
						)}
					</div>

					<ButtonLink
						to="/new"
						className="block w-full border-[#0d6d72] bg-[#0d6d72] text-center normal-case text-white hover:border-[#0a565b] hover:bg-[#0a565b] active:border-[#083f44] active:bg-[#083f44]"
						onClick={(e) => {
							e.preventDefault()
							navigate(`/${nanoid(8)}`)
						}}
					>
						Nyt møde
					</ButtonLink>

					<details className="mt-4 cursor-pointer">
						<summary className="text-sm text-zinc-500">
							Eller deltag i et møde
						</summary>
						<Form
							className="grid w-full grid-cols-[1fr_auto] items-end gap-3 pt-4"
							method="post"
						>
							<div className="space-y-2">
								<Label htmlFor="room" className="text-zinc-700 dark:text-zinc-700">
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
					</details>

					<Disclaimer className="mt-8" />
				</div>
			</div>
		</div>
	)
}
