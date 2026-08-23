import type { FC } from 'react'
import { useRoomContext } from '~/hooks/useRoomContext'
import type { ClientMessage } from '~/types/Messages'
import AlertDialog from './AlertDialog'
import { Button } from './Button'

interface MuteAllDialogProps {
	onOpenChange: (open: boolean) => void
}

export const MuteAllDialog: FC<MuteAllDialogProps> = ({ onOpenChange }) => {
	const { room } = useRoomContext()

	return (
		<AlertDialog.Root open onOpenChange={onOpenChange}>
			<AlertDialog.Portal>
				<AlertDialog.Overlay />
				<AlertDialog.Content onCloseAutoFocus={(e) => e.preventDefault()}>
					<AlertDialog.Title>Mute alle</AlertDialog.Title>
					<AlertDialog.Description>
						Alle deltagere bliver muted med det samme. De skal selv slå lyden
						til igen.
					</AlertDialog.Description>
					<AlertDialog.Actions>
						<AlertDialog.Cancel asChild>
							<Button className="text-sm" displayType="secondary">
								Annullér
							</Button>
						</AlertDialog.Cancel>
						<AlertDialog.Action asChild>
							<Button
								onClick={() => {
									room.websocket.send(
										JSON.stringify({
											type: 'muteAll',
										} satisfies ClientMessage)
									)
								}}
								className="text-sm"
								displayType="danger"
							>
								Mute alle
							</Button>
						</AlertDialog.Action>
					</AlertDialog.Actions>
				</AlertDialog.Content>
			</AlertDialog.Portal>
		</AlertDialog.Root>
	)
}
