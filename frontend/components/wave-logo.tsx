import { cn } from "@/lib/utils"

export function WaveLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-8", className)}
      aria-hidden="true"
    >
      <path
        d="M4 20C4 20 7 12 10 12C13 12 13 20 16 20C19 20 19 12 22 12C25 12 28 20 28 20"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary"
      />
      <path
        d="M4 24C4 24 7 18 10 18C13 18 13 24 16 24C19 24 19 18 22 18C25 18 28 24 28 24"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary/50"
      />
    </svg>
  )
}
