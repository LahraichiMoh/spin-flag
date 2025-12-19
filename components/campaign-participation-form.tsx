"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { submitParticipation } from "@/app/actions/submit-participation"
import { logoutCity } from "@/app/actions/city-auth"
import { Checkbox } from "@/components/ui/checkbox"
import { getAvailablePrizes } from "@/app/actions/campaigns"

interface CampaignParticipationFormProps {
  campaignId: string
  campaignName: string
  cityId: string
  cityName: string
  theme: {
    primaryColor?: string
    secondaryColor?: string
    logoUrl?: string
    backgroundUrl?: string
  }
}

export function CampaignParticipationForm({ campaignId, campaignName, cityId, cityName, theme }: CampaignParticipationFormProps) {
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [checking, setChecking] = useState(true)
  const [cityExhausted, setCityExhausted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const res = await getAvailablePrizes(campaignId, cityId, cityName)
        
        if (res.success && res.data) {
          // Check if ANY gift is available
          const hasAvailable = res.data.some((g: any) => g.available)
          setCityExhausted(!hasAvailable)
        } else {
          // If error or no data, assume exhausted to be safe
          setCityExhausted(true)
        }
      } catch {
        setCityExhausted(true)
      } finally {
        setChecking(false)
      }
    }
    checkAvailability()
  }, [campaignId, cityId, cityName])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreed) {
        setError("Veuillez accepter les conditions")
        return
    }
    if (cityExhausted) {
        setError("La période de participation est terminée pour aujourd'hui.")
        return
    }
    
    setLoading(true)
    setError("")

    try {
      const res = await submitParticipation(name, code, cityName, agreed, campaignId)
      if (res.success && res.participantId) {
        router.push(`/spin/${res.participantId}`)
      } else {
        setError(res.error || "Erreur lors de l'inscription")
      }
    } catch (err) {
      setError("Une erreur s'est produite")
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await logoutCity()
    router.refresh()
  }

  return (
    <Card className="w-full max-w-md mx-auto bg-white/90 backdrop-blur-sm shadow-xl">
      <CardHeader className="text-center">
        {theme.logoUrl && (
            <div className="flex justify-center mb-4">
                <img src={theme.logoUrl} alt="Logo" className="h-20 object-contain" />
            </div>
        )}
        <CardTitle className="text-2xl" style={{ color: theme.primaryColor }}>{campaignName}</CardTitle>
        <CardDescription className="flex flex-col items-center gap-2">
          <span>Ville connectée : <span className="font-semibold text-black">{cityName}</span></span>
          <Button 
            variant="link" 
            size="sm" 
            className="text-xs text-muted-foreground h-auto p-0 hover:text-red-600"
            onClick={handleLogout}
          >
            (Changer de ville)
          </Button>
        </CardDescription>
        {checking ? (
          <p className="mt-2 text-sm text-gray-600">Vérification des récompenses disponibles…</p>
        ) : cityExhausted ? (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 font-bold">The guidance period has ended for today.</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-green-700">Des récompenses sont disponibles.</p>
        )}
      </CardHeader>
      <CardContent>
        {cityExhausted ? null : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom d&apos;animateur</Label>
            <Input 
              id="name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Nom complet"
              required 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">Code Animateur</Label>
            <Input 
              id="code" 
              value={code} 
              onChange={(e) => setCode(e.target.value)} 
              placeholder="ABC-123"
              required 
            />
          </div>
          
          <div className="flex items-center space-x-2 py-2">
            <Checkbox id="terms" checked={agreed} onCheckedChange={(c) => setAgreed(c === true)} />
            <label
              htmlFor="terms"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              J&apos;accepte les conditions de participation
            </label>
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <Button 
            type="submit" 
            className="w-full text-lg font-bold py-6"
            style={{ backgroundColor: theme.primaryColor || 'black', color: 'white' }}
            disabled={loading || checking || cityExhausted}
          >
            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Lancer le jeu"}
          </Button>
        </form>
        )}
      </CardContent>
    </Card>
  )
}

export default CampaignParticipationForm
