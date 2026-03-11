import { cn } from "@/lib/utils"

export function WaveLogo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/wave_logo.svg"
      alt="Wave"
      className={cn("h-8 w-auto", className)}
    />
  )
}
