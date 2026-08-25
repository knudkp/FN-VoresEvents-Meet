import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { useNavigate } from '@remix-run/react'
import type { FC } from 'react'
import { Button } from './Button'
import { Icon } from './Icon/Icon'
import { Tooltip } from './Tooltip'

interface LeaveRoomButtonProps {
	navigateToFeedbackPage: boolean
	meetingId?: string
}

export const LeaveRoomButton: FC<LeaveRoomButtonProps> = ({
	navigateToFeedbackPage,
	meetingId,
}) => {
	const navigate = useNavigate()
	return (
		<Tooltip content="Forlad mødet">
			<Button
				displayType="danger"
				onClick={() => {
					const params = new URLSearchParams()
					if (meetingId) params.set('meetingId', meetingId)
					navigate(
						navigateToFeedbackPage ? `/call-quality-feedback?${params}` : '/'
					)
				}}
				aria-label="Forlad mødet"
			>
				<VisuallyHidden>Forlad mødet</VisuallyHidden>
				<Icon type="phoneXMark" />
			</Button>
		</Tooltip>
	)
}
