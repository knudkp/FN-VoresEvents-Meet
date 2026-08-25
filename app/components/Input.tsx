import { forwardRef } from 'react'
import { cn } from '~/utils/style'

export const Input = forwardRef<
	HTMLInputElement,
	JSX.IntrinsicElements['input']
>(({ className, ...rest }, ref) => (
	<input
		className={cn(
			'w-full',
			'rounded',
			'border-2',
			'border-zinc-400',
			'text-zinc-900',
			'dark:text-zinc-50',
			'dark:border-zinc-600',
			'bg-zinc-100',
			'dark:bg-zinc-700',
			'px-2.5',
			'py-1.5',
			'outline-none',
			'transition-colors',
			'focus:border-[#0d6d72]',
			'focus:ring-2',
			'focus:ring-[#0d6d72]/20',
			className
		)}
		{...rest}
		ref={ref}
	/>
))

Input.displayName = 'Input'
