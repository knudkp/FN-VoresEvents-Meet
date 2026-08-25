import {
	Dialog,
	DialogContent,
	DialogOverlay,
	DialogTitle,
	Portal,
	Trigger,
} from './Dialog'
import { Tooltip } from './Tooltip'

export function HelpDialog() {
	return (
		<Dialog>
			<Tooltip content="Hjælp">
				<Trigger asChild>
					<button
						type="button"
						aria-label="Hjælp"
						className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#0d6d72] bg-white text-base font-bold text-[#0d6d72] shadow-md hover:bg-[#0d6d72] hover:text-white"
					>
						?
					</button>
				</Trigger>
			</Tooltip>
			<Portal>
				<DialogOverlay />
				<DialogContent>
					<DialogTitle>Hjælp</DialogTitle>
					<div className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
						<p>
							Vælg <strong>Fortsæt som gæst</strong> og skriv dit navn for at
							deltage i et møde, eller <strong>Som admin</strong> hvis du har en
							konto.
						</p>
						<p>
							Har du fået et mødenavn fra din vært, kan du indtaste det under
							"Deltag i et møde" når du er logget ind.
						</p>
					</div>
				</DialogContent>
			</Portal>
		</Dialog>
	)
}
