"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { loginCampaignAccess } from "@/app/actions/campaigns"
import { Loader2 } from "lucide-react"

interface CityLoginFormProps {
  campaignName: string
  campaignSlug: string
  theme?: {
    primaryColor?: string
    secondaryColor?: string
    logoUrl?: string
  }
}

export function CampaignLoginForm({ campaignName, campaignSlug, theme }: CityLoginFormProps) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const result = await loginCampaignAccess(campaignSlug, username, password)

      if (result.success) {
        router.refresh()
      } else {
        setError(result.error || "Échec de la connexion")
      }
    } catch (err) {
      setError("Une erreur s'est produite")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto shadow-xl border-none bg-white/95 backdrop-blur">
      <CardHeader className="text-center pb-2">
        {theme?.logoUrl && (
          <div className="flex justify-center mb-4">
            <img 
              src={theme.logoUrl} 
              alt="Logo" 
              className="h-24 object-contain"
            />
          </div>
        )}
        <CardTitle className="text-2xl font-bold" style={{ color: theme?.primaryColor }}>
          Connexion Campagne
        </CardTitle>
        <CardDescription>
          Connectez-vous avec les accès de la campagne pour participer à {campaignName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Identifiant</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ex: campagne1"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          
          {error && (
            <div className="text-red-500 text-sm text-center font-medium bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full font-bold text-lg h-12"
            disabled={loading}
            style={{ 
              backgroundColor: theme?.primaryColor || "#7f1d1d",
              color: "white"
            }}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Connexion...
              </>
            ) : (
              "Accéder à la Roue"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
