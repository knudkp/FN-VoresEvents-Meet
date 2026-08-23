import { Form } from '@remix-run/react'
import { useState } from 'react'
import { cn } from '~/utils/style'
import { Button } from './Button'
import { Input } from './Input'
import { Label } from './Label'

const inputClassName =
	'border-zinc-300 bg-white px-3 py-2 focus:border-[#0d6d72] focus:outline-none focus:ring-2 focus:ring-[#0d6d72]/30 dark:border-zinc-300 dark:bg-white dark:text-zinc-900'

const continueButtonClassName =
	'w-full border-[#0d6d72] bg-[#0d6d72] normal-case text-white hover:border-[#0a565b] hover:bg-[#0a565b] active:border-[#083f44] active:bg-[#083f44]'

function choiceButtonClassName(active: boolean) {
	return cn(
		'flex-1 rounded-md border-2 px-4 py-3 text-sm font-semibold transition-colors',
		active
			? 'border-[#0d6d72] bg-[#0d6d72] text-white'
			: 'border-zinc-300 bg-white text-zinc-700 hover:border-[#0d6d72] hover:text-[#0d6d72]'
	)
}

/**
 * The "who are you" choice shown on the welcome screen: two side-by-side
 * buttons (guest / admin) that reveal the matching fields once picked.
 */
export function AuthChoiceForm({ error }: { error?: string }) {
	const [choice, setChoice] = useState<'guest' | 'admin' | null>(null)

	return (
		<>
			<div className="mb-6 mt-4 flex gap-3">
				<button
					type="button"
					onClick={() => setChoice('guest')}
					className={choiceButtonClassName(choice === 'guest')}
				>
					Fortsæt som gæst
				</button>
				<button
					type="button"
					onClick={() => setChoice('admin')}
					className={choiceButtonClassName(choice === 'admin')}
				>
					Som admin
				</button>
			</div>

			{choice === 'guest' && (
				<Form method="post" className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="username">Visningsnavn</Label>
						<Input
							autoComplete="off"
							autoFocus
							required
							type="text"
							id="username"
							name="username"
							placeholder="F.eks. Knud"
							className={inputClassName}
						/>
					</div>
					<Button type="submit" className={continueButtonClassName}>
						Fortsæt
					</Button>
				</Form>
			)}

			{choice === 'admin' && (
				<Form method="post" className="space-y-4">
					<input type="hidden" name="intent" value="login" />
					<div className="space-y-2">
						<Label htmlFor="loginUsername">Brugernavn</Label>
						<Input
							autoComplete="off"
							autoFocus
							required
							type="text"
							id="loginUsername"
							name="loginUsername"
							className={inputClassName}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="password">Adgangskode</Label>
						<Input
							required
							type="password"
							id="password"
							name="password"
							className={inputClassName}
						/>
					</div>
					{error && <p className="text-sm text-red-500">{error}</p>}
					<Button type="submit" className={continueButtonClassName}>
						Fortsæt
					</Button>
				</Form>
			)}
		</>
	)
}
