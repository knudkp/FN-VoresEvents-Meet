import { useFetcher } from '@remix-run/react'
import type { FC } from 'react'
import { Button } from './Button'
import {
	Dialog,
	DialogContent,
	DialogOverlay,
	DialogTitle,
	Portal,
	Trigger,
} from './Dialog'
import { Input } from './Input'
import { Label } from './Label'

export const AdminLoginDialog: FC = () => {
	const fetcher = useFetcher<{ error?: string }>()

	return (
		<Dialog>
			<Trigger asChild>
				<button
					type="button"
					className="text-xs text-zinc-400 underline hover:text-zinc-600"
				>
					Admin
				</button>
			</Trigger>
			<Portal>
				<DialogOverlay />
				<DialogContent>
					<DialogTitle>Admin-login</DialogTitle>
					<fetcher.Form
						method="post"
						action="/admin/login"
						className="mt-6 space-y-4"
					>
						<div className="space-y-2">
							<Label htmlFor="admin-username">Brugernavn</Label>
							<Input id="admin-username" name="username" required autoFocus />
						</div>
						<div className="space-y-2">
							<Label htmlFor="admin-password">Adgangskode</Label>
							<Input
								id="admin-password"
								name="password"
								type="password"
								required
							/>
						</div>
						{fetcher.data?.error && (
							<p className="text-sm text-red-500">{fetcher.data.error}</p>
						)}
						<Button
							type="submit"
							className="w-full"
							disabled={fetcher.state !== 'idle'}
						>
							Log ind
						</Button>
					</fetcher.Form>
				</DialogContent>
			</Portal>
		</Dialog>
	)
}
