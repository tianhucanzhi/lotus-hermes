import { LotusLogo } from '@/components/lotus-logo'
import { cn } from '@/lib/utils'

// Brand badge: blooming lotus with AI accents on a soft gradient tile.
export function BrandMark({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'inline-flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-sky-50 to-blue-100 p-2 shadow-sm ring-1 ring-blue-200/60 dark:from-slate-900 dark:to-blue-950 dark:ring-blue-500/30',
        className
      )}
      {...props}
    >
      <LotusLogo className="size-full" showOrbit={false} />
    </span>
  )
}
