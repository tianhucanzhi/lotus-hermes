import { LotusLogo } from '@/components/lotus-logo'

export type IntroProps = {
  personality?: string
  seed?: number
}

const INTRO_TITLE = 'Lotus - 莲花成长体'
const INTRO_TAGLINE = '会成长的Al数字员工，你提要求，它出结果'

export function Intro(_props: IntroProps) {
  return (
    <div
      className="pointer-events-none flex w-full min-w-0 flex-col items-center justify-center px-0.5 py-6 text-center text-muted-foreground sm:px-6 lg:px-8"
      data-slot="aui_intro"
    >
      <div className="w-full min-w-0">
        <LotusLogo
          aria-hidden
          className="mx-auto mb-4 size-24 sm:size-28"
        />

        <p
          aria-label={INTRO_TITLE}
          className="m-0 text-center text-2xl font-bold tracking-tight text-primary sm:text-3xl"
        >
          {INTRO_TITLE}
        </p>

        <p className="m-0 mt-3 text-center text-base font-medium tracking-tight text-foreground">{INTRO_TAGLINE}</p>
      </div>
    </div>
  )
}
