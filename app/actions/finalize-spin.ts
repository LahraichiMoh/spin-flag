"use server"

import { createServiceClient } from "@/lib/supabase/service"

export async function finalizeSpin(participantId: string, selectedPrizeId: string) {
  try {
    const supabase = createServiceClient()

    const { data: participantRow, error: participantFetchError } = await supabase
      .from("participants")
      .select("name, code")
      .eq("id", participantId)
      .single()

    if (participantFetchError) {
      throw participantFetchError
    }

    const { error: updateParticipantError } = await supabase
      .from("participants")
      .update({ won: true, prize_id: selectedPrizeId })
      .eq("id", participantId)

    if (updateParticipantError) {
      throw updateParticipantError
    }

    // Create a new participant entry for this spin so each play is tracked
    if (participantRow) {
      const { error: insertError } = await supabase
        .from("participants")
        .insert({
          name: participantRow.name,
          code: participantRow.code,
          won: true,
          prize_id: selectedPrizeId,
        })
      if (insertError) {
        // Non-fatal: proceed even if insert fails
        // eslint-disable-next-line no-empty
      }
    }

    const { data: prizeData, error: prizeFetchError } = await supabase
      .from("gifts")
      .select("current_winners, max_winners")
      .eq("id", selectedPrizeId)
      .single()

    if (prizeFetchError) {
      throw prizeFetchError
    }

    if (prizeData && prizeData.current_winners < prizeData.max_winners) {
      const { error: incError } = await supabase
        .from("gifts")
        .update({ current_winners: prizeData.current_winners + 1 })
        .eq("id", selectedPrizeId)

      if (incError) {
        throw incError
      }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return { success: false, error: message }
  }
}
