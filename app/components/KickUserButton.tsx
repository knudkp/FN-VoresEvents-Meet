import type { FC } from 'react'
import { useRoomContext } from '~/hooks/useRoomContext'
import { useUserMetadata } from '~/hooks/useUserMetadata'
import type { ClientMessage, User } from '~/types/Messages'
import AlertDialog from './AlertDialog'
import { Button } from './Button'
import { Icon } from './Icon/Icon'
import { Tooltip } from './Tooltip'

interface KickUserButtonProps {
	user: User
}

export const KickUserButton: FC<KickUserButtonProps> = ({ user }) => {
	const { room } = useRoomContext()
	const { data } = useUserMetadata(user.name)

	const isSelf = user.id === room.identity?.id
	if (!room.identity?.isHost || isSelf || user.id === 'ai') return null

	return (
		<AlertDialog.Root>
			<Tooltip content={`Fjern ${data?.displayName}`}>
				<AlertDialog.Trigger asChild>
					<Button displayType="secondary">
						<Icon type="userMinus" />
					</Button>
				</AlertDialog.Trigger>
			</Tooltip>

			<AlertDialog.Portal>
				<AlertDialog.Overlay />
				<AlertDialog.Content
					onCloseAutoFocus={(e) => e.preventDefault()}
				>
					<AlertDialog.Title>Fjern {data?.displayName}?</AlertDialog.Title>
					<AlertDialog.Description>
						De bliver fjernet fra mødet med det samme og skal bruge linket igen
						for at deltage.
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
											type: 'kickUser',
											id: user.id,
										} satisfies ClientMessage)
									)
								}}
								className="text-sm"
								displayType="danger"
							>
								Fjern
							</Button>
						</AlertDialog.Action>
					</AlertDialog.Actions>
				</AlertDialog.Content>
			</AlertDialog.Portal>
		</AlertDialog.Root>
	)
}
