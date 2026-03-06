import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | null | undefined) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export function formatDateTime(date: string | null | undefined) {
  if (!date) return '—'
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatNumber(n: number | null | undefined) {
  if (n == null) return '0'
  return new Intl.NumberFormat('en-US').format(n)
}

export function formatCurrency(n: number | null | undefined, symbol = 'Nano') {
  if (n == null) return `0 ${symbol}`
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n)} ${symbol}`
}

export function truncate(str: string | null | undefined, len = 40) {
  if (!str) return '—'
  return str.length > len ? str.slice(0, len) + '…' : str
}

export function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}
