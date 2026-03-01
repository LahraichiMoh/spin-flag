"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ArrowUpDown, CalendarDays, Download, Loader2, Trophy, Users } from "lucide-react"

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
  participant_details?: {
    full_name: string
    gender: string
    age_range: string
    address: string
    usual_product: string
  }[]
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
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [sortDesc, setSortDesc] = useState(true)
  const [winnersOnly, setWinnersOnly] = useState(!!onlyWinners)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [totalParticipants, setTotalParticipants] = useState(0)
  const [totalWinners, setTotalWinners] = useState(0)
  const [matchingTotal, setMatchingTotal] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [exportingAll, setExportingAll] = useState(false)
  const [exportingWinners, setExportingWinners] = useState(false)

  useEffect(() => {
    setWinnersOnly(!!onlyWinners)
  }, [onlyWinners])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(participantQuery.trim()), 250)
    return () => clearTimeout(t)
  }, [participantQuery])

  useEffect(() => {
    setPageIndex(0)
  }, [debouncedQuery, winnersOnly, campaignId])

  useEffect(() => {
    const loadGifts = async () => {
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
      } catch (error) {
        console.error("Error loading data:", error)
      }
    }

    loadGifts()
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
          
          setReloadKey((v) => v + 1)
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "participants" },
        (payload) => {
          const row = payload.new as unknown as Participant
           // If filtering by campaign, ignore updates from other campaigns
           if (campaignId && row.campaign_id !== campaignId) return

          setReloadKey((v) => v + 1)
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "participants" },
        (payload) => {
          const oldId = (payload.old as { id: string }).id
          if (campaignId) {
            setReloadKey((v) => v + 1)
          } else if (oldId) {
            setReloadKey((v) => v + 1)
          }
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [campaignId])

  const pageCount = Math.max(1, Math.ceil(matchingTotal / pageSize))
  const fromIndex = pageIndex * pageSize
  const toIndex = Math.min(fromIndex + participants.length, matchingTotal)

  const resultsLabel = useMemo(() => {
    if (matchingTotal === 0) return "0 résultat"
    if (matchingTotal === 1) return "1 résultat"
    return `${matchingTotal} résultats`
  }, [matchingTotal])

  const exportCsv = async (options: { winnersOnly: boolean }) => {
    const setExporting = options.winnersOnly ? setExportingWinners : setExportingAll
    setExporting(true)
    try {
      const supabase = createClient()

      let countQuery = supabase
        .from("participants")
        .select("*", { count: "exact", head: true })
      if (campaignId) countQuery = countQuery.eq("campaign_id", campaignId)
      if (options.winnersOnly) countQuery = countQuery.eq("won", true)
      const { count, error: countError } = await countQuery
      if (countError) throw countError
      const total = count || 0

      const chunkSize = 1000
      const allRows: any[] = []
      for (let offset = 0; offset < total; offset += chunkSize) {
        let query = supabase
          .from("participants")
          .select("name, code, city, prize_id, created_at, participant_details(full_name, gender, age_range, address, usual_product)")
          .order("created_at", { ascending: false })
          .range(offset, offset + chunkSize - 1)

        if (campaignId) query = query.eq("campaign_id", campaignId)
        if (options.winnersOnly) query = query.eq("won", true)

        const { data, error } = await query
        if (error) throw error
        allRows.push(...(data || []))
        if (!data || data.length < chunkSize) break
      }

      const columns = [
        "name",
        "code",
        "city",
        "full_name",
        "gender",
        "age_range",
        "address",
        "usual_product",
        "prize_name",
        "created_at",
      ]

      const escapeCsv = (value: unknown) => {
        if (value === null || value === undefined) return ""
        const s = String(value)
        const needsQuotes = /[",\n\r]/.test(s)
        const escaped = s.replaceAll('"', '""')
        return needsQuotes ? `"${escaped}"` : escaped
      }

      const lines: string[] = []
      lines.push(columns.join(","))
      for (const r of allRows) {
        const prizeId = (r as any).prize_id as string | null | undefined
        const prizeName = prizeId && prizeMap[prizeId] ? prizeMap[prizeId].name : ""
        const details = (r as any).participant_details?.[0] || {}
        const rowObj = { 
          ...(r as any), 
          prize_name: prizeName,
          full_name: details.full_name || "",
          gender: details.gender || "",
          age_range: details.age_range || "",
          address: details.address || "",
          usual_product: details.usual_product || "",
        }
        lines.push(columns.map((c) => escapeCsv((rowObj as any)[c])).join(","))
      }

      const csv = lines.join("\n")
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const date = new Date().toISOString().slice(0, 10)
      const scope = campaignId ? `campaign-${campaignId}` : "all-campaigns"
      const subset = options.winnersOnly ? "winners" : "participants"
      a.download = `${scope}-${subset}-${date}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error("Export CSV failed:", e)
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    const loadCountsAndPage = async () => {
      setLoading(true)
      try {
        const supabase = createClient()

        let totalQuery = supabase
          .from("participants")
          .select("*", { count: "exact", head: true })
        if (campaignId) totalQuery = totalQuery.eq("campaign_id", campaignId)
        const { count: totalCount, error: totalError } = await totalQuery
        if (totalError) throw totalError
        setTotalParticipants(totalCount || 0)

        let winnersQuery = supabase
          .from("participants")
          .select("*", { count: "exact", head: true })
          .eq("won", true)
        if (campaignId) winnersQuery = winnersQuery.eq("campaign_id", campaignId)
        const { count: winnersCount, error: winnersError } = await winnersQuery
        if (winnersError) throw winnersError
        setTotalWinners(winnersCount || 0)

        let query = supabase
          .from("participants")
          .select("*, participant_details(full_name, gender, age_range, address, usual_product)", { count: "exact" })
          .order("created_at", { ascending: !sortDesc })

        if (campaignId) query = query.eq("campaign_id", campaignId)
        if (winnersOnly) query = query.eq("won", true)
        if (debouncedQuery) {
          const q = debouncedQuery.replaceAll(",", " ")
          query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%,city.ilike.%${q}%`)
        }

        const from = pageIndex * pageSize
        const to = from + pageSize - 1
        query = query.range(from, to)

        const { data, count, error } = await query
        if (error) throw error

        setParticipants((data || []) as Participant[])
        setMatchingTotal(count || 0)
      } catch (error) {
        console.error("Error loading data:", error)
        setParticipants([])
        setMatchingTotal(0)
      } finally {
        setLoading(false)
      }
    }

    loadCountsAndPage()
  }, [campaignId, debouncedQuery, pageIndex, pageSize, reloadKey, sortDesc, winnersOnly])

  const displayedParticipants = participants

  if (loading) {
    return <div className="text-center py-8">Chargement...</div>
  }
  
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
                        <p className="text-3xl font-bold text-blue-600">{totalParticipants}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-4 w-full"
                      disabled={exportingAll || totalParticipants === 0}
                      onClick={() => exportCsv({ winnersOnly: false })}
                    >
                      {exportingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                      Télécharger CSV (tout)
                    </Button>
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
                        <p className="text-3xl font-bold text-green-600">{totalWinners}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-4 w-full"
                      disabled={exportingWinners || totalWinners === 0}
                      onClick={() => exportCsv({ winnersOnly: true })}
                    >
                      {exportingWinners ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                      Télécharger CSV (gagnants)
                    </Button>
                </CardContent>
            </Card>
        </div>

        <Card>
            <CardHeader>
            <CardTitle>Liste des participants</CardTitle>
            <CardDescription>{totalParticipants} entrées au total</CardDescription>
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
              <div className="text-xs text-muted-foreground">{resultsLabel}</div>
            </div>
            
            {/* Mobile View */}
            <div className="sm:hidden space-y-3">
                {displayedParticipants.map((p) => {
                const details = p.participant_details?.[0]
                return (
                <div key={p.id} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-semibold">{details?.full_name || p.name}</span>
                      {details && (
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                          {details.gender} • {details.age_range}
                        </span>
                      )}
                    </div>
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
                    <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-xs">{p.code}</span>
                        {p.city && (
                            <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 uppercase">{p.city}</span>
                        )}
                    </div>
                    {details && (
                      <div className="mb-2 p-2 bg-slate-50 rounded border border-slate-100">
                        <div className="text-[11px] font-medium text-slate-700 truncate">{details.usual_product}</div>
                        <div className="text-[10px] text-slate-400 truncate italic">{details.address}</div>
                      </div>
                    )}
                    {p.won && p.prize_id && prizeMap[p.prize_id] && (
                        <div className="mt-2 flex items-center gap-2 text-amber-700 font-medium">
                            {(prizeMap[p.prize_id].image_url?.startsWith("/") || prizeMap[p.prize_id].image_url?.startsWith("http")) && (
                                <img src={prizeMap[p.prize_id].image_url || ""} alt={prizeMap[p.prize_id].name} className="w-5 h-5 object-contain rounded" />
                            )}
                            <span>{prizeMap[p.prize_id].name}</span>
                        </div>
                    )}
                     <div className="mt-2 text-[10px] text-gray-400 flex items-center gap-1">
                        <CalendarDays className="size-3" />
                        {new Date(p.created_at).toLocaleString("fr-FR")}
                    </div>
                    </div>
                </div>
                )})}
            </div>

            {/* Desktop View */}
            <div className="hidden sm:block overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="max-h-[65vh] overflow-auto">
                <table className="min-w-[1020px] w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur border-b border-gray-200">
                    <tr className="text-xs font-semibold text-slate-600">
                      <th className="px-4 py-3 text-left">Nom (Animateur)</th>
                      <th className="px-4 py-3 text-left">Participant</th>
                      <th className="px-4 py-3 text-left">Poste</th>
                      <th className="px-4 py-3 text-left">Ville</th>
                      <th className="px-4 py-3 text-left">Détails</th>
                      <th className="px-4 py-3 text-left">Résultat</th>
                      <th className="px-4 py-3 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {displayedParticipants.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                          Aucun participant trouvé
                        </td>
                      </tr>
                    ) : (
                      displayedParticipants.map((row) => {
                        const prize = row.prize_id ? prizeMap[row.prize_id] : null
                        const details = row.participant_details?.[0]
                        return (
                          <tr key={row.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{row.name}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {details ? (
                                <div className="flex flex-col">
                                  <span className="font-semibold text-slate-900">{details.full_name}</span>
                                  <span className="text-xs text-slate-500">{details.gender}, {details.age_range}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400">Pas de détails</span>
                              )}
                            </td>
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
                              {details ? (
                                <div className="flex flex-col max-w-[200px]">
                                  <span className="text-xs font-medium truncate" title={details.usual_product}>{details.usual_product}</span>
                                  <span className="text-[10px] text-slate-400 truncate" title={details.address}>{details.address}</span>
                                </div>
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

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-muted-foreground">
                {matchingTotal === 0 ? (
                  "Affichage 0 sur 0"
                ) : (
                  <>Affichage {fromIndex + 1}–{toIndex} sur {matchingTotal}</>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm w-full sm:w-auto"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setPageIndex(0)
                  }}
                >
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                  <option value={200}>200 / page</option>
                </select>
                <div className="text-sm text-slate-600 text-center sm:text-left">
                  Page {Math.min(pageCount, pageIndex + 1)} / {pageCount}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={pageIndex <= 0}
                    onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                  >
                    Précédent
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={pageIndex >= pageCount - 1}
                    onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            </div>
            </CardContent>
        </Card>
    </div>
  )
}
