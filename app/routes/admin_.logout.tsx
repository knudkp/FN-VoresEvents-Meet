import type { ActionFunction } from '@remix-run/cloudflare'
import { redirect } from '@remix-run/cloudflare'
import { destroyAdminSession, getAdminSession } from '~/adminSession.server'

export const action: ActionFunction = async ({ request }) => {
	const session = await getAdminSession(request.headers.get('Cookie'))
	return redirect('/admin/login', {
		headers: {
			'Set-Cookie': await destroyAdminSession(session),
		},
	})
}
