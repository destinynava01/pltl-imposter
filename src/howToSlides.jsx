/* eslint-disable react-refresh/only-export-components -- static slide content with small local helpers */
// The "How to play" slides for Imposter (shown on the projector when the game starts)

function Phone({ children, alien }) {
  return <div className={`w-52 rounded-[1.6rem] border-4 p-3 text-center text-white shadow-xl ${alien ? 'border-green-400 bg-green-950' : 'border-slate-600 bg-[#0d1124]'}`}>{children}</div>
}

export const SLIDES = [
  {
    title: 'Everyone gets the secret category',
    text: 'Each crew\'s phones show the same secret category, except one student: the alien, whose phone just says they\'re the alien.',
    art: (
      <div className="flex gap-4">
        <Phone><p className="text-xs uppercase tracking-widest text-slate-400">Your secret category</p><p className="mt-1 text-xl font-black uppercase">Stages of mitosis</p></Phone>
        <Phone alien><p className="text-4xl">👽</p><p className="font-black uppercase text-green-400">You&apos;re the alien</p><p className="mt-1 text-xs text-slate-300">Blend in!</p></Phone>
      </div>
    ),
  },
  {
    title: 'Think, then give one example',
    text: 'After the thinking time, everyone says one example out loud, in the order on the screen, and taps Done. Be precise enough to prove you know it, but not so obvious the alien can copy you.',
    art: (
      <ol className="w-64 space-y-1.5 text-lg">
        <li className="rounded-lg px-3 py-1.5 text-slate-500 line-through">1 Maria: &ldquo;prophase&rdquo;</li>
        <li className="rounded-lg bg-purple-500/30 px-3 py-1.5 font-bold ring-2 ring-purple-400">2 José 🎤 speaking</li>
        <li className="rounded-lg bg-white/10 px-3 py-1.5">3 Ana</li>
        <li className="rounded-lg bg-white/10 px-3 py-1.5">4 Kim</li>
      </ol>
    ),
  },
  {
    title: 'Vote out the alien',
    text: 'When everyone has spoken, the crew votes on their phones for who they think the alien is. Whoever gets the most votes is unmasked.',
    art: (
      <Phone>
        <p className="font-black uppercase text-green-400">Who&apos;s the alien?</p>
        {['Maria', 'José', 'Kim'].map((n) => <p key={n} className={`mt-1.5 rounded-lg py-2 font-bold ${n === 'Kim' ? 'bg-green-400 text-black' : 'bg-white/10'}`}>{n === 'Kim' ? '👉 ' : ''}{n}</p>)}
      </Phone>
    ),
  },
  {
    title: 'One last guess',
    text: 'An unmasked alien gets one guess at the secret category. Guess it right and the alien still wins!',
    art: (
      <Phone alien>
        <p className="text-sm font-bold">You were caught!</p>
        <p className="mt-2 rounded-lg border-2 border-green-400 bg-black/40 py-2 font-mono">cell division?</p>
        <p className="mt-2 rounded-lg bg-green-400 py-2 font-black text-black">Lock in my guess</p>
      </Phone>
    ),
  },
  {
    title: 'Scoring and hard mode',
    text: 'Alien unmasked: the rest of the crew gets +1. Alien escapes or guesses right: the alien gets +2. In hard mode the alien isn\'t told and gets a similar category (Cell cycle), so a clue like "interphase" gives them away.',
    art: (
      <div className="space-y-2 text-lg font-black">
        <p className="rounded-xl bg-cyan-500/20 px-4 py-2 text-cyan-300">Unmasked · crew +1 each</p>
        <p className="rounded-xl bg-green-500/20 px-4 py-2 text-green-300">Escaped · alien +2</p>
        <p className="rounded-xl bg-white/10 px-4 py-2 text-slate-200">Hard mode: &ldquo;Cell cycle&rdquo; vs &ldquo;Stages of mitosis&rdquo;</p>
      </div>
    ),
  },
]
