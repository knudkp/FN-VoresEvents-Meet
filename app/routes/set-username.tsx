import { json, type ActionFunctionArgs } from '@remix-run/cloudflare'
import { useActionData } from '@remix-run/react'
import invariant from 'tiny-invariant'
import { AuthChoiceForm } from '~/components/AuthChoiceForm'
import { BrandPanel } from '~/components/BrandPanel'
import { HelpDialog } from '~/components/HelpDialog'
import { ACCESS_AUTHENTICATED_USER_EMAIL_HEADER } from '~/utils/constants'
import { setUsername } from '~/utils/getUsername.server'
import { handleLoginIntent } from '~/utils/loginAction.server'
import { safeRedirect } from '~/utils/safeReturnUrl'
import { normalizeGuestDisplayName } from '~/utils/validateDisplayName'

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
		return handleLoginIntent(formData, request, context, returnUrl)
	}

	const username = formData.get('username')
	invariant(typeof username === 'string')
	const normalized = normalizeGuestDisplayName(username)
	if (!normalized.ok) {
		return json({ error: normalized.error }, { status: 400 })
	}
	return setUsername(normalized.value, request, returnUrl)
}

export default function SetUsername() {
	const actionData = useActionData<typeof action>()

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
