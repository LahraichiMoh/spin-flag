"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { SpinnerWheel } from "@/components/spinner-wheel"
import { Card, CardContent } from "@/components/ui/card"
import Image from "next/image"
import { finalizeSpin } from "@/app/actions/finalize-spin"

import { type Campaign, getAvailablePrizes } from "@/app/actions/campaigns"

interface Participant {
  id: string
  name: string
  code: string
  city: string
  won: boolean
  prize_id: string | null
  campaign_id?: string
}

interface Prize {
  id: string
  name: string
  emoji: string
  image_url?: string
  max_winners: number
  current_winners: number
  color?: string
  campaign_id?: string
  available?: boolean
}

export default function SpinPage() {
  const params = useParams()
  const router = useRouter()
  const participantId = params.id as string
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [prizes, setPrizes] = useState<Prize[]>([])
  const [loading, setLoading] = useState(true)
  const [hasSpun, setHasSpun] = useState(false)
  const [resultPrize, setResultPrize] = useState<{ id: string; name: string; emoji: string; imageUrl?: string; color?: string } | null>(null)
  const [spinError, setSpinError] = useState<string | null>(null)
  const [cityId, setCityId] = useState<string | undefined>(undefined)

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
        setHasSpun(!!participantData.won)

        // Get campaign if exists
        let currentCampaignId = participantData.campaign_id
        if (currentCampaignId) {
           const { data: campaignData, error: campaignError } = await supabase
             .from("campaigns")
             .select("*")
             .eq("id", currentCampaignId)
             .single()
           
           if (!campaignError && campaignData) {
             setCampaign(campaignData as Campaign)
           }
        }

        // Get gifts
        if (currentCampaignId) {
             let resolvedCityId: string | undefined
             if (participantData.city) {
                 const { data: cityRows } = await supabase.from("cities").select("id").ilike("name", participantData.city).limit(1)
                 if (cityRows && cityRows.length > 0) resolvedCityId = cityRows[0].id
             }
             setCityId(resolvedCityId)

             const res = await getAvailablePrizes(currentCampaignId, resolvedCityId, participantData.city)
             if (res.success && res.data) {
                 setPrizes(res.data)
             } else {
                 // Fallback or empty
                 setPrizes([])
             }
        } else {
             // Fallback for legacy
             let query = supabase.from("gifts").select("*")
             const ownerId = process.env.NEXT_PUBLIC_GIFTS_OWNER_ID || ""
             if (ownerId) query = query.eq("created_by", ownerId)
             
             const { data: giftsData, error: giftsError } = await query.order("created_at", { ascending: true })
             if (giftsError) throw giftsError
             setPrizes(giftsData || [])
        }

        setLoading(false)
      } catch (error) {
        console.error("Error loading data:", error)
        setLoading(false)
      }
    }

    loadData()
  }, [participantId])

  useEffect(() => {
    if (!participant) return

    const supabase = createClient()
    const channel = supabase
      .channel("gifts-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "gifts" },
        (payload) => {
          const newGift = payload.new as unknown as Prize
          // Filter by campaign
          if (participant.campaign_id && newGift.campaign_id !== participant.campaign_id) return
          if (!participant.campaign_id && newGift.campaign_id) return // Don't show campaign gifts to legacy participants?
          
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
  }, [participant])

  const handleSpinComplete = async (selectedPrizeId: string) => {
    try {
      setSpinError(null)
      const selectedPrize = prizes.find((p) => p.id === selectedPrizeId)

      const result = await finalizeSpin(participantId, selectedPrizeId, cityId)
      if (!result.success) {
        // If limit reached, show friendly message
        if (result.error && (result.error.includes("limit reached") || result.error.includes("Stock épuisé") || result.error.includes("La période de participation") || result.error.includes("The guidance period"))) {
             if (result.error === "La période de participation est terminée pour aujourd'hui." || result.error === "The guidance period has ended for today.") {
                 setSpinError("La période de participation est terminée pour aujourd'hui.")
             } else {
                 setSpinError("Dommage ! Ce cadeau est épuisé pour votre ville. Veuillez réessayer.")
             }
             return
        }
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
      setSpinError("Une erreur est survenue. Veuillez réessayer.")
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
        
        <div className="relative w-screen h-screen">
          {(() => {
            const url = campaign?.theme?.loaderUrl || "/loader.jpg"
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
    const bgUrl = campaign?.theme?.backgroundUrl || process.env.NEXT_PUBLIC_SPIN_BACKGROUND_URL || "/flag-back.jpg"
    const logoUrl = campaign?.theme?.logoUrl || process.env.NEXT_PUBLIC_SPIN_LOGO_URL || "/casa_logo.png"
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

  const bgUrl = campaign?.theme?.backgroundUrl || process.env.NEXT_PUBLIC_SPIN_BACKGROUND_URL || "/flag-back.jpg"
  
  const wheelPrizes = prizes.map((p) => ({
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    imageUrl: p.image_url || (p.emoji?.startsWith("/") || p.emoji?.startsWith("http") ? (p.emoji as string) : undefined),
    color: p.color,
    available: p.available !== undefined ? p.available : p.current_winners < p.max_winners,
  }))

  return (
      <main
        className="min-h-screen relative overflow-hidden bg-[#002366]"
        style={bgUrl ? { backgroundImage: `url(${bgUrl})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat", backgroundPosition: "center" } : {}}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-white/5 pointer-events-none" />
        <div className="relative z-10 min-h-screen flex flex-col justify-center">
          <section className="w-full grid grid-cols-1 md:grid-cols-2 items-center px-6 md:px-12 gap-8">
            <div className="flex justify-center md:justify-start md:pl-10 lg:pl-20">
              <SpinnerWheel
                className="-mt-20 md:mt-0"
                participantName={participant.name}
                prizes={wheelPrizes}
                onSpinComplete={handleSpinComplete}
                hasSpun={hasSpun}
                resultPrize={resultPrize}
                spinError={spinError}
                pointerSide="top"
                spinLabel="Tournez pour la Gloire!"
                theme="default"
                customColors={{
                  primary: campaign?.theme?.primaryColor,
                  secondary: campaign?.theme?.secondaryColor
                }}
                campaignTheme={{
                  backgroundUrl: campaign?.theme?.backgroundUrl
                }}
              />
            </div>
          <div className="hidden md:flex justify-center items-center">
            {/* Placeholder for future backend content */}
          </div>
        </section>
      </div>
    </main>
  )
}
