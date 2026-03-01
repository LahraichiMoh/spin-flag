"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

interface ParticipantFormProps {
  campaignName: string
  primaryColor?: string
  logoUrl?: string
  onSubmit: (data: ParticipantDetails) => void
}

export interface ParticipantDetails {
  fullName: string
  gender: string
  ageRange: string
  address: string
  usualProduct: string
}

export function ParticipantForm({ campaignName, primaryColor, logoUrl, onSubmit }: ParticipantFormProps) {
  const [formData, setFormData] = useState<ParticipantDetails>({
    fullName: "",
    gender: "",
    ageRange: "",
    address: "",
    usualProduct: "",
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    onSubmit(formData)
  }

  const handleChange = (field: keyof ParticipantDetails, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <Card className="w-full max-w-md mx-auto bg-white/95 backdrop-blur-md shadow-2xl border-0">
      <CardHeader className="text-center pb-2">
        {logoUrl && (
          <div className="flex justify-center mb-4">
            <img src={logoUrl} alt="Logo" className="h-16 object-contain" />
          </div>
        )}
        <CardTitle className="text-2xl font-bold" style={{ color: primaryColor }}>
          {campaignName}
        </CardTitle>
        <CardDescription className="text-slate-600 font-medium mt-1">
          Informations du participant
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fullName" className="text-slate-700 font-semibold">Nom & Prénom</Label>
            <Input
              id="fullName"
              placeholder="Ex: Ahmed Alaoui"
              value={formData.fullName}
              onChange={(e) => handleChange("fullName", e.target.value)}
              className="border-slate-200 focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gender" className="text-slate-700 font-semibold">Sexe</Label>
            <select
              id="gender"
              value={formData.gender}
              onChange={(e) => handleChange("gender", e.target.value)}
              className="flex h-10 w-full rounded-md border border-slate-200 bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-orange-500"
              required
            >
              <option value="">Choisir</option>
              <option value="Masculin">Masculin</option>
              <option value="Féminin">Féminin</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ageRange" className="text-slate-700 font-semibold">Tranche d&apos;âge</Label>
            <select
              id="ageRange"
              value={formData.ageRange}
              onChange={(e) => handleChange("ageRange", e.target.value)}
              className="flex h-10 w-full rounded-md border border-slate-200 bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-orange-500"
              required
            >
              <option value="">Choisir</option>
              <option value="18-25">18-25</option>
              <option value="26-35">26-35</option>
              <option value="36-45">36-45</option>
              <option value="46-55">46-55</option>
              <option value="55+">55+</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address" className="text-slate-700 font-semibold">Adresse</Label>
            <Input
              id="address"
              placeholder="Quartier, Ville..."
              value={formData.address}
              onChange={(e) => handleChange("address", e.target.value)}
              className="border-slate-200 focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="usualProduct" className="text-slate-700 font-semibold">Produit habituel</Label>
            <Input
              id="usualProduct"
              placeholder="Ex: Orange Money, Recharge..."
              value={formData.usualProduct}
              onChange={(e) => handleChange("usualProduct", e.target.value)}
              className="border-slate-200 focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full text-lg font-bold py-6 mt-4 transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ backgroundColor: primaryColor || "#f97316", color: "white" }}
            disabled={loading}
          >
            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Suivant"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
