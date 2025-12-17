"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"

interface Prize {
  id: string
  name: string
  emoji: string
  imageUrl?: string
  color?: string
  available?: boolean
}

interface SpinnerWheelProps {
  participantName: string
  prizes: Prize[]
  onSpinComplete: (prizeId: string) => void
  hasSpun: boolean
  resultPrize: Prize | null
  pointerSide?: "top" | "right"
  spinLabel?: string
  className?: string
  theme?: "default" | "gold"
}

export function SpinnerWheel({
  participantName,
  prizes,
  onSpinComplete,
  hasSpun,
  resultPrize,
  pointerSide = "top",
  spinLabel = "SPIN THE WHEEL!",
  className,
  theme = "default",
}: SpinnerWheelProps) {
  const [isSpinning, setIsSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [wheelSize, setWheelSize] = useState<number>(384)
  const [showWinnerModal, setShowWinnerModal] = useState(false)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const tickTimersRef = useRef<number[]>([])
  const playTick = () => {
    try {
      if (typeof window === "undefined") return
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!audioCtxRef.current) audioCtxRef.current = new AC()
      const ctx = audioCtxRef.current!
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "square"
      osc.frequency.value = 1000
      gain.gain.value = 0.03
      const now = ctx.currentTime
      gain.gain.setValueAtTime(0.03, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.05)
    } catch {}
  }

  const handleSpin = () => {
    if (isSpinning || hasSpun || prizes.length === 0) return

    setIsSpinning(true)

    // Choose among available prizes to ensure we never land on an exhausted wedge
    const availableIndices = prizes
      .map((p, i) => (p.available !== false ? i : -1))
      .filter((i) => i !== -1)
    if (availableIndices.length === 0) {
      setIsSpinning(false)
      return
    }
    const selectedIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)]
    const selectedPrizeId = prizes[selectedIndex].id

    const segmentAngle = 360 / prizes.length
    const pointerAngle = pointerSide === "right" ? 90 : 0
    const midAngle = selectedIndex * segmentAngle + segmentAngle / 2
    const baseSpin = 360 * 4 // four full turns
    const jitter = (Math.random() - 0.5) * (segmentAngle * 0.2) // small randomness within the wedge
    const targetRotation = baseSpin + pointerAngle - midAngle + jitter

    // Schedule decelerating tick sounds over the spin duration
    const totalTicks = prizes.length * 4
    const durationMs = 3000
    tickTimersRef.current.forEach((t) => clearTimeout(t))
    tickTimersRef.current = []
    for (let i = 0; i < totalTicks; i++) {
      const t = i / (totalTicks - 1)
      const easeOut = 1 - Math.pow(1 - t, 2)
      const at = Math.floor(easeOut * durationMs)
      const timer = window.setTimeout(() => playTick(), at)
      tickTimersRef.current.push(timer)
    }

    setRotation(targetRotation)

    setTimeout(() => {
      // Clear any remaining tick timers
      tickTimersRef.current.forEach((t) => clearTimeout(t))
      tickTimersRef.current = []

      setIsSpinning(false)
      onSpinComplete(selectedPrizeId)
    }, 3000)
  }

  useEffect(() => {
    if (hasSpun && resultPrize) {
      setShowWinnerModal(true)
    }
  }, [hasSpun, resultPrize])

  if (typeof window !== "undefined") {
    const calcSize = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const base = Math.min(vw, vh) * 0.8
      const clamped = Math.max(300, Math.min(560, Math.floor(base)))
      setWheelSize(clamped)
    }
    if ((window as any).__wheelResizeBound !== true) {
      calcSize()
      window.addEventListener("resize", calcSize)
      ;(window as any).__wheelResizeBound = true
    }
  }

  const borderColor = "border-white"
  const fallbackColors =
    theme === "gold"
      ? ["#A97100", "#B88400", "#C79600", "#D6A800", "#E5BA00", "#F4CC00", "#D0A000", "#BF8E00"]
      : ["#a30e0e", "#bb1010", "#d21212", "#e01515", "#a80f0f", "#bd1212", "#d91414", "#e61a1a"]
  const resultAccent =
    theme === "gold"
      ? "from-yellow-50 to-yellow-100 border-yellow-500 text-amber-700"
      : "from-yellow-50 to-yellow-100 border-yellow-400 text-gray-800"
  const buttonClasses =
    theme === "gold"
      ? "bg-amber-500 hover:bg-amber-600 text-white"
      : "bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900"

  return (
    <div className={className}>
      <div className="flex flex-col items-center space-y-6">
        <div className="relative">
          {pointerSide === "top" && (
            <div className="relative w-8 h-8 mb-4">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-8 border-l-transparent border-r-transparent border-t-amber-600" />
            </div>
          )}
          {prizes.length > 0 ? (
            (() => {
              const segmentAngle = 360 / prizes.length
              const colors = prizes.map((p, i) => p.color || fallbackColors[i % fallbackColors.length])
              const stops: string[] = []
              for (let i = 0; i < prizes.length; i++) {
                const start = i * (100 / prizes.length)
                const end = (i + 1) * (100 / prizes.length)
                stops.push(`${colors[i]} ${start}% ${end}%`)
              }
              const gradient = `conic-gradient(${stops.join(", ")})`
              const separators = `repeating-conic-gradient(#ffffff55 0deg, #ffffff55 .9deg, transparent .9deg, transparent calc(${360 / prizes.length}deg))`
              const radialShade = `radial-gradient(circle at 50% 50%, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.03) 60%)`
              return (
                <div
                  className={`relative rounded-full border ${borderColor} shadow-2xl overflow-hidden transform transition-transform duration-3000`}
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    backgroundImage: `${gradient}, ${separators}, ${radialShade}`,
                    width: wheelSize,
                    height: wheelSize,
                    borderWidth: 1,
                  }}
                >
                  {prizes.map((prize, index) => {
                    const startDeg = index * segmentAngle
                    const labelOffset = Math.round(wheelSize * 0.31)
                    return (
                      <div
                        key={prize.id}
                        className="absolute inset-0 flex items-center justify-center"
                        style={{
                          transform: `rotate(${startDeg + segmentAngle / 2}deg)`,
                        }}
                      >
                      <div
                        className="text-white font-semibold text-[13px] md:text-sm flex flex-col items-center gap-1 drop-shadow"
                        style={{ transform: `translateY(-${labelOffset}px)` }}
                      >
                        <span
                          className="text-center max-w-30 md:max-w-32"
                          style={theme === "gold" ? { writingMode: "sideways-lr" } : undefined}
                        >
                          {prize.name}
                        </span>
                      </div>
                      </div>
                    )
                  })}
                  {/* Removed inner ring to match design */}
                </div>
              )
            })()
          ) : (
            <div
              className="rounded-full border border-white bg-neutral-100 flex items-center justify-center text-center p-6"
              style={{ width: wheelSize, height: wheelSize, borderWidth: 1 }}
            >
              <p className="font-semibold text-neutral-600">Les récompenses sont terminées.</p>
            </div>
          )}
          {prizes.length > 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative pointer-events-auto">
                <button
                  onClick={handleSpin}
                  disabled={isSpinning || hasSpun || !prizes.some((p) => p.available !== false)}
                  className="w-14 h-14 rounded-full bg-white text-black font-bold shadow disabled:opacity-50"
                >
                  {isSpinning ? "..." : "Spin"}
                </button>
                {pointerSide === "top" ? (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-3 border-r-3 border-t-6 border-l-transparent border-r-transparent border-t-white" />
                ) : (
                  <div className="absolute top-1/2 -translate-y-1/2 -right-3 w-0 h-0 border-l-8 border-y-5 border-y-transparent border-l-white" />
                )}
              </div>
            </div>
          )}
          {pointerSide === "right" && (
            <div className="absolute top-1/2 -translate-y-1/2 -right-6 w-0 h-0 border-l-8 border-l-white border-y-8 border-y-transparent drop-shadow-md" />
          )}
        </div>
        {showWinnerModal && resultPrize && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-red-700/60 backdrop-blur-sm" onClick={() => setShowWinnerModal(false)} />
            <div className="relative w-[92vw] max-w-md mx-auto rounded-2xl border-2 border-yellow-500 shadow-2xl bg-gradient-to-b from-yellow-50 to-amber-100 p-8 text-center">
              <p className="text-2xl md:text-3xl font-extrabold text-amber-700">Félicitations !</p>
              <p className="text-xl md:text-2xl font-bold text-amber-800 mt-2">Vous avez gagné: {resultPrize.name}</p>
              {resultPrize.imageUrl && (resultPrize.imageUrl.startsWith("/") || resultPrize.imageUrl.startsWith("http")) ? (
                <img src={resultPrize.imageUrl} alt={resultPrize.name} className="w-36 h-36 md:w-36 md:h-36 mx-auto my-5 object-contain" />
              ) : null}
              <Button onClick={() => setShowWinnerModal(false)} className="mt-6 bg-amber-600 hover:bg-amber-700 text-white font-bold">
                Fermer
              </Button>
            </div>
          </div>
        )}
        
        <h3 className="text-md font-bold text-lg pt-8 text-white">Participant: {participantName}</h3>
      </div>
    </div>
  )
}
