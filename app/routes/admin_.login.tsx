import type { ActionFunctionArgs } from '@remix-run/cloudflare'
import { json, redirect } from '@remix-run/cloudflare'
import { Form, useActionData } from '@remix-run/react'
import invariant from 'tiny-invariant'
import { commitAdminSession, getAdminSession } from '~/adminSession'
import { Button } from '~/components/Button'
import { Input } from '~/components/Input'
import { Label } from '~/components/Label'

export const action = async ({ request, context }: ActionFunctionArgs) => {
	const formData = await request.formData()
	const username = formData.get('username')
	const password = formData.get('password')
	invariant(typeof username === 'string')
	invariant(typeof password === 'string')

	if (!context.env.ADMIN_USERNAME || !context.env.HOST_PASSWORD) {
		return json(
			{ error: 'Admin er ikke konfigureret for denne installation.' },
			{ status: 400 }
		)
	}

	const usernameMatches =
		username.trim().toLowerCase() ===
		context.env.ADMIN_USERNAME.trim().toLowerCase()
	const passwordMatches = password === context.env.HOST_PASSWORD

	if (!usernameMatches || !passwordMatches) {
		return json(
			{ error: 'Forkert brugernavn eller adgangskode.' },
			{ status: 400 }
		)
	}

	const session = await getAdminSession(request.headers.get('Cookie'))
	session.set('isAdmin', true)
	return redirect('/admin', {
		headers: { 'Set-Cookie': await commitAdminSession(session) },
	})
}

export default function AdminLogin() {
	const actionData = useActionData<typeof action>()

	return (
		<div className="grid min-h-full place-items-center bg-white p-6 text-zinc-800">
			<div className="w-full max-w-sm">
				<h1 className="text-2xl font-bold text-[#0b565b]">Admin</h1>
				<p className="mb-6 mt-1 text-sm text-zinc-500">
					Log ind for at konfigurere og styre rum.
				</p>
				<Form method="post" className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="username">Brugernavn</Label>
						<Input id="username" name="username" required autoFocus />
					</div>
					<div className="space-y-2">
						<Label htmlFor="password">Adgangskode</Label>
						<Input id="password" name="password" type="password" required />
					</div>
					{actionData?.error && (
						<p className="text-sm text-red-500">{actionData.error}</p>
					)}
					<Button type="submit" className="w-full">
						Log ind
					</Button>
				</Form>
			</div>
		</div>
	)
}
