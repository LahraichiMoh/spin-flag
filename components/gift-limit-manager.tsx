"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { getCities, type City } from "@/app/actions/manage-cities"
import { getGiftCityLimits, upsertGiftCityLimit, type GiftCityLimit } from "@/app/actions/gift-limits"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"

interface GiftLimitManagerProps {
  giftId: string
  giftName: string
  onClose?: () => void
  onLimitUpdated?: () => void
}

export function GiftLimitManager({ giftId, giftName, onClose, onLimitUpdated }: GiftLimitManagerProps) {
  const [cities, setCities] = useState<City[]>([])
  const [limits, setLimits] = useState<Record<string, number | "">>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [bulkSaving, setBulkSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [giftId])

  const loadData = async () => {
    setLoading(true)
    const [citiesRes, limitsRes] = await Promise.all([
      getCities(),
      getGiftCityLimits(giftId)
    ])

    if (citiesRes.success && citiesRes.data) {
      setCities(citiesRes.data)
    }

    if (limitsRes.success && limitsRes.data) {
      const newLimits: Record<string, number> = {}
      limitsRes.data.forEach((l) => {
        newLimits[l.city_id] = l.max_winners
      })
      setLimits(newLimits)
    }
    setLoading(false)
  }

  const handleSave = async (cityId: string, limit: number | "") => {
    if (limit === "") return
    setSaving(cityId)
    const res = await upsertGiftCityLimit(giftId, cityId, limit as number)
    setSaving(null)
    
    if (!res.success) {
      toast.error("Erreur lors de l'enregistrement")
      return
    }

    setLimits(prev => ({ ...prev, [cityId]: limit }))
    if (onLimitUpdated) onLimitUpdated()
    toast.success("Limite enregistrée")
  }
  
  const handleSaveAll = async () => {
    setBulkSaving(true)
    let hasError = false
    
    for (const city of cities) {
      const val = limits[city.id]
      if (val !== undefined && val !== "") {
        const res = await upsertGiftCityLimit(giftId, city.id, val as number)
        if (!res.success) {
          hasError = true
          toast.error(`Erreur pour ${city.name}`)
        }
      }
    }
    setBulkSaving(false)
    if (onLimitUpdated) onLimitUpdated()
    
    if (!hasError) {
      toast.success("Toutes les limites ont été enregistrées")
    }
  }

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-amber-600" /></div>
  }

  return (
    <Card className="border-amber-200 shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg">Limites par ville : {giftName}</CardTitle>
        <CardDescription>
          Définissez le nombre maximum de gagnants pour ce cadeau dans chaque ville.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto">
        <div className="flex justify-end">
          <Button 
            variant="outline" 
            className="text-sm"
            onClick={handleSaveAll}
            disabled={bulkSaving}
          >
            {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Enregistrer toutes les limites
          </Button>
        </div>
        {cities.map((city) => (
          <div key={city.id} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
            <span className="font-medium text-slate-700">{city.name}</span>
            <div className="flex items-center gap-3">
              <Label className="text-xs text-slate-500 uppercase">Max</Label>
              <Input
                type="number"
                min="0"
                className="w-20 text-right"
                placeholder="∞"
                value={limits[city.id] ?? ""}
                onChange={(e) => {
                  const val = e.target.value === "" ? "" : parseInt(e.target.value)
                  setLimits(prev => ({ ...prev, [city.id]: val }))
                }}
              />
              <Button 
                size="sm" 
                variant="ghost"
                disabled={saving === city.id || limits[city.id] === undefined || limits[city.id] === ""}
                onClick={() => {
                   const val = limits[city.id]
                   if (val !== undefined) handleSave(city.id, val)
                }}
              >
                {saving === city.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        ))}
        {cities.length === 0 && (
          <p className="text-center text-slate-500 italic">Aucune ville trouvée.</p>
        )}
        {onClose && (
            <div className="pt-4 flex justify-end">
                <Button variant="outline" onClick={onClose}>Fermer</Button>
            </div>
        )}
      </CardContent>
    </Card>
  )
}
