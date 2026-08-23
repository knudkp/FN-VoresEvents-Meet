import type { FC } from 'react'
import { useEffect, useState } from 'react'
import { useRoomContext } from '~/hooks/useRoomContext'
import type { ClientMessage, KnownErrorCode } from '~/types/Messages'
import { Button } from './Button'
import { Dialog, DialogContent, DialogOverlay, DialogTitle, Portal } from './Dialog'
import { Input } from './Input'
import { Label } from './Label'

const errorText: Partial<Record<KnownErrorCode, string>> = {
	'invalid-host-password': 'Forkert adgangskode.',
	'host-password-too-short': 'Adgangskoden skal være mindst 4 tegn.',
	'host-password-not-configured':
		'Værtsadgangskode er ikke konfigureret for dette møde.',
}

interface ClaimHostDialogProps {
	onOpenChange: (open: boolean) => void
}

export const ClaimHostDialog: FC<ClaimHostDialogProps> = ({
	onOpenChange,
}) => {
	const { room } = useRoomContext()
	const [password, setPassword] = useState('')

	useEffect(() => {
		if (room.identity?.isHost) onOpenChange(false)
	}, [room.identity?.isHost, onOpenChange])

	return (
		<Dialog open onOpenChange={onOpenChange}>
			<Portal>
				<DialogOverlay />
				<DialogContent>
					<DialogTitle>Bliv vært</DialogTitle>
					<form
						className="mt-6 space-y-4"
						onSubmit={(e) => {
							e.preventDefault()
							room.websocket.send(
								JSON.stringify({
									type: 'claimHost',
									password,
								} satisfies ClientMessage)
							)
						}}
					>
						<div className="space-y-2">
							<Label htmlFor="hostPassword">Værtsadgangskode</Label>
							<Input
								id="hostPassword"
								type="password"
								autoComplete="off"
								autoFocus
								required
								value={password}
								onChange={(e) => setPassword(e.target.value)}
							/>
							<p className="text-xs text-zinc-500 dark:text-zinc-400">
								Er du den første til at blive vært i dette møde, sætter du
								samtidig adgangskoden for resten af mødet.
							</p>
						</div>
						{room.lastError && errorText[room.lastError] && (
							<p className="text-sm text-red-500">
								{errorText[room.lastError]}
							</p>
						)}
						<Button type="submit" className="w-full">
							Bliv vært
						</Button>
					</form>
				</DialogContent>
			</Portal>
		</Dialog>
	)
}
