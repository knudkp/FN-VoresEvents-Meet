import type { ActionFunction } from '@remix-run/cloudflare'
import { redirect } from '@remix-run/cloudflare'
import { destroySession, getSession } from '~/session'

export const action: ActionFunction = async ({ request }) => {
	const session = await getSession(request.headers.get('Cookie'))
	return redirect('/set-username', {
		headers: {
			'Set-Cookie': await destroySession(session),
		},
	})
}
