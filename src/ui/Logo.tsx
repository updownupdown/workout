export function Logo() {
  return (
    <div className="logo">
      <svg viewBox="0 0 32 32" aria-hidden>
        <defs>
          <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffb38a" />
            <stop offset="1" stopColor="#ff7a59" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#logo-g)" />
        <g stroke="#1b0f0a" strokeWidth="2.6" strokeLinecap="round" fill="none">
          <circle cx="16" cy="8.2" r="2.3" fill="#1b0f0a" stroke="none" />
          <path d="M16 12v7.5M16 13.5l-5.2-3.4M16 13.5l5.2-3.4M16 19.5l-3.6 6.5M16 19.5l4.6 3.4 3-3.4" />
        </g>
      </svg>
      <span>flow</span>
    </div>
  )
}
