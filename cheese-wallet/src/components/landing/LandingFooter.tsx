'use client'

const LINKS: Record<string, string[]> = {
  Product: ['How It Works', 'Features', 'Security', 'Pricing'],
  Company: ['About', 'Blog', 'Careers', 'Contact'],
  Legal:   ['Privacy Policy', 'Terms of Service', 'Cookie Policy'],
}

export function LandingFooter() {
  return (
    <footer className="border-t py-16 px-6" style={{ background: '#050505', borderColor: 'rgba(255,255,255,0.04)' }}>
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-16">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <img src="/logo.png" alt="Cheese Pay" className="w-7 h-7 rounded-lg object-contain" />
              <span className="text-white font-semibold text-sm">CheesePay</span>
            </div>
            <p className="text-[#555] text-xs leading-relaxed max-w-[180px]">
              Hold stablecoins. Send Naira. Live normally in Nigeria.
            </p>
          </div>

          {/* Links */}
          {Object.entries(LINKS).map(([category, links]) => (
            <div key={category}>
              <div className="text-[#555] text-[10px] font-medium uppercase tracking-[0.15em] mb-4">{category}</div>
              <ul className="space-y-3">
                {links.map(link => (
                  <li key={link}>
                    <a
                      href={link === 'Privacy Policy' ? '/privacy' : link === 'Terms of Service' ? '/terms' : '#'}
                      className="text-[#B5B5B5] text-xs hover:text-white transition-colors"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between pt-8 border-t gap-4" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
          <p className="text-[#333] text-xs">&copy; {new Date().getFullYear()} CheesePay. All rights reserved.</p>
          <p className="text-[#333] text-xs">Your stablecoins, usable everywhere in Nigeria.</p>
        </div>
      </div>
    </footer>
  )
}
