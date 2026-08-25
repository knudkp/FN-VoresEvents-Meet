import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import type { FC } from 'react'
import { useState } from 'react'
import { useRoomContext } from '~/hooks/useRoomContext'
import { useRoomUrl } from '~/hooks/useRoomUrl'
import type { ClientMessage } from '~/types/Messages'
import { Button } from './Button'
import DropdownMenu from './DropdownMenu'
import { Icon } from './Icon/Icon'
import { MuteAllDialog } from './MuteAllDialog'
import { participantCount, ParticipantsDialog } from './ParticipantsMenu'
import { ReportBugDialog } from './ReportBugDialog'
import { SettingsDialog } from './SettingsDialog'
import { Tooltip } from './Tooltip'

interface OverflowMenuProps {
	bugReportsEnabled: boolean
}

export const OverflowMenu: FC<OverflowMenuProps> = ({ bugReportsEnabled }) => {
	const {
		room: { otherUsers, identity, roomState, websocket },
		dataSaverMode,
		setDataSaverMode,
		audioOnlyMode,
		setAudioOnlyMode,
		simulcastEnabled,
		userMedia: { turnCameraOff },
	} = useRoomContext()
	const [settingsMenuOpen, setSettingMenuOpen] = useState(false)
	const [bugReportMenuOpen, setBugReportMenuOpen] = useState(false)
	const [participantsMenuOpen, setParticipantsMenuOpen] = useState(false)
	const [muteAllOpen, setMuteAllOpen] = useState(false)
	const roomUrl = useRoomUrl()
	return (
		<>
			<DropdownMenu.Root>
				<Tooltip content="Flere indstillinger">
					<DropdownMenu.Trigger asChild>
						<Button displayType="secondary" aria-label="Flere indstillinger">
							<VisuallyHidden>Flere indstillinger</VisuallyHidden>
							<Icon type="EllipsisVerticalIcon" />
						</Button>
					</DropdownMenu.Trigger>
				</Tooltip>
				<DropdownMenu.Portal>
					<DropdownMenu.Content sideOffset={5}>
						{simulcastEnabled && (
							<DropdownMenu.Item
								onSelect={() => setDataSaverMode(!dataSaverMode)}
							>
								<Icon type="WifiIcon" className="mr-2" />
								{dataSaverMode
									? 'Slå databesparelse fra'
									: 'Slå databesparelse til'}
							</DropdownMenu.Item>
						)}
						<DropdownMenu.Item
							onSelect={() => {
								setAudioOnlyMode(!audioOnlyMode)
								turnCameraOff()
							}}
						>
							<Icon type="PhoneIcon" className="mr-2" />
							{audioOnlyMode ? 'Slå kun lyd fra' : 'Slå kun lyd til'}
						</DropdownMenu.Item>
						<DropdownMenu.Item
							onSelect={() => navigator.clipboard.writeText(roomUrl)}
						>
							<Icon type="ClipboardDocumentIcon" className="mr-2" />
							Kopiér link
						</DropdownMenu.Item>
						<DropdownMenu.Item
							onSelect={() => {
								setSettingMenuOpen(true)
							}}
						>
							<Icon type="cog" className="mr-2" />
							Indstillinger
						</DropdownMenu.Item>
						{bugReportsEnabled && (
							<DropdownMenu.Item
								onSelect={() => {
									setBugReportMenuOpen(true)
								}}
							>
								<Icon type="bug" className="mr-2" />
								Rapportér fejl
							</DropdownMenu.Item>
						)}
						<DropdownMenu.Item
							className="md:hidden"
							onSelect={() => {
								setParticipantsMenuOpen(true)
							}}
						>
							<Icon type="userGroup" className="mr-2" />
							{participantCount(otherUsers.length + 1)}
						</DropdownMenu.Item>
						{identity?.isHost && (
							<>
								<DropdownMenu.Item onSelect={() => setMuteAllOpen(true)}>
									<Icon type="micOff" className="mr-2" />
									Mute alle
								</DropdownMenu.Item>
								<DropdownMenu.Item
									onSelect={() =>
										websocket.send(
											JSON.stringify({
												type: 'lockRoom',
												locked: !roomState.roomLocked,
											} satisfies ClientMessage)
										)
									}
								>
									<Icon
										type={
											roomState.roomLocked ? 'LockOpenIcon' : 'LockClosedIcon'
										}
										className="mr-2"
									/>
									{roomState.roomLocked ? 'Lås mødet op' : 'Lås mødet'}
								</DropdownMenu.Item>
								<DropdownMenu.Item
									onSelect={() =>
										websocket.send(
											JSON.stringify({
												type: 'toggleChat',
												enabled: !roomState.chatEnabled,
											} satisfies ClientMessage)
										)
									}
								>
									<Icon type="chatBubble" className="mr-2" />
									{roomState.chatEnabled ? 'Slå chat fra' : 'Slå chat til'}
								</DropdownMenu.Item>
							</>
						)}
						<DropdownMenu.Arrow />
					</DropdownMenu.Content>
				</DropdownMenu.Portal>
			</DropdownMenu.Root>
			{settingsMenuOpen && (
				<SettingsDialog open onOpenChange={setSettingMenuOpen} />
			)}
			{bugReportsEnabled && bugReportMenuOpen && (
				<ReportBugDialog onOpenChange={setBugReportMenuOpen} />
			)}
			{participantsMenuOpen && (
				<ParticipantsDialog
					otherUsers={otherUsers}
					identity={identity}
					open
					onOpenChange={setParticipantsMenuOpen}
				/>
			)}
			{muteAllOpen && <MuteAllDialog onOpenChange={setMuteAllOpen} />}
		</>
	)
}
