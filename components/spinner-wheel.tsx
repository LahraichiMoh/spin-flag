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
  spinError?: string | null
  pointerSide?: "top" | "right"
  spinLabel?: string
  className?: string
  theme?: "default" | "gold"
  customColors?: {
    primary?: string
    secondary?: string
  }
  campaignTheme?: {
    backgroundUrl?: string
  }
}

export function SpinnerWheel({
  participantName,
  prizes,
  onSpinComplete,
  hasSpun,
  resultPrize,
  spinError,
  pointerSide = "top",
  spinLabel = "SPIN THE WHEEL!",
  className,
  theme = "default",
  customColors,
  campaignTheme,
}: SpinnerWheelProps) {
  const [isSpinning, setIsSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [wheelSize, setWheelSize] = useState<number>(384)
  const [showWinnerModal, setShowWinnerModal] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)

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

  useEffect(() => {
    if (spinError) {
      setShowErrorModal(true)
    }
  }, [spinError])

  if (typeof window !== "undefined") {
    const calcSize = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      // Adjust size calculation for responsiveness, especially for split screen on tablet/desktop
      const isSplitLayout = vw >= 768
      const availableWidth = isSplitLayout ? vw * 0.5 : vw
      const base = Math.min(availableWidth, vh) * 0.8
      // Clamp size: min 280px, max 450px (reduced from 500 for "a little smaller")
      const clamped = Math.max(280, Math.min(450, Math.floor(base)))
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
      : ["#1B365D", "#C5A572", "#1B365D", "#C5A572", "#1B365D", "#C5A572", "#1B365D", "#C5A572"]
  const resultAccent =
    theme === "gold"
      ? "from-yellow-50 to-yellow-100 border-yellow-500 text-amber-700"
      : "from-blue-50 to-blue-100 border-blue-800 text-blue-900"
  const buttonClasses =
    theme === "gold"
      ? "bg-amber-500 hover:bg-amber-600 text-white"
      : "bg-[#E31D2B] hover:bg-[#c41925] text-white"

  const hasAvailablePrizes = prizes.some(p => p.available !== false)

  return (
    <div className={className}>
      <div className="flex flex-col items-center space-y-6">
        <div className="relative">
          {pointerSide === "top" && (
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-20 w-8 h-10">
              {/* Black Triangle Pointer with White Outline */}
               <svg
                width="32"
                height="40"
                viewBox="0 0 32 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="drop-shadow-lg"
              >
                <path
                  d="M16 40L0 0H32L16 40Z"
                  fill="black"
                  stroke="white"
                  strokeWidth="4"
                />
              </svg>
            </div>
          )}
          {prizes.length > 0 && hasAvailablePrizes ? (
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
                    borderWidth: 5,
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
                        {prize.imageUrl ? (
                          <img
                            src={prize.imageUrl}
                            alt={prize.name}
                            className="w-8 h-8 md:w-12 md:h-12 object-contain drop-shadow-md"
                          />
                        ) : (
                          <span
                            className="text-center max-w-30 md:max-w-32"
                            style={theme === "gold" ? { writingMode: "sideways-lr" } : undefined}
                          >
                            {prize.name}
                          </span>
                        )}
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
              <p className="font-semibold text-neutral-600">
                {prizes.length === 0 ? "Aucune récompense configurée." : "Toutes les récompenses ont été distribuées."}
              </p>
            </div>
          )}
          {prizes.length > 0 && hasAvailablePrizes && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative pointer-events-auto">
                <div
                  className="w-4 h-4 rounded-full bg-white shadow-sm"
                />
              </div>
            </div>
          )}
          {pointerSide === "right" && (
            <div className="absolute top-1/2 -translate-y-1/2 -right-6 w-0 h-0 border-l-8 border-l-white border-y-8 border-y-transparent drop-shadow-md" />
          )}
        </div>

        <Button
          onClick={handleSpin}
          disabled={isSpinning || hasSpun || !hasAvailablePrizes}
          className={`px-18 py-10 border-4 border-white text-2xl font-bold rounded-full shadow-xl transform transition-all hover:scale-105 active:scale-95 flex flex-col items-center leading-tight ${
            isSpinning ? "opacity-50 cursor-not-allowed" : ""
          } ${!customColors?.primary ? buttonClasses : ""}`}
          style={
            customColors?.primary
              ? { backgroundColor: customColors.primary, color: "white" }
              : undefined
          }
        >
          {isSpinning ? (
            "..."
          ) : (
            <>
              <span className="text-3xl font-black tracking-wide">TOURNEZ</span>
              <span className="text-sm font-medium opacity-90">pour la Gloire!</span>
            </>
          )}
        </Button>

        {showWinnerModal && resultPrize && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowWinnerModal(false)} />
            <div 
              className={`relative w-[92vw] max-w-md mx-auto rounded-2xl border-2 shadow-2xl p-8 text-center overflow-hidden ${
                theme === "gold" ? "border-yellow-500 bg-gradient-to-b from-yellow-50 to-amber-100" : "border-blue-900 bg-gradient-to-b from-blue-50 to-white"
              }`}
              style={customColors?.secondary ? { borderColor: customColors.secondary } : undefined}
            >
              {campaignTheme?.backgroundUrl && (
                  <div className="absolute inset-0 z-0">
                      <img 
                          src={campaignTheme.backgroundUrl} 
                          alt="" 
                          className="w-full h-full object-cover opacity-20"
                      />
                      <div className="absolute inset-0 bg-white/40" />
                  </div>
              )}
              <div className="relative z-10">
                  <p 
                    className={`text-2xl md:text-3xl font-extrabold ${theme === "gold" ? "text-amber-700" : "text-blue-900"}`}
                    style={customColors?.primary ? { color: customColors.primary } : undefined}
                  >
                    Félicitations !
                  </p>
                  <p 
                    className={`text-xl md:text-2xl font-bold mt-2 ${theme === "gold" ? "text-amber-800" : "text-blue-800"}`}
                    style={customColors?.primary ? { color: customColors.primary, opacity: 0.9 } : undefined}
                  >
                    Vous avez gagné: {resultPrize.name}
                  </p>
                  {resultPrize.imageUrl && (resultPrize.imageUrl.startsWith("/") || resultPrize.imageUrl.startsWith("http")) ? (
                    <img src={resultPrize.imageUrl} alt={resultPrize.name} className="w-36 h-36 md:w-36 md:h-36 mx-auto my-5 object-contain drop-shadow-lg" />
                  ) : null}
                  <Button 
                    onClick={() => setShowWinnerModal(false)} 
                    className={`mt-6 text-white font-bold ${theme === "gold" ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-900 hover:bg-blue-800"}`}
                    style={customColors?.primary ? { backgroundColor: customColors.primary } : undefined}
                  >
                    Fermer
                  </Button>
              </div>
            </div>
          </div>
        )}

        {showErrorModal && spinError && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowErrorModal(false)} />
            <div 
              className="relative w-[92vw] max-w-md mx-auto rounded-2xl border-2 border-red-500 shadow-2xl bg-gradient-to-b from-red-50 to-white p-8 text-center overflow-hidden"
            >
               {campaignTheme?.backgroundUrl && (
                  <div className="absolute inset-0 z-0">
                      <img 
                          src={campaignTheme.backgroundUrl} 
                          alt="" 
                          className="w-full h-full object-cover opacity-10"
                      />
                  </div>
              )}
              <div className="relative z-10">
                  <p className="text-2xl md:text-3xl font-extrabold text-red-600 mb-4">
                    Oups !
                  </p>
                  <p className="text-lg text-gray-800 mb-6">
                    {spinError.includes("City limit") 
                        ? "Dommage ! Ce cadeau est épuisé pour votre ville. Veuillez réessayer."
                        : spinError
                    }
                  </p>
                  <Button 
                    onClick={() => window.location.reload()} 
                    className="bg-red-600 hover:bg-red-700 text-white font-bold px-8"
                  >
                    Réessayer
                  </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* <h3 className="text-md font-bold text-lg pt-8 text-white">Animateur: {participantName}</h3> */}
      </div>
    </div>
  )
}
