import { ArrowRightLeft, Download, Sparkles, Swords } from 'lucide-react'
import type { ComponentType } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSettings } from '@/state/settings'
import { useUi } from '@/state/ui'

const MOVES: Array<{ icon: ComponentType<{ className?: string }>; name: string; line: string }> = [
  { icon: ArrowRightLeft, name: 'Relay', line: 'Send an answer to the other model as the next turn.' },
  { icon: Sparkles, name: 'Synthesize', line: 'Ask the other model for the best of both answers.' },
  { icon: Swords, name: 'Debate', line: 'Rounds of challenge and defence, then a closing answer.' },
  { icon: Download, name: 'Export', line: 'Copy the thread or download it as a briefing.' },
]

/**
 * The placard in the empty thread, and the body of the About dialog.
 * Explains what Relay is, why two models, the moves, and where data goes.
 */
export function OnboardingCard({ variant }: { variant: 'empty' | 'dialog' }) {
  const anthropicKey = useSettings((s) => s.anthropicKey)
  const xaiKey = useSettings((s) => s.xaiKey)
  const hasKeys = !!anthropicKey || !!xaiKey

  const cta =
    variant === 'dialog'
      ? { label: 'Close', onClick: () => useUi.getState().setAboutOpen(false) }
      : hasKeys
        ? {
            label: 'Start below',
            onClick: () => document.getElementById('composer')?.focus(),
          }
        : { label: 'Add API keys', onClick: () => useUi.getState().setSettingsOpen(true) }

  return (
    <article
      className={cn(
        'mx-auto w-full max-w-[34rem]',
        variant === 'empty' && 'rounded-[2px] border px-6 py-7 sm:px-7',
      )}
    >
      <p className="label">Dual-model thread</p>
      <h2 className="mt-2.5 text-[44px] font-extrabold tracking-[-0.03em] leading-none">RELAY</h2>
      <p className="mt-3.5 text-lg font-light">One question. Two minds. You decide.</p>
      <div className="my-6 h-px w-14 bg-foreground/25" aria-hidden="true" />

      <Section label="What it does">
        Claude and Grok answer in one rolling thread. Each sees the other's words as context,
        so you can hand an answer across, ask for the best of both, or make them argue.
      </Section>

      <Section label="Why two models">
        A single model tends to agree with your framing. Two models trained apart make
        different mistakes. When one has to defend its answer against the other, the weak parts
        show. What survives is worth more than a first draft.
      </Section>

      <p className="label mb-1">The moves</p>
      <ul className="border-b">
        {MOVES.map(({ icon: Icon, name, line }) => (
          <li key={name} className="flex items-baseline gap-3.5 border-t py-2.5">
            <Icon className="size-[15px] shrink-0 translate-y-[2px] text-muted-foreground" />
            <span className="w-24 shrink-0 text-[15px]">{name}</span>
            <span className="text-[13px] leading-relaxed font-light text-muted-foreground">
              {line}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3.5 mb-5 text-[13px] leading-relaxed font-light text-muted-foreground">
        Also: attach images, turn on web search per message, save snapshots, set reply length in
        Settings.
      </p>

      <Section label="Your data">
        Keys and threads stay on this device. Messages go only to Anthropic and xAI.
      </Section>

      <Button
        variant="outline"
        className="label mt-1 h-10 rounded-[2px] border-foreground/50 px-6 text-foreground"
        onClick={cta.onClick}
      >
        {cta.label}
      </Button>
    </article>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <p className="label mb-1.5">{label}</p>
      <p className="text-[15px] leading-[1.7] font-light">{children}</p>
    </section>
  )
}
