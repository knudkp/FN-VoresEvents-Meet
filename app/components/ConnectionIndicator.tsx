import { useState } from 'react'
import { cn } from '~/utils/style'
import { Icon } from './Icon/Icon'
import { Tooltip } from './Tooltip'

export type ConnectionQuality = 'healthy' | 'tolerable' | 'unhealthy' | 'bad'

export function getConnectionQuality(packetLoss: number): ConnectionQuality {
	if (packetLoss > 0.05) return 'bad'
	if (packetLoss > 0.03) return 'unhealthy'
	if (packetLoss > 0.01) return 'tolerable'
	return 'healthy'
}

const qualityLabels: Record<ConnectionQuality, string> = {
	healthy: 'god',
	tolerable: 'nogenlunde',
	unhealthy: 'dårlig',
	bad: 'meget dårlig',
}

export function ConnectionIndicator(props: { quality: ConnectionQuality }) {
	const [open, setOpen] = useState(false)
	const label = `Forbindelse: ${qualityLabels[props.quality]}`
	return (
		<Tooltip open={open} onOpenChange={setOpen} content={label}>
			<button onClick={() => setOpen(!open)} aria-label={label}>
				<Icon
					className={cn(
						props.quality === 'healthy' && 'text-green-400',
						props.quality === 'tolerable' && 'text-green-400',
						props.quality === 'unhealthy' && 'text-yellow-400',
						props.quality === 'bad' && 'text-red-400'
					)}
					type={
						props.quality === 'bad' || props.quality === 'unhealthy'
							? 'SignalSlashIcon'
							: 'SignalIcon'
					}
				/>
			</button>
		</Tooltip>
	)
}
