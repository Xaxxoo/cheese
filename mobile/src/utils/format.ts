export function fmtUsdc(value: string | number, decimals = 2): string {
  return `$${parseFloat(String(value)).toLocaleString('en-NG', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

export function fmtNgn(value: string | number): string {
  return `₦${parseFloat(String(value)).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function truncateAddress(addr: string, chars = 6): string {
  if (addr.length <= chars * 2) return addr
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`
}
