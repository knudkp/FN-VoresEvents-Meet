import type { FC } from 'react'
import { cn } from '~/utils/style'

interface DisclaimerProps {
	className?: string
}

export const Disclaimer: FC<DisclaimerProps> = ({ className }) => {
	return (
		<p className={cn('text-xs text-zinc-400', className)}>
			© 2026 - Vores Events -{' '}
			<a
				href="https://fleksjobbernetvaerket.dk"
				target="_blank"
				rel="noopener noreferrer"
				className="underline hover:text-zinc-300"
			>
				Fleksjobber Netværket
			</a>
		</p>
	)
}
