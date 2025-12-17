"use server"

import { createClient } from "@/lib/supabase/server"

export async function submitParticipation(name: string, code: string, agreedToTerms: boolean) {
  try {
    const supabase = await createClient()

    // Validate inputs
    if (!name?.trim() || !code?.trim()) {
      return { success: false, error: "Veuillez remplir tous les champs" }
    }

    if (!agreedToTerms) {
      return { success: false, error: "Veuillez accepter les conditions générales" }
    }

  const normalizedCode = code.trim().toUpperCase()

  // Insert new participant
  const { data, error: insertError } = await supabase
    .from("participants")
    .insert({
      name: name.trim(),
        code: normalizedCode,
        agreed_to_terms: agreedToTerms,
        won: false,
      })
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
