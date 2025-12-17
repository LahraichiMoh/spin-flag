"use server"

import { createServiceClient } from "@/lib/supabase/service"

export async function updateGift(
  id: string,
  payload: { name?: string; image_url?: string; emoji?: string; max_winners?: number; color?: string },
) {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase.from("gifts").update(payload).eq("id", id).select().single()
    if (error) {
      return { success: false, error: error.message }
    }
    return { success: true, data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return { success: false, error: msg }
  }
}

