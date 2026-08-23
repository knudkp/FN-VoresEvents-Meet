import {
	Dialog,
	DialogContent,
	DialogOverlay,
	DialogTitle,
	Portal,
	Trigger,
} from './Dialog'

export function HelpDialog() {
	return (
		<Dialog>
			<Trigger asChild>
				<button
					type="button"
					aria-label="Hjælp"
					className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 text-sm font-semibold text-zinc-500 hover:border-[#0d6d72] hover:text-[#0d6d72]"
				>
					?
				</button>
			</Trigger>
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
