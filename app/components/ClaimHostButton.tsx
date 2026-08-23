import type { FC } from 'react'
import { useState } from 'react'
import { useRoomContext } from '~/hooks/useRoomContext'
import { Button } from './Button'
import { ClaimHostDialog } from './ClaimHostDialog'
import { Icon } from './Icon/Icon'

export const ClaimHostButton: FC = () => {
	const {
		room: { identity },
	} = useRoomContext()
	const [open, setOpen] = useState(false)

	if (identity?.isHost) return null

	return (
		<>
			<Button
				displayType="secondary"
				className="flex items-center gap-2 text-xs"
				onClick={() => setOpen(true)}
			>
				<Icon type="key" />
				Bliv vært
			</Button>
			{open && <ClaimHostDialog onOpenChange={setOpen} />}
		</>
	)
}
