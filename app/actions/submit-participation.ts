"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { getCurrentCity } from "@/app/actions/city-auth"
// import { getAvailablePrizes } from "@/app/actions/campaigns"

export async function submitParticipation(name: string, code: string, city: string, agreedToTerms: boolean, campaignId?: string) {
  try {
    const supabase = createServiceClient()

    // Check for authenticated city and enforce it
    const authCity = await getCurrentCity()
    const finalCity = authCity ? authCity.name : city

    // Validate inputs
    if (!name?.trim() || !code?.trim() || !finalCity?.trim()) {
      return { success: false, error: "Veuillez remplir tous les champs" }
    }

    if (!agreedToTerms) {
      return { success: false, error: "Veuillez accepter les conditions générales" }
    }

    // Check campaign availability if campaignId is present
    if (campaignId) {
      let cityId = authCity?.id
      // If no auth city, try to resolve city ID from name to check limits
      if (!cityId && finalCity) {
        const { data: cityRows } = await supabase.from("cities").select("id").ilike("name", finalCity).limit(1)
        if (cityRows && cityRows.length > 0) cityId = cityRows[0].id
      }

      // const availability = await getAvailablePrizes(campaignId, cityId, finalCity)
      
      // if (availability.success && availability.data) {
      //   const hasAvailable = availability.data.some((g: any) => g.available)
      //   if (!hasAvailable) {
      //     return { success: false, error: "La période de participation est terminée pour aujourd'hui." }
      //   }
      // }
    }

    const normalizedCode = code.trim().toUpperCase()

  // Insert new participant
    const insertData: any = {
      name: name.trim(),
      code: normalizedCode,
      city: finalCity.trim(),
      agreed_to_terms: agreedToTerms,
      won: false,
    }

    if (campaignId) {
      insertData.campaign_id = campaignId
    }

    const { data, error: insertError } = await supabase
      .from("participants")
      .insert(insertData)
      .select()
      .single()

    if (insertError) {
      console.error("[v0] Insert error:", insertError)
      return { success: false, error: "Erreur lors de l'enregistrement. Veuillez réessayer." }
    }

    if (!data) {
      return { success: false, error: "Erreur lors de la création du participant" }
    }

    return { success: true, participantId: data.id }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Une erreur inattendue s'est produite"
    console.error("[v0] Server action error:", errorMessage)
    return { success: false, error: errorMessage }
  }
}
