"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { SpinnerWheel } from "@/components/spinner-wheel"
import { Card, CardContent } from "@/components/ui/card"
import Image from "next/image"
import { finalizeSpin } from "@/app/actions/finalize-spin"

interface Participant {
  id: string
  name: string
  code: string
  won: boolean
  prize_id: string | null
}

interface Prize {
  id: string
  name: string
  emoji: string
  image_url?: string
  max_winners: number
  current_winners: number
  color?: string
}

export default function SpinPage() {
  const params = useParams()
  const router = useRouter()
  const participantId = params.id as string
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [prizes, setPrizes] = useState<Prize[]>([])
  const [loading, setLoading] = useState(true)
  const [hasSpun, setHasSpun] = useState(false)
  const [resultPrize, setResultPrize] = useState<{ id: string; name: string; emoji: string; imageUrl?: string; color?: string } | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createClient()

        // Get participant data
        const { data: participantData, error: participantError } = await supabase
          .from("participants")
          .select("*")
          .eq("id", participantId)
          .single()

        if (participantError) throw participantError
        setParticipant(participantData)

        // Get all gifts/prizes (optionally filter by owner and keep insertion order)
        const ownerId = process.env.NEXT_PUBLIC_GIFTS_OWNER_ID || ""
        const base = supabase.from("gifts").select("*")
        const builder = ownerId ? base.eq("created_by", ownerId) : base
        const { data: giftsData, error: giftsError } = await builder.order("created_at", { ascending: true })

        if (giftsError) throw giftsError
        setPrizes(giftsData || [])

        setLoading(false)
      } catch (error) {
        console.error("Error loading data:", error)
        setLoading(false)
      }
    }

    loadData()
  }, [participantId])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("gifts-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "gifts" },
        (payload) => {
          const newGift = payload.new as unknown as Prize
          setPrizes((prev) => {
            if (prev.find((p) => p.id === newGift.id)) return prev
            return [...prev, newGift]
          })
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "gifts" },
        (payload) => {
          const updated = payload.new as unknown as Prize
          setPrizes((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)))
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "gifts" },
        (payload) => {
          const oldId = (payload.old as { id: string }).id
          setPrizes((prev) => prev.filter((p) => p.id !== oldId))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleSpinComplete = async (selectedPrizeId: string) => {
    try {
      const selectedPrize = prizes.find((p) => p.id === selectedPrizeId)

      const result = await finalizeSpin(participantId, selectedPrizeId)
      if (!result.success) {
        throw new Error(result.error || "Failed to finalize spin")
      }

      // Increment winner count for the prize
      if (selectedPrize) {
        setPrizes((prev) =>
          prev.map((p) =>
            p.id === selectedPrizeId
              ? { ...p, current_winners: Math.min(p.current_winners + 1, p.max_winners) }
              : p,
          ),
        )
      }

      const mapped = selectedPrize
        ? {
            id: selectedPrize.id,
            name: selectedPrize.name,
            emoji: selectedPrize.emoji,
            imageUrl:
              selectedPrize.image_url ||
              (selectedPrize.emoji?.startsWith("/") || selectedPrize.emoji?.startsWith("http")
                ? (selectedPrize.emoji as string)
                : undefined),
            color: selectedPrize.color,
          }
        : null
      setResultPrize(mapped)
      setHasSpun(true)
    } catch (error) {
      console.error("Error updating result:", error)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
        
        <div className="relative w-screen h-screen">
          {(() => {
            const url = "/loader.jpg"
            return (
              <Image
                src={url}
                alt="Loading Logo"
                fill
                priority
                className="object-cover animate-zoom-in-out"
              />
            )
          })()}
        </div>
        
      </main>
    )
  }

  if (!participant) {
    const bgUrl = process.env.NEXT_PUBLIC_SPIN_BACKGROUND_URL || "/casa.jpg"
    const logoUrl = process.env.NEXT_PUBLIC_SPIN_LOGO_URL || "/casa_logo.png"
    return (
      <main
        className="min-h-screen relative overflow-hidden"
        style={bgUrl ? { backgroundImage: `url(${bgUrl})`, backgroundSize: "cover", backgroundPosition: "center left" } : {}}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/10 pointer-events-none" />
        <div className="relative z-10 min-h-screen flex flex-col">
          <header className="p-4">
            {logoUrl && (
              <Image
                src={logoUrl}
                alt="Brand Logo"
                width={160}
                height={160}
                priority
                className="h-32 w-auto max-w-[80vw] mx-auto md:mx-0"
              />
            )}
          </header>
          <section className="flex-1 flex items-center justify-center px-6">
            <div className="relative w-[92vw] max-w-md mx-auto rounded-2xl border-2 border-yellow-500 shadow-2xl bg-gradient-to-b from-yellow-50 to-amber-100 p-8 text-center">
              <p className="text-2xl md:text-3xl font-extrabold text-amber-700">Une erreur s’est produite</p>
              <p className="text-md md:text-lg font-medium text-amber-800 mt-2">Impossible de charger les données du tirage.</p>
              <button
                onClick={() => router.push("/")}
                className="mt-6 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg px-5 py-3"
              >
                Réessayer
              </button>
            </div>
          </section>
        </div>
      </main>
    )
  }

  const bgUrl = process.env.NEXT_PUBLIC_SPIN_BACKGROUND_URL || "/casa.jpg"
  const logoUrl = process.env.NEXT_PUBLIC_SPIN_LOGO_URL || "/casa_logo.png"
  const bottleUrl = process.env.NEXT_PUBLIC_SPIN_BOTTLE_URL || "/beer.png"
  const wheelPrizes = prizes.map((p) => ({
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    imageUrl: p.image_url || (p.emoji?.startsWith("/") || p.emoji?.startsWith("http") ? (p.emoji as string) : undefined),
    color: p.color,
    available: p.current_winners < p.max_winners,
  }))

  return (
    <main
      className="min-h-screen relative overflow-hidden"
      style={bgUrl ? { backgroundImage: `url(${bgUrl})`, backgroundSize: "cover", backgroundPosition: "center left" } : {}}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-white/5 pointer-events-none" />
      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="p-4">
          {logoUrl && (
            <Image
              src={logoUrl}
              alt="Brand Logo"
              width={160}
              height={60}
              priority
              className="h-30 w-auto max-w-[80vw] mx-auto md:mx-0 md:h-20 lg:h-20"
            />
          )}
        </header>
        <section className="flex-1 grid grid-cols-1 items-center px-6 md:px-12">
          <div className="flex justify-center">
            <SpinnerWheel
              participantName={participant.name}
              prizes={wheelPrizes}
              onSpinComplete={handleSpinComplete}
              hasSpun={hasSpun}
              resultPrize={resultPrize}
              pointerSide="right"
              spinLabel="Tournez pour la Gloire!"
              theme="gold"
              className="md:translate-y-6"
            />
          </div>
          <div className="flex justify-center md:justify-end md:hidden">
            {bottleUrl && (
              <div className="relative">
                <Image src={bottleUrl} alt="Bottle" width={420} height={800} priority className="h-auto w-[200px] md:w-[220px]" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[320px] h-6 md:w-[420px] md:h-8 bg-neutral-200 rounded-t-2xl" />
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
