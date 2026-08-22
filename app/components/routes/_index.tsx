import type { ActionFunction, LoaderFunctionArgs } from '@remix-run/cloudflare'
import { json, redirect } from '@remix-run/cloudflare'
import { Form, useLoaderData, useNavigate } from '@remix-run/react'
import { nanoid } from 'nanoid'
import invariant from 'tiny-invariant'
import { BrandPanel } from '~/components/BrandPanel'
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
							<a
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
							// Vi behøver ikke et helt serverbesøg for at starte et nyt rum,
							// så vi laver bare et redirect her.
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
