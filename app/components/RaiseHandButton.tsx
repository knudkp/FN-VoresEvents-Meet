import type { FC } from 'react'
import { playSound } from '~/utils/playSound'
import { Button } from './Button'
import { Icon } from './Icon/Icon'
import { Tooltip } from './Tooltip'

interface RaiseHandButtonProps {
	raisedHand: boolean
	onClick: () => void
}

export const RaiseHandButton: FC<RaiseHandButtonProps> = ({
	raisedHand,
	onClick,
}) => {
	const label = raisedHand ? 'Sænk hånden' : 'Ræk hånden op'
	return (
		<Tooltip content={label}>
			<Button
				displayType={raisedHand ? 'primary' : 'secondary'}
				onClick={(_e) => {
					onClick && onClick()
					if (!raisedHand) playSound('raiseHand')
				}}
				aria-label={label}
			>
				<Icon type="handRaised" />
			</Button>
		</Tooltip>
	)
}
