import { LotusLogo } from '@/components/lotus-logo'

export type IntroProps = {
  personality?: string
  seed?: number
}

const INTRO_TITLE = 'LOTUS AGENT'
const INTRO_TAGLINE = '你的养成系 AI 助理'
const INTRO_SUBLINE = '每一次对话，Lotus 都会更懂你一点，陪你一起进化成长。'

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
          className="m-0 text-center text-2xl font-bold tracking-[0.12em] text-primary sm:text-3xl"
        >
          {INTRO_TITLE}
        </p>

        <p className="m-0 mt-3 text-center text-base font-medium tracking-tight text-foreground">{INTRO_TAGLINE}</p>
        <p className="m-0 mt-2 text-center leading-normal tracking-tight">{INTRO_SUBLINE}</p>
      </div>
    </div>
  )
}
