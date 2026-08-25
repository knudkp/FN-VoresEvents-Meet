import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import type { FC } from 'react'
import { useKey } from 'react-use'
import { useRoomContext } from '~/hooks/useRoomContext'
import { errorMessageMap } from '~/hooks/useUserMedia'
import { metaKey } from '~/utils/metaKey'
import type { ButtonProps } from './Button'
import { Button } from './Button'
import { Icon } from './Icon/Icon'
import { Tooltip } from './Tooltip'

export const CameraButton: FC<ButtonProps> = ({ onClick, ...rest }) => {
	const {
		audioOnlyMode,
		setAudioOnlyMode,
		userMedia: {
			turnCameraOff,
			turnCameraOn,
			videoEnabled,
			videoUnavailableReason,
		},
	} = useRoomContext()

	const toggle = () => {
		videoEnabled ? turnCameraOff() : turnCameraOn()
	}

	useKey((e) => {
		if (e.key === 'e' && e.metaKey) {
			e.preventDefault()
			return true
		}
		return false
	}, toggle)

	const videoUnavailableMessage = videoUnavailableReason
		? errorMessageMap[videoUnavailableReason]
		: null

	const label = videoEnabled ? 'Sluk kamera' : 'Tænd kamera'

	return (
		<Tooltip
			content={videoUnavailableMessage ?? `${label} (${metaKey}E)`}
		>
			<Button
				displayType={videoEnabled ? 'secondary' : 'danger'}
				disabled={!!videoUnavailableMessage}
				onClick={(e) => {
					if (audioOnlyMode) {
						setAudioOnlyMode(false)
					}
					toggle()
					onClick && onClick(e)
				}}
				aria-label={label}
				{...rest}
			>
				<VisuallyHidden>{label}</VisuallyHidden>
				<Icon type={videoEnabled ? 'videoOn' : 'videoOff'} />
			</Button>
		</Tooltip>
	)
}
