import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import type { FC } from 'react'
import { useKey } from 'react-use'
import useIsSpeaking from '~/hooks/useIsSpeaking'
import { useRoomContext } from '~/hooks/useRoomContext'
import { errorMessageMap } from '~/hooks/useUserMedia'
import { metaKey } from '~/utils/metaKey'
import type { ButtonProps } from './Button'
import { Button } from './Button'
import { Icon } from './Icon/Icon'
import Toast from './Toast'
import { Tooltip } from './Tooltip'

export const MicButton: FC<
	ButtonProps & {
		warnWhenSpeakingWhileMuted?: boolean
	}
> = ({ onClick, warnWhenSpeakingWhileMuted, ...rest }) => {
	const {
		userMedia: {
			turnMicOn,
			turnMicOff,
			audioEnabled,
			audioUnavailableReason,
			audioMonitorStreamTrack,
		},
	} = useRoomContext()

	const toggle = () => {
		audioEnabled ? turnMicOff() : turnMicOn()
	}

	useKey((e) => {
		if (e.key === 'd' && e.metaKey) {
			e.preventDefault()
			return true
		}
		return false
	}, toggle)

	const isSpeaking = useIsSpeaking(audioMonitorStreamTrack)

	const audioUnavailableMessage = audioUnavailableReason
		? errorMessageMap[audioUnavailableReason]
		: null

	const label = audioEnabled ? 'Sluk mikrofon' : 'Tænd mikrofon'

	return (
		<>
			<Tooltip content={audioUnavailableMessage ?? `${label} (${metaKey}D)`}>
				<Button
					displayType={audioEnabled ? 'secondary' : 'danger'}
					disabled={!!audioUnavailableMessage}
					onClick={(e) => {
						toggle()
						onClick && onClick(e)
					}}
					aria-label={label}
					{...rest}
				>
					<VisuallyHidden>{label}</VisuallyHidden>
					<Icon type={audioEnabled ? 'micOn' : 'micOff'} />
				</Button>
			</Tooltip>
			{isSpeaking && !audioEnabled && warnWhenSpeakingWhileMuted && (
				<Toast.Root
					className="flex items-center gap-3 text-sm"
					open
					type="foreground"
				>
					<Toast.Title className="ToastTitle">
						Taler du, mens du er muted?
					</Toast.Title>
					<Tooltip content="Tænd mikrofon">
						<Toast.Action
							className="ToastAction"
							asChild
							altText="Slå mikrofonen til for at tale"
						>
							<Button
								displayType="danger"
								onClick={toggle}
								aria-label="Tænd mikrofon"
							>
								<VisuallyHidden>Tænd mikrofon</VisuallyHidden>
								<Icon type="micOff" />
							</Button>
						</Toast.Action>
					</Tooltip>
				</Toast.Root>
			)}
		</>
	)
}
