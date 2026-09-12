import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useUi } from '@/state/ui'
import { OnboardingCard } from './OnboardingCard'

export function AboutDialog() {
  const open = useUi((s) => s.aboutOpen)
  const setOpen = useUi((s) => s.setAboutOpen)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85dvh] max-w-lg overflow-y-auto p-6 sm:p-7">
        <DialogTitle className="sr-only">About Relay</DialogTitle>
        <DialogDescription className="sr-only">
          What Relay does, why it uses two models, and where your data goes.
        </DialogDescription>
        <OnboardingCard variant="dialog" />
      </DialogContent>
    </Dialog>
  )
}
