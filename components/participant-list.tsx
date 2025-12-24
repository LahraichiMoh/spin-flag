"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ArrowUpDown, CalendarDays, Trophy, Users } from "lucide-react"

interface Gift {
  id: string
  name: string
  image_url?: string
}

interface Participant {
  id: string
  name: string
  code: string
  city?: string
  won: boolean
  prize_id: string | null
  created_at: string
  campaign_id?: string
}

interface ParticipantListProps {
  campaignId?: string
  onlyWinners?: boolean
}

export function ParticipantList({ campaignId, onlyWinners }: ParticipantListProps) {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [prizeMap, setPrizeMap] = useState<{ [key: string]: Gift }>({})
  const [loading, setLoading] = useState(true)
  const [participantQuery, setParticipantQuery] = useState("")
  const [sortDesc, setSortDesc] = useState(true)
  const [winnersOnly, setWinnersOnly] = useState(!!onlyWinners)

  useEffect(() => {
    setWinnersOnly(!!onlyWinners)
  }, [onlyWinners])

  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createClient()

        // Get gifts (needed for prize names)
        let giftsQuery = supabase.from("gifts").select("id, name, image_url")
        if (campaignId) {
            giftsQuery = giftsQuery.eq("campaign_id", campaignId)
        }
        const { data: giftsData, error: giftsError } = await giftsQuery
        if (giftsError) throw giftsError

        const prizeMapTemp: { [key: string]: Gift } = {}
        giftsData?.forEach((gift) => {
          prizeMapTemp[gift.id] = gift
        })
        setPrizeMap(prizeMapTemp)

        // Get participants
        let query = supabase
          .from("participants")
          .select("*")
          .order("created_at", { ascending: false })

        if (campaignId) {
            query = query.eq("campaign_id", campaignId)
        }

        const { data: participantsData, error: participantsError } = await query

        if (participantsError) throw participantsError
        setParticipants(participantsData || [])

        setLoading(false)
      } catch (error) {
        console.error("Error loading data:", error)
        setLoading(false)
      }
    }

    loadData()
  }, [campaignId])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("participants-realtime-list")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "participants" },
        (payload) => {
          const row = payload.new as unknown as Participant
          // If filtering by campaign, ignore updates from other campaigns
          if (campaignId && row.campaign_id !== campaignId) return
          
          setParticipants((prev) => [row, ...prev])
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "participants" },
        (payload) => {
          const row = payload.new as unknown as Participant
           // If filtering by campaign, ignore updates from other campaigns
           if (campaignId && row.campaign_id !== campaignId) return

          setParticipants((prev) => prev.map((p) => (p.id === row.id ? row : p)))
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "participants" },
        (payload) => {
          const oldId = (payload.old as { id: string }).id
          setParticipants((prev) => prev.filter((p) => p.id !== oldId))
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [campaignId])

  const filteredParticipants = participants
    .filter(
      (p) =>
        (p.name.toLowerCase().includes(participantQuery.toLowerCase()) ||
          p.code.toLowerCase().includes(participantQuery.toLowerCase()) ||
          (p.city || "").toLowerCase().includes(participantQuery.toLowerCase())) &&
        (!winnersOnly || p.won),
    )
    .sort((a, b) =>
      sortDesc
        ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        : new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )

  if (loading) {
    return <div className="text-center py-8">Chargement...</div>
  }

  const winnerCount = participants.filter((p) => p.won).length
  
  return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-gray-600">Total Participants</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-3">
                        <div className="rounded-full bg-blue-100 text-blue-700 p-2">
                            <Users className="size-5" />
                        </div>
                        <p className="text-3xl font-bold text-blue-600">{participants.length}</p>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-gray-600">Gagnants</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-3">
                        <div className="rounded-full bg-green-100 text-green-700 p-2">
                            <Trophy className="size-5" />
                        </div>
                        <p className="text-3xl font-bold text-green-600">{winnerCount}</p>
                    </div>
                </CardContent>
            </Card>
        </div>

        <Card>
            <CardHeader>
            <CardTitle>Liste des participants</CardTitle>
            <CardDescription>{participants.length} entrées au total</CardDescription>
            </CardHeader>
            <CardContent>
            <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  placeholder="Rechercher un nom ou un emplacement..."
                  value={participantQuery}
                  onChange={(e) => setParticipantQuery(e.target.value)}
                  className="w-full sm:w-[320px]"
                />
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => setSortDesc((v) => !v)}>
                  <ArrowUpDown className="h-4 w-4" />
                  Date {sortDesc ? "desc" : "asc"}
                </Button>
                {!onlyWinners && (
                  <Button
                    type="button"
                    variant={winnersOnly ? "default" : "outline"}
                    className="w-full sm:w-auto"
                    onClick={() => setWinnersOnly((v) => !v)}
                  >
                    <Trophy className="h-4 w-4" />
                    Uniquement les gagnants
                  </Button>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {filteredParticipants.length} résultat{filteredParticipants.length > 1 ? "s" : ""}
              </div>
            </div>
            
            {/* Mobile View */}
            <div className="sm:hidden space-y-3">
                {filteredParticipants.map((p) => (
                <div key={p.id} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                    <div className="font-semibold">{p.name}</div>
                    {p.won ? (
                        <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">
                        <Trophy className="size-3.5" /> Gagné
                        </span>
                    ) : (
                        <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-semibold">
                        En attente
                        </span>
                    )}
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                        <span className="font-mono">{p.code}</span>
                        {p.city && (
                            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">{p.city}</span>
                        )}
                    </div>
                    {p.won && p.prize_id && prizeMap[p.prize_id] && (
                        <div className="mt-2 flex items-center gap-2 text-amber-700 font-medium">
                            {(prizeMap[p.prize_id].image_url?.startsWith("/") || prizeMap[p.prize_id].image_url?.startsWith("http")) && (
                                <img src={prizeMap[p.prize_id].image_url || ""} alt={prizeMap[p.prize_id].name} className="w-5 h-5 object-contain rounded" />
                            )}
                            <span>{prizeMap[p.prize_id].name}</span>
                        </div>
                    )}
                     <div className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                        <CalendarDays className="size-3" />
                        {new Date(p.created_at).toLocaleString()}
                    </div>
                    </div>
                </div>
                ))}
            </div>

            {/* Desktop View */}
            <div className="hidden sm:block overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="max-h-[65vh] overflow-auto">
                <table className="min-w-[1020px] w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur border-b border-gray-200">
                    <tr className="text-xs font-semibold text-slate-600">
                      <th className="px-4 py-3 text-left">Nom</th>
                      <th className="px-4 py-3 text-left">Emplacement</th>
                      <th className="px-4 py-3 text-left">Ville</th>
                      <th className="px-4 py-3 text-left">Résultat</th>
                      <th className="px-4 py-3 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredParticipants.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                          Aucun participant trouvé
                        </td>
                      </tr>
                    ) : (
                      filteredParticipants.map((row) => {
                        const prize = row.prize_id ? prizeMap[row.prize_id] : null
                        return (
                          <tr key={row.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{row.name}</td>
                            <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{row.code}</td>
                            <td className="px-4 py-3">
                              {row.city ? (
                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                                  {row.city}
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {row.won && prize ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                                  <Trophy className="h-3.5 w-3.5" />
                                  {prize.name}
                                </span>
                              ) : row.won ? (
                                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                                  Gagné (Inconnu)
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                                  Perdu
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-slate-500 whitespace-nowrap">
                              {new Date(row.created_at).toLocaleDateString("fr-FR", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            </CardContent>
        </Card>
    </div>
  )
}
