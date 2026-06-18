'use client'

import { useState, useEffect } from 'react'
import '@/app/wallet/wallet.css'

export function PWAInstallPrompt() {
  const [prompt, setPrompt] = useState<any>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('pwa-install-dismissed')) {
      setDismissed(true)
      return
    }

    function handler(e: Event) {
      e.preventDefault()
      setPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!prompt || dismissed) return null

  async function install() {
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      setPrompt(null)
    }
  }

  function dismiss() {
    setDismissed(true)
    localStorage.setItem('pwa-install-dismissed', '1')
  }

  return (
    <div className="install-prompt">
      <div className="install-prompt-icon">
        <svg viewBox="0 0 24 24">
          <path d="M12 2v13M7 11l5 5 5-5M3 18h18" />
        </svg>
      </div>
      <div className="install-prompt-text">
        <div className="install-prompt-title">Add to Home Screen</div>
        <div className="install-prompt-sub">Get the full app experience</div>
      </div>
      <button type="button" className="install-prompt-btn" onClick={install}>
        Install
      </button>
      <button type="button" className="install-prompt-close" onClick={dismiss}>
        ×
      </button>
    </div>
  )
}
