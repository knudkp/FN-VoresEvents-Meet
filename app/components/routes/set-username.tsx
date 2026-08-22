import { type ActionFunctionArgs } from '@remix-run/cloudflare'
import { Form } from '@remix-run/react'
import invariant from 'tiny-invariant'
import { BrandPanel } from '~/components/BrandPanel'
import { Button } from '~/components/Button'
import { Disclaimer } from '~/components/Disclaimer'
import { Input } from '~/components/Input'
import { ACCESS_AUTHENTICATED_USER_EMAIL_HEADER } from '~/utils/constants'
import { setUsername } from '~/utils/getUsername.server'
import { safeRedirect } from '~/utils/safeReturnUrl'

export const action = async ({ request }: ActionFunctionArgs) => {
	const url = new URL(request.url)
	const returnUrl = url.searchParams.get('return-url') ?? '/'
	const accessUsername = request.headers.get(
		ACCESS_AUTHENTICATED_USER_EMAIL_HEADER
	)
	if (accessUsername) throw safeRedirect(returnUrl)
	const { username } = Object.fromEntries(await request.formData())
	invariant(typeof username === 'string')
	return setUsername(username, request, returnUrl)
}

export default function SetUsername() {
	return (
		<div className="flex min-h-full flex-col md:flex-row">
			<BrandPanel />
			<div className="flex flex-1 items-center justify-center bg-white p-6 text-zinc-800">
				<div className="w-full max-w-sm">
					<h2 className="text-2xl font-bold text-[#0b565b]">Velkommen</h2>
					<p className="mb-6 mt-1 text-sm text-zinc-500">
						Indtast dit visningsnavn for at starte
					</p>
					<Form method="post" className="space-y-4">
						<div className="space-y-2">
							<label
								htmlFor="username"
								className="text-sm font-medium text-zinc-700"
							>
								Visningsnavn
							</label>
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
					<Disclaimer className="mt-8" />
				</div>
			</div>
		</div>
	)
}
