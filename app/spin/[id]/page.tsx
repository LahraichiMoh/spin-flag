"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { SpinnerWheel } from "@/components/spinner-wheel"
import { Button } from "@/components/ui/button"
import { finalizeSpin, getSpinData } from "@/app/actions/finalize-spin"
import { Loader2 } from "lucide-react"
import { type Campaign } from "@/app/actions/campaigns"

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
  const [isAdmin, setIsAdmin] = useState(false)
  const [resultPrize, setResultPrize] = useState<{ id: string; name: string; imageUrl?: string; color?: string } | null>(null)
  const [spinError, setSpinError] = useState<string | null>(null)
  const [cityId, setCityId] = useState<string | undefined>(undefined)
  const [creatingReplay, setCreatingReplay] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createClient()

        let admin = false
        const { data: auth, error: authError } = await supabase.auth.getUser()
        if (!authError && auth.user) {
          const { data: adminRow } = await supabase
            .from("admins")
            .select("id")
            .eq("id", auth.user.id)
            .maybeSingle()
          admin = !!adminRow
        }
        setIsAdmin(admin)

        const spinData = await getSpinData(participantId)
        if (!spinData.success || !spinData.data) throw new Error(spinData.error || "Failed to load spin data")
        const participantData = spinData.data.participant as any

        if (participantData.won) {
          try {
            const baseCode = String(participantData.code ?? "").trim()
            const insertBase = {
              name: participantData.name,
              code: baseCode,
              city: participantData.city,
              agreed_to_terms: participantData.agreed_to_terms ?? true,
              won: false,
              prize_id: null,
              campaign_id: participantData.campaign_id ?? null,
            }

            const firstId = crypto.randomUUID()
            const first = await supabase.from("participants").insert({ ...insertBase, id: firstId })
            if (!first.error) {
              router.replace(`/spin/${firstId}`)
              return
            }

            const isDup = first.error.code === "23505" || first.error.message?.toLowerCase().includes("duplicate")
            if (!isDup) throw first.error

            const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase()
            const secondId = crypto.randomUUID()
            const second = await supabase
              .from("participants")
              .insert({ ...insertBase, id: secondId, code: `${baseCode}-${suffix}` })
            if (second.error) throw second.error
            router.replace(`/spin/${secondId}`)
            return
          } catch (e) {
            const msg =
              e instanceof Error ? e.message : "Erreur lors de la création d'un nouveau participant"
            setSpinError(msg)
          }
        }

        setParticipant(participantData)
        setHasSpun(!!participantData.won)

        setCampaign(spinData.data.campaign as any)
        setPrizes((spinData.data.prizes as any) || [])
        setCityId(spinData.data.cityId)

        setLoading(false)
      } catch (error) {
        console.error("Error loading data:", error)
        setLoading(false)
      }
    }

    loadData()
  }, [participantId, router])

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

      const result = await finalizeSpin(participantId, selectedPrizeId, cityId, isAdmin)
      if (!result.success) {
        // If limit reached, show friendly message
        if (result.error && (result.error.includes("limit reached") || result.error.includes("Stock épuisé") || result.error.includes("La période de participation") || result.error.includes("The guidance period"))) {
             if (result.error === "La période de participation est terminée pour aujourd'hui." || result.error === "La période de participation est terminée pour aujourd'hui.") {
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
            imageUrl:
              selectedPrize.image_url,
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

  const handleReplay = async () => {
    if (!participant || creatingReplay) return
    setSpinError(null)
    setCreatingReplay(true)
    try {
      const supabase = createClient()
      const baseCode = String(participant.code ?? "").trim()
      const insertBase: any = {
        name: participant.name,
        code: baseCode,
        city: participant.city,
        agreed_to_terms: true,
        won: false,
        prize_id: null,
        campaign_id: participant.campaign_id ?? null,
      }

      const firstId = crypto.randomUUID()
      const first = await supabase.from("participants").insert({ ...insertBase, id: firstId })
      if (!first.error) {
        router.replace(`/spin/${firstId}`)
        return
      }

      const isDup = first.error.code === "23505" || first.error.message?.toLowerCase().includes("duplicate")
      if (!isDup) throw first.error

      const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase()
      const secondId = crypto.randomUUID()
      const second = await supabase
        .from("participants")
        .insert({ ...insertBase, id: secondId, code: `${baseCode}-${suffix}` })
      if (second.error) throw second.error

      router.replace(`/spin/${secondId}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur lors de la création d'un nouveau participant"
      setSpinError(msg)
      setCreatingReplay(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 text-blue-700 animate-spin" />
          <p className="text-blue-900 font-medium">Chargement...</p>
        </div>
      </main>
    )
  }

  if (!participant) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-white flex items-center justify-center p-6">
        <section className="w-full max-w-md">
          <div className="rounded-2xl border border-slate-200 shadow-xl bg-white p-8 text-center">
            <p className="text-2xl md:text-3xl font-extrabold text-slate-900">Une erreur s’est produite</p>
            <p className="text-md md:text-lg font-medium text-slate-600 mt-2">Impossible de charger les données du tirage.</p>
            <button
              onClick={() => router.push("/")}
              className="mt-6 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg px-5 py-3"
            >
              Réessayer
            </button>
          </div>
        </section>
      </main>
    )
  }

  const bgUrl = campaign?.theme?.backgroundUrl || process.env.NEXT_PUBLIC_SPIN_BACKGROUND_URL || "/flag-back.jpg"
  
  const wheelPrizes = prizes.map((p) => ({
    id: p.id,
    name: p.name,
    imageUrl: p.image_url,
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
              <div className="flex flex-col items-center">
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
                    secondary: campaign?.theme?.secondaryColor,
                  }}
                  campaignTheme={{
                    backgroundUrl: campaign?.theme?.backgroundUrl,
                  }}
                />

                {hasSpun && (
                  <Button
                    className="mt-4 w-full max-w-xs shadow-lg border border-white/20 bg-white/90 text-slate-900 hover:bg-white"
                    style={campaign?.theme?.primaryColor ? { backgroundColor: campaign.theme.primaryColor, color: "white" } : undefined}
                    onClick={handleReplay}
                    disabled={creatingReplay}
                  >
                    {creatingReplay ? <Loader2 className="h-4 w-4 animate-spin" /> : "Nouveau tour"}
                  </Button>
                )}
              </div>
            </div>
            <div className="hidden md:flex justify-center items-center w-full">
            </div>
        </section>
      </div>
    </main>
  )
}
