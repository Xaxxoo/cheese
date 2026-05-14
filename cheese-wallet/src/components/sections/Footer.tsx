export function Footer() {
  return (
    <footer className="border-t border-white/[0.04] px-6 py-10 text-center">
      <p className="text-2xl mb-4">🧀</p>
      <div className="flex items-center justify-center gap-6 mb-5">
        <a href="/signup"   className="text-xs text-[#555] hover:text-[#d4a843] transition-colors">Create account</a>
        <a href="/login"    className="text-xs text-[#555] hover:text-[#d4a843] transition-colors">Sign in</a>
        <a href="/waitlist" className="text-xs text-[#555] hover:text-[#d4a843] transition-colors">Join waitlist</a>
      </div>
      <p className="text-xs text-[#333] tracking-wide">
        © {new Date().getFullYear()} Cheese Wallet. All rights reserved.
      </p>
      <p className="text-xs text-[#222] mt-1">USD wallets for the modern world.</p>
    </footer>
  );
}
