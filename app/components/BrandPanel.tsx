import { APP_NAME, APP_VERSION } from '~/utils/appInfo'
import { Disclaimer } from './Disclaimer'

export function BrandPanel() {
	return (
		<div className="relative flex flex-1 flex-col overflow-hidden bg-gradient-to-br from-[#10787d] via-[#0b565b] to-[#07373d] p-10 text-center">
			<div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
			<div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-black/10 blur-3xl" />

			<div className="flex flex-1 flex-col items-center justify-center gap-6">
				<svg
					className="h-16 w-16 drop-shadow-lg"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					aria-hidden="true"
				>
					<defs>
						<linearGradient
							id="voresBolt"
							x1="4"
							y1="2"
							x2="20"
							y2="22"
							gradientUnits="userSpaceOnUse"
						>
							<stop stopColor="#FFD23F" />
							<stop offset="1" stopColor="#F7911B" />
						</linearGradient>
					</defs>
					<path
						d="M13 2 4.5 13.5H11l-1.5 8.5L20 9.5h-6.7L13 2Z"
						fill="url(#voresBolt)"
					/>
				</svg>
				<div>
					<h1 className="flex items-center justify-center gap-2 text-4xl font-extrabold tracking-tight text-white">
						{APP_NAME}
						<span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/60 ring-1 ring-white/15">
							v{APP_VERSION}
						</span>
					</h1>
					<p className="mt-2 text-sm text-white/70">
						Sikre videomøder — når du har brug for det
					</p>
				</div>
				<div className="flex flex-wrap items-center justify-center gap-2">
					{['🎥 Videomøder', '🖥️ Skærmdeling', '⏱️ Ingen tidsgrænse'].map(
						(t) => (
							<span
								key={t}
								className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90 ring-1 ring-white/15"
							>
								{t}
							</span>
						)
					)}
				</div>
			</div>

			<Disclaimer className="relative text-center text-white/70" />
		</div>
	)
}
