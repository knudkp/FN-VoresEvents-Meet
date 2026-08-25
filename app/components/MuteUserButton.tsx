import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import type { FC } from 'react'
import { useRoomContext } from '~/hooks/useRoomContext'
import { useUserMetadata } from '~/hooks/useUserMetadata'
import type { ClientMessage, User } from '~/types/Messages'
import AlertDialog from './AlertDialog'
import type { ButtonProps } from './Button'
import { Button } from './Button'
import { Icon } from './Icon/Icon'
import { Tooltip } from './Tooltip'

interface MuteUserButtonProps {
	displayType?: ButtonProps['displayType']
	mutedDisplayType?: ButtonProps['displayType']
	user: User
}

export const MuteUserButton: FC<MuteUserButtonProps> = ({
	user,
	displayType = 'secondary',
	mutedDisplayType = 'danger',
}) => {
	const { room } = useRoomContext()
	const { data } = useUserMetadata(user.name)

	const isSelf = user.id === room.identity?.id
	if (!isSelf && !room.identity?.isHost) return null

	if (user.tracks.audioUnavailable) {
		return (
			<Tooltip content="Mikrofon utilgængelig — kan ikke slås til">
				<Button disabled displayType="secondary" aria-label="Mikrofon utilgængelig">
					<Icon type="micOff" className="text-red-700 dark:text-red-400" />
					<VisuallyHidden>
						Brugerens mikrofon er utilgængelig og kan ikke slås til.
					</VisuallyHidden>
				</Button>
			</Tooltip>
		)
	}

	return (
		<AlertDialog.Root>
			{user.tracks.audioEnabled ? (
				<Tooltip content={`Mute ${data?.displayName}`}>
					<AlertDialog.Trigger asChild>
						<Button
							displayType={displayType}
							disabled={!user.tracks.audioEnabled}
							aria-label={`Mute ${data?.displayName}`}
						>
							<Icon type="micOn" />
						</Button>
					</AlertDialog.Trigger>
				</Tooltip>
			) : (
				<Tooltip content="Kan ikke slås til igen af dig">
					<Button
						displayType={mutedDisplayType}
						disabled
						aria-label="Kan ikke slås til igen af dig"
					>
						<Icon type="micOff" />
					</Button>
				</Tooltip>
			)}

			<AlertDialog.Portal>
				<AlertDialog.Overlay />
				<AlertDialog.Content
					// If we don't prevent the alert from restoring focus the tooltip
					// will continue to show when we don't want it to.
					onCloseAutoFocus={(e) => e.preventDefault()}
				>
					<AlertDialog.Title>Mute {data?.displayName}</AlertDialog.Title>
					<AlertDialog.Description>
						Personen skal selv slå mikrofonen til igen for at kunne høres.
					</AlertDialog.Description>
					<AlertDialog.Actions>
						<Tooltip content="Annullér">
							<AlertDialog.Cancel asChild>
								<Button
									className="text-sm"
									displayType="secondary"
									aria-label="Annullér"
								>
									Annullér
								</Button>
							</AlertDialog.Cancel>
						</Tooltip>
						<Tooltip content={`Mute ${data?.displayName}`}>
							<AlertDialog.Action asChild>
								<Button
									onClick={() => {
										room.websocket.send(
											JSON.stringify({
												type: 'muteUser',
												id: user.id,
											} satisfies ClientMessage)
										)
									}}
									className="text-sm"
									displayType="danger"
									aria-label={`Mute ${data?.displayName}`}
								>
									Mute
								</Button>
							</AlertDialog.Action>
						</Tooltip>
					</AlertDialog.Actions>
				</AlertDialog.Content>
			</AlertDialog.Portal>
		</AlertDialog.Root>
	)
}
