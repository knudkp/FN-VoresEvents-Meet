import { useFetcher } from '@remix-run/react'
import * as RadixDialog from '@radix-ui/react-dialog'
import { useEffect, useState } from 'react'
import type { action as adminAction, loader as adminLoader } from '~/routes/admin'
import { cn } from '~/utils/style'
import { AdminNav, AdminPanelSections, type AdminTabId } from './AdminPanel'
import { Button } from './Button'
import { Dialog, DialogClose, DialogOverlay, DialogTitle, Portal, Trigger } from './Dialog'
import { Tooltip } from './Tooltip'

export function AdminPanelDialog() {
	const [open, setOpen] = useState(false)
	const [activeTab, setActiveTab] = useState<AdminTabId>('users')
	const loaderFetcher = useFetcher<typeof adminLoader>()
	const actionFetcher = useFetcher<typeof adminAction>()

	useEffect(() => {
		if (open) loaderFetcher.load('/admin')
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open])

	useEffect(() => {
		if (open && actionFetcher.state === 'idle' && actionFetcher.data) {
			loaderFetcher.load('/admin')
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [actionFetcher.state, actionFetcher.data])

	const data = loaderFetcher.data

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<Tooltip content="Åbn admin-panel">
				<Trigger asChild>
					<button
						type="button"
						aria-label="Åbn admin-panel"
						className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
					>
						Admin
					</button>
				</Trigger>
			</Tooltip>
			<Portal>
				<DialogOverlay />
				<RadixDialog.Content
					className={cn(
						'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
						'flex h-[85vh] w-[min(1100px,96vw)] flex-row overflow-hidden',
						'rounded-lg bg-white shadow-2xl',
						'dark:bg-zinc-900'
					)}
				>
					<AdminNav activeTab={activeTab} onTabChange={setActiveTab} />
					<div className="flex min-h-0 flex-1 flex-col">
						<div className="flex items-center justify-between border-b border-zinc-200 px-6 py-5 pr-14 dark:border-zinc-700">
							<DialogTitle>Admin</DialogTitle>
						</div>
						<div className="min-h-0 flex-1 overflow-y-auto p-8">
							{data ? (
								<AdminPanelSections
									data={data}
									actionData={actionFetcher.data}
									activeTab={activeTab}
									FormComponent={actionFetcher.Form}
								/>
							) : (
								<p className="text-sm text-zinc-500">Henter...</p>
							)}
						</div>
						<div className="flex items-center justify-end border-t border-zinc-200 px-6 py-4 dark:border-zinc-700">
							<Tooltip content="Luk admin-panelet">
								<Button
									type="button"
									displayType="secondary"
									onClick={() => setOpen(false)}
									aria-label="Luk admin-panelet"
								>
									Luk
								</Button>
							</Tooltip>
						</div>
					</div>
					<DialogClose />
				</RadixDialog.Content>
			</Portal>
		</Dialog>
	)
}
