"use client"

import type React from "react"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Gift as GiftIcon, Users, Trophy, CalendarDays } from "lucide-react"
import { resetPrizes } from "@/app/actions/reset-prizes"
import { updateGift } from "@/app/actions/update-gift"

interface Gift {
  id: string
  name: string
  emoji: string
  image_url?: string
  max_winners: number
  current_winners: number
  color?: string
}

interface Participant {
  id: string
  name: string
  code: string
  won: boolean
  prize_id: string | null
  created_at: string
}

interface AdminDashboardProps {
  userId: string
}

export function AdminDashboard({ userId }: AdminDashboardProps) {
  const [gifts, setGifts] = useState<Gift[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [prizeMap, setPrizeMap] = useState<{ [key: string]: Gift }>({})
  const [loading, setLoading] = useState(true)
  const [giftQuery, setGiftQuery] = useState("")
  const [participantQuery, setParticipantQuery] = useState("")
  const [sortDesc, setSortDesc] = useState(true)
  const [winnersOnly, setWinnersOnly] = useState(false)
  const [showAddGift, setShowAddGift] = useState(false)
  const [newGiftName, setNewGiftName] = useState("")
  const [newGiftEmoji, setNewGiftEmoji] = useState("")
  const [newGiftMax, setNewGiftMax] = useState("1")
  const [newGiftColor, setNewGiftColor] = useState("#D4A017")
  const [newGiftImageUploading, setNewGiftImageUploading] = useState(false)
  const newGiftFileRef = useRef<HTMLInputElement | null>(null)
  const router = useRouter()
  const [resetting, setResetting] = useState(false)
  const [resetMessage, setResetMessage] = useState<string | null>(null)
  const [editingGiftIds, setEditingGiftIds] = useState<{ [id: string]: boolean }>({})

  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createClient()

        // Get gifts
        const { data: giftsData, error: giftsError } = await supabase.from("gifts").select("*").order("name")

        if (giftsError) throw giftsError

        setGifts(giftsData || [])
        const prizeMapTemp: { [key: string]: Gift } = {}
        giftsData?.forEach((gift) => {
          prizeMapTemp[gift.id] = gift
        })
        setPrizeMap(prizeMapTemp)

        // Get participants
        const { data: participantsData, error: participantsError } = await supabase
          .from("participants")
          .select("*")
          .order("created_at", { ascending: false })

        if (participantsError) throw participantsError
        setParticipants(participantsData || [])

        setLoading(false)
      } catch (error) {
        console.error("Error loading data:", error)
        setLoading(false)
      }
    }

    loadData()
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("participants-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "participants" },
        (payload) => {
          const row = payload.new as unknown as Participant
          setParticipants((prev) => [row, ...prev])
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "participants" },
        (payload) => {
          const row = payload.new as unknown as Participant
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
  }, [])

  const handleAddGift = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGiftName.trim()) return

    try {
      const supabase = createClient()

      let { data, error } = await supabase
        .from("gifts")
        .insert({
          name: newGiftName.trim(),
          image_url: newGiftEmoji,
          max_winners: Number.parseInt(newGiftMax),
          color: newGiftColor,
          created_by: userId,
        })
        .select()
        .single()

      if (error) {
        // Fallback for instances without image_url column yet
        const retry = await supabase
          .from("gifts")
          .insert({
            name: newGiftName.trim(),
            emoji: newGiftEmoji,
            max_winners: Number.parseInt(newGiftMax),
            color: newGiftColor,
            created_by: userId,
          })
          .select()
          .single()
        if (retry.error) throw retry.error
        data = retry.data
      }

      setGifts([...gifts, data])
      setPrizeMap({ ...prizeMap, [data.id]: data })
      setNewGiftName("")
      setNewGiftEmoji("🎁")
      setNewGiftMax("1")
      setNewGiftColor("#D4A017")
      setShowAddGift(false)
    } catch (error) {
      console.error("Error adding gift:", error)
    }
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/admin/login")
  }

  const winnerCount = participants.filter((p) => p.won).length
  const totalParticipants = participants.length
  const PRIZE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_PRIZE_BUCKET || "prizes"

  const uploadPrizeImage = async (file: File): Promise<string | null> => {
    const fd = new FormData()
    fd.append("file", file)
    fd.append("bucket", PRIZE_BUCKET)
    const res = await fetch("/api/upload-prize", { method: "POST", body: fd })
    const json = await res.json().catch(() => ({ success: false, error: "Invalid response" }))
    if (!json.success) {
      console.error("Upload failed:", json.error)
      return null
    }
    return json.url as string
  }
  const filteredGifts = gifts.filter(
    (g) =>
      g.name.toLowerCase().includes(giftQuery.toLowerCase()) ||
      g.emoji.toLowerCase().includes(giftQuery.toLowerCase()),
  )
  const filteredParticipants = participants
    .filter(
      (p) =>
        (p.name.toLowerCase().includes(participantQuery.toLowerCase()) ||
          p.code.toLowerCase().includes(participantQuery.toLowerCase())) &&
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

  const handleResetPrizes = async () => {
    setResetting(true)
    setResetMessage(null)
    const res = await resetPrizes()
    if (!res.success) {
      setResetMessage(res.error || "Échec de la réinitialisation")
    } else {
      setResetMessage("Cadeaux réinitialisés")
      setGifts((prev) => prev.map((g) => ({ ...g, current_winners: 0 })))
    }
    setResetting(false)
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-white to-blue-50 p-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 rounded-2xl p-4 md:p-6 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 shadow-sm">
          <div className="flex items-center gap-3">
            <img src="/casa_logo.png" alt="Logo" className="w-10 h-10 rounded-lg shadow-sm" />
            <div className="space-y-0.5">
              <h1 className="text-3xl md:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-amber-600 to-yellow-600">
                Tableau de bord administrateur
              </h1>
              <p className="text-sm md:text-base text-amber-700">Gérer les cadeaux et les participants</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* <Button onClick={handleResetPrizes} variant="destructive" disabled={resetting} className="w-full bg-red-600 hover:bg-red-700 text-white">
              {resetting ? "Réinitialisation..." : "Réinitialiser les cadeaux"}
            </Button> */}
            <Button onClick={handleSignOut} variant="outline" className="w-full bg-gray-900 hover:bg-gray-800 text-white">
              Se déconnecter
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Participants au total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-blue-100 text-blue-700 p-2">
                  <Users className="size-5" />
                </div>
                <p className="text-3xl font-bold text-blue-600">{totalParticipants}</p>
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
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Cadeaux actifs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-amber-100 text-amber-700 p-2">
                  <GiftIcon className="size-5" />
                </div>
                <p className="text-3xl font-bold text-yellow-600">{gifts.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="gifts" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 gap-2 bg-transparent">
            <TabsTrigger
              value="gifts"
              className="rounded-full px-4 py-2 text-base font-semibold text-gray-900 data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:border data-[state=active]:border-amber-700"
            >
              Gérer les cadeaux
            </TabsTrigger>
            <TabsTrigger
              value="participants"
              className="rounded-full px-4 py-2 text-base font-semibold text-gray-900 data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:border data-[state=active]:border-amber-700"
            >
              Participants
            </TabsTrigger>
          </TabsList>

          {/* Manage Prizes Tab */}
          <TabsContent value="gifts" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Input
                placeholder="Rechercher des cadeaux..."
                value={giftQuery}
                onChange={(e) => setGiftQuery(e.target.value)}
                className="w-full sm:max-w-xs"
              />
              <Button onClick={() => setShowAddGift(!showAddGift)} className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white text-base font-semibold h-11 px-5">
                {showAddGift ? "Annuler" : "+ Ajouter un cadeau"}
              </Button>
              <Button
                onClick={handleResetPrizes}
                disabled={resetting}
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white text-base font-semibold h-11 px-5"
              >
                {resetting ? "Réinitialisation..." : "Réinitialiser les cadeaux"}
              </Button>
            </div>
            {resetMessage && (
              <div className="text-sm px-3 py-2 rounded border bg-amber-50 border-amber-200 text-amber-700">
                {resetMessage}
              </div>
            )}

            {showAddGift && (
              <Card className="border-2 border-blue-200">
                <CardHeader>
                  <CardTitle>Ajouter un cadeau</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddGift} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nom du cadeau</Label>
                      <Input
                        id="name"
                        value={newGiftName}
                        onChange={(e) => setNewGiftName(e.target.value)}
                        placeholder="ex. Sac en cuir"
                        required
                        className="w-full"
                      />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="max">Nombre max de gagnants</Label>
                        <Input
                          id="max"
                          type="number"
                          min="1"
                          value={newGiftMax}
                          onChange={(e) => setNewGiftMax(e.target.value)}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="color">Couleur du segment</Label>
                        <Input
                          id="color"
                          type="color"
                          value={newGiftColor}
                          onChange={(e) => setNewGiftColor(e.target.value)}
                          className="w-full"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Image du cadeau</Label>
                      <div
                        className="relative w-16 h-16 rounded-md border bg-white flex items-center justify-center overflow-hidden cursor-pointer"
                        onClick={() => newGiftFileRef.current?.click()}
                      >
                        {newGiftEmoji && (newGiftEmoji.startsWith("/") || newGiftEmoji.startsWith("http")) ? (
                          <img src={newGiftEmoji} alt="Prévisualisation" className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-xs text-gray-400">Aucune image</span>
                        )}
                      </div>
                      <input
                        ref={newGiftFileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          setNewGiftImageUploading(true)
                          const url = await uploadPrizeImage(file)
                          setNewGiftImageUploading(false)
                          if (url) setNewGiftEmoji(url)
                        }}
                      />
                      {newGiftImageUploading && <p className="text-xs text-gray-500">Téléversment...</p>}
                    </div>
                    <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={newGiftImageUploading}>
                      Ajouter le cadeau
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredGifts.map((gift) => (
                <Card key={gift.id} className="border-2 border-blue-200/60 shadow-md rounded-2xl bg-gradient-to-b from-white to-blue-50/40">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-3 text-2xl">
                      {/* {(gift.image_url?.startsWith("/") || gift.image_url?.startsWith("http") || gift.emoji?.startsWith("/") || gift.emoji?.startsWith("http")) ? (
                        <img src={gift.image_url || gift.emoji} alt={gift.name} className="w-10 h-10 object-contain rounded shadow-sm" />
                      ) : (
                        <span className="text-3xl">{gift.emoji}</span>
                      )} */}
                      <span>{gift.name}</span>
                    </CardTitle>
                    <CardAction className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setEditingGiftIds((prev) => ({ ...prev, [gift.id]: !prev[gift.id] }))
                          }
                        >
                          {editingGiftIds[gift.id] ? "Fermer l’éditeur" : "Modifier ce cadeau"}
                        </Button>
                      </div>
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">
                        Gagnants : <span className="font-bold text-green-600">{gift.current_winners}</span> /{" "}
                        <span className="text-gray-500">{gift.max_winners}</span>
                      </p>
                      <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className="h-2 rounded-full transition-all bg-green-600"
                          style={{ width: `${(gift.current_winners / gift.max_winners) * 100}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-3 mt-3">
                        <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: gift.color || "#D4A017" }} />
                        <span className="text-xs text-gray-500">Couleur du segment</span>
                      </div>
                      {editingGiftIds[gift.id] && (
                        <div className="mt-4 rounded-xl border bg-white/70 p-3">
                          <GiftEditor
                            gift={gift}
                            onUpdated={(updated) => {
                              setGifts((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))
                              setPrizeMap((prev) => ({ ...prev, [updated.id]: updated }))
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Participants Tab */}
          <TabsContent value="participants">
            <Card>
              <CardHeader>
                <CardTitle>Tous les participants</CardTitle>
                <CardDescription>{participants.length} entrées au total</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                  <Input
                    placeholder="Rechercher un nom ou un code..."
                    value={participantQuery}
                    onChange={(e) => setParticipantQuery(e.target.value)}
                    className="w-full sm:max-w-xs"
                  />
                  <Button
                    variant="outline"
                    className="text-gray-700 w-full sm:w-auto"
                    onClick={() => setSortDesc((v) => !v)}
                  >
                    Trier par date {sortDesc ? "▼" : "▲"}
                  </Button>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={winnersOnly}
                      onChange={(e) => setWinnersOnly(e.target.checked)}
                      className="accent-green-600"
                    />
                    Uniquement les gagnants
                  </label>
                </div>
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
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          {p.won && p.prize_id && prizeMap[p.prize_id] ? (
                            <div className="flex items-center gap-2">
                              {(prizeMap[p.prize_id].image_url?.startsWith("/") || prizeMap[p.prize_id].image_url?.startsWith("http")) ? (
                                <img src={prizeMap[p.prize_id].image_url || ""} alt={prizeMap[p.prize_id].name} className="w-5 h-5 object-contain rounded" />
                              ) : (
                                <span className="text-lg">{prizeMap[p.prize_id].emoji}</span>
                              )}
                              <span>{prizeMap[p.prize_id].name}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="size-3.5 text-gray-400" />
                            {new Date(p.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="overflow-x-auto rounded-lg border border-gray-200 hidden sm:block">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Nom</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 hidden sm:table-cell">Code</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Statut</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Cadeau</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 hidden sm:table-cell">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredParticipants.map((participant, idx) => (
                        <tr
                          key={participant.id}
                          className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100`}
                        >
                          <td className="py-3 px-4">{participant.name}</td>
                          <td className="py-3 px-4 font-mono text-gray-600 hidden sm:table-cell">{participant.code}</td>
                          <td className="py-3 px-4">
                            {participant.won ? (
                              <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">
                                <Trophy className="size-3.5" /> Gagné
                              </span>
                            ) : (
                              <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-semibold">
                                En attente
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {participant.won && participant.prize_id && prizeMap[participant.prize_id] ? (
                              <div className="flex items-center gap-2">
                                {(prizeMap[participant.prize_id].image_url?.startsWith("/") || prizeMap[participant.prize_id].image_url?.startsWith("http")) && (
                                  <img src={prizeMap[participant.prize_id].image_url || ""} alt={prizeMap[participant.prize_id].name} className="w-6 h-6 object-contain rounded" />
                                )}
                                <span>{prizeMap[participant.prize_id].name}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-500 text-xs hidden sm:table-cell">
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="size-3.5 text-gray-400" />
                              {new Date(participant.created_at).toLocaleString()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}

function GiftEditor({
  gift,
  onUpdated,
}: {
  gift: Gift
  onUpdated: (updated: Gift) => void
}) {
  const [name, setName] = useState(gift.name)
  const [emoji, setEmoji] = useState(gift.image_url || gift.emoji || "")
  const [max, setMax] = useState(gift.max_winners.toString())
  const [color, setColor] = useState(gift.color || "#D4A017")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const payload: { name: string; image_url?: string; emoji?: string; max_winners: number; color?: string } = {
        name: name.trim(),
        max_winners: Number.parseInt(max),
        color,
      }
      if (emoji && (emoji.startsWith("/") || emoji.startsWith("http"))) {
        payload.image_url = emoji
      }
      const result = await updateGift(gift.id, payload)
      if (!result.success) {
        const fallback = await updateGift(gift.id, { name: name.trim(), emoji, max_winners: Number.parseInt(max) })
        if (!fallback.success) throw new Error(fallback.error || "Update failed")
        onUpdated(fallback.data as Gift)
      } else {
        onUpdated(result.data as Gift)
      }
      setSuccess(true)
    } catch (err) {
      console.error("Error updating gift:", err)
      setError(err instanceof Error ? err.message : "Update failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 mt-4">
      <div className="space-y-1">
        <Label>Nom</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="w-full" />
      </div>
      <div className="space-y-1">
        <Label>Max</Label>
        <Input type="number" min="1" value={max} onChange={(e) => setMax(e.target.value)} className="w-full" />
      </div>
      <div className="space-y-1">
        <Label>Couleur</Label>
        <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-full" />
      </div>
      <div className="space-y-1">
        <Label>Image du cadeau</Label>
        <div
          className="relative w-16 h-16 rounded-md border bg-white flex items-center justify-center overflow-hidden cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          {emoji && (emoji.startsWith("/") || emoji.startsWith("http")) ? (
            <img src={emoji} alt="Prévisualisation" className="w-full h-full object-contain" />
          ) : (
            <span className="text-xs text-gray-400">Aucune image</span>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            setUploading(true)
            try {
              const bucket = process.env.NEXT_PUBLIC_SUPABASE_PRIZE_BUCKET || "prizes"
              const fd = new FormData()
              fd.append("file", file)
              fd.append("bucket", bucket)
              const resp = await fetch("/api/upload-prize", { method: "POST", body: fd })
              const json = await resp.json().catch(() => ({ success: false }))
              if (json && json.success && json.url) {
                const url = json.url as string
                setEmoji(url)
                const res = await updateGift(gift.id, { image_url: url })
                if (res.success) {
                  onUpdated(res.data as Gift)
                  setSuccess(true)
                } else {
                  const fb = await updateGift(gift.id, { emoji: url })
                  if (fb.success) {
                    onUpdated(fb.data as Gift)
                    setSuccess(true)
                  } else {
                    setError(fb.error || res.error || "Update failed")
                  }
                }
              }
            } finally {
              setUploading(false)
            }
          }}
        />
        {uploading && <p className="text-xs text-gray-500">Téléversment...</p>}
      </div>
      <div>
        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white hover:bg-blue-700 w-full">
          {saving ? "Enregistrement..." : "Enregistrer"}
        </Button>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        {success && !error && <p className="text-sm text-green-600 mt-2">Enregistré</p>}
      </div>
    </div>
  )
}
