// Shared building blocks that carry the site's look (an interrogation room: dark walls, lamp gold, suspect red)

export function Tape({ className = 'h-2' }) {
  return <div aria-hidden="true" className={`tape ${className}`} />
}

export function CenterCard({ title, children }) {
  return (
    <main className="noir-bg flex min-h-dvh items-center justify-center p-4 text-ink">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border-2 border-line bg-card text-center shadow-2xl">
        <Tape />
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

