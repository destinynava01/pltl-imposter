// Link from /submit and /review back to the leader screen. Same-tab navigation keeps the
// leader's game, since it's saved per browser tab.
export default function BackToGame() {
  return (
    <a
      href="/"
      className="mb-4 inline-block text-sm font-bold text-info hover:brightness-125"
    >
      ← Back to the game
    </a>
  )
}
