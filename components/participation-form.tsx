"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { submitParticipation } from "@/app/actions/submit-participation"
import Image from "next/image"

const GENERAL_CONDITIONS = `J'autorise la société et ses représentants, à reproduire et exploiter mon image en photo dans le cadre d'un reportage de remise de lots. Les photos seront utilisées à des fins de promotion et de communication sur les réseaux sociaux et/ou la presse nationale et pour des rapports internes de l'entreprise.

Cette autorisation emporte la possibilité d'apporter au reportage fait de mon image toutes modifications, adaptations ou suppressions qu'il jugera utile. Le Photographe pourra notamment l'utiliser, la publier, la reproduire, l'adapter ou la modifier, seule ou en combinaison avec d'autres matériels.

Cette autorisation est valable pour une utilisation sur une durée de : 1 an. Je garantis n'être lié(e) par aucun accord avec un tiers, de quelque nature que ce soit, ayant pour objet ou pour effet de limiter ou empêcher la mise en œuvre de la présente autorisation. La présente autorisation d'exploitation de mon droit à l'image est consentie à titre gratuit.`

export function ParticipationForm() {
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const isFormValid = name.trim().length > 0 && code.trim().length > 0 && agreedToTerms

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      if (!name.trim() || !code.trim()) {
        setError("Veuillez remplir tous les champs")
        setIsLoading(false)
        return
      }

      if (!agreedToTerms) {
        setError("Veuillez accepter les conditions générales")
        setIsLoading(false)
        return
      }

      const result = await submitParticipation(name, code, agreedToTerms)

      if (!result.success) {
        setError(result.error || "Une erreur s'est produite")
        setIsLoading(false)
        return
      }

      router.push(`/spin/${result.participantId}`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Une erreur s'est produite"
      console.error("[v0] Form submission error:", errorMessage)
      setError(errorMessage)
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="flex justify-center mb-8">
        <Image src="/casa_logo.png" alt="Casablanca Logo" width={140} height={140} className="rounded-xl shadow-md" />
      </div>

      <div className="bg-red-900 text-white rounded-t-3xl px-8 py-6">
        <h1 className="text-3xl font-bold text-center">Formulaire</h1>
      </div>

      <div className="bg-white rounded-b-3xl px-8 py-10 shadow-2xl">
        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-8 pb-4 border-b-2 border-yellow-400">
              Informations Personnelles
            </h2>

            <div className="space-y-7">
              <div className="space-y-3">
                <Label htmlFor="name" className="text-gray-900 font-semibold text-base">
                  Nom <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="name"
                    type="text"
                    placeholder="Entrez votre nom"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="border-2 border-gray-200 rounded-xl px-5 py-6 text-base bg-white transition-all duration-300 placeholder:text-gray-400 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-opacity-30 shadow-sm hover:border-gray-300"
                    required
                  />
                  {name.trim() && (
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-green-500">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="code" className="text-gray-900 font-semibold text-base">
                  Ton Code <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="code"
                    type="text"
                    placeholder="Entrez ton code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="border-2 border-gray-200 rounded-xl px-5 py-6 text-base bg-white transition-all duration-300 placeholder:text-gray-400 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-opacity-30 shadow-sm hover:border-gray-300"
                    required
                  />
                  {code.trim() && (
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-green-500">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="bg-gradient-to-br from-blue-50 to-gray-50 border-2 border-blue-100 p-7 rounded-2xl">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-2xl">📋</span> Conditions Générales
              </h3>
              <div className="bg-white border border-gray-200 rounded-xl p-5 h-40 overflow-y-auto text-gray-700 leading-relaxed text-sm shadow-inner">
                {GENERAL_CONDITIONS.split("\n\n").map((paragraph, idx) => (
                  <p key={idx} className="mb-3 last:mb-0">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>

            <div className="flex items-start space-x-3 mt-6 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer group">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                className="w-6 h-6 mt-0.5 border-2 border-gray-300 rounded-lg transition-all group-hover:border-yellow-400"
              />
              <Label htmlFor="terms" className="text-gray-900 font-medium text-base cursor-pointer leading-relaxed">
                <span className="text-blue-600 font-semibold">J'accepte les conditions générales</span>{" "}
                <span className="text-red-500">*</span>
              </Label>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border-2 border-red-300 text-red-800 px-5 py-4 rounded-xl text-sm font-medium flex items-start gap-3 animate-pulse">
              <span className="text-xl">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={!isFormValid || isLoading}
            className={`w-full font-bold py-6 text-lg rounded-xl transition-all duration-300 shadow-lg ${
              isFormValid
                ? "bg-red-900 hover:bg-red-700 text-white cursor-pointer shadow-red-400/50"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Chargement...
              </span>
            ) : (
              "Soumettre"
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
