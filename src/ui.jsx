// Shared building blocks that carry the site's look (a spaceship at night: starfield, alien green, nebula purple)

// The glowing strip across the top of a card or screen (a tractor beam)
export function Beam({ className = 'h-2' }) {
  return <div aria-hidden="true" className={`beam ${className}`} />
}

export function CenterCard({ title, children }) {
  return (
    <main className="space-bg flex min-h-dvh items-center justify-center p-4 text-ink">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border-2 border-line bg-card text-center shadow-2xl">
        <Beam />
        <div className="p-8">
          <h1 className="font-display text-3xl uppercase tracking-wider text-accent glow-accent">{title}</h1>
          {children}
        </div>
      </div>
    </main>
  )
}

export function Label({ children, className = '' }) {
  return <p className={`font-mono text-xs uppercase tracking-[0.25em] text-info ${className}`}>{children}</p>
}

const BUTTONS = {
  primary: 'border-2 border-accent bg-accent text-on-accent hover:brightness-110',
  accent: 'border-2 border-info bg-info text-black hover:brightness-110',
  success: 'border-2 border-ok bg-ok text-black hover:brightness-110',
  outline: 'border-2 border-line bg-panel text-ink hover:bg-hover',
}

export function Button({ variant = 'primary', className = '', ...props }) {
  return (
    <button
      className={`rounded-lg px-6 py-3 font-bold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-40 ${BUTTONS[variant]} ${className}`}
      {...props}
    />
  )
}

