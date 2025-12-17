"use server"

import { createServiceClient } from "@/lib/supabase/service"

export async function resetPrizes() {
  try {
    const supabase = createServiceClient()
    const { error } = await supabase
      .from("gifts")
      .update({ current_winners: 0 })
      .not("id", "is", null)
    if (error) {
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return { success: false, error: msg }
  }
}
