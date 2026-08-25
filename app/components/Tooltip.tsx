import * as RadixTooltip from '@radix-ui/react-tooltip'
import type { FC, ReactNode } from 'react'

interface TooltipProps {
	open?: boolean
	onOpenChange?: (open: boolean) => void
	content?: ReactNode
	children: ReactNode
}

export const Tooltip: FC<TooltipProps> = ({
	children,
	content,
	open,
	onOpenChange,
}) => {
	if (content === undefined) return <>{children}</>

	return (
		<RadixTooltip.Provider>
			<RadixTooltip.Root open={open} onOpenChange={onOpenChange}>
				<RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
				<RadixTooltip.Portal>
					<RadixTooltip.Content
						align="start"
						sideOffset={4}
						className="z-[100] rounded bg-black px-2 py-1 text-left text-xs text-white shadow-md"
					>
						{content}
						<RadixTooltip.Arrow className="fill-black" />
					</RadixTooltip.Content>
				</RadixTooltip.Portal>
			</RadixTooltip.Root>
		</RadixTooltip.Provider>
	)
}
