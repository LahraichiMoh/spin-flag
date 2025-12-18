"use server"

import { createServiceClient } from "@/lib/supabase/service"
import { revalidatePath } from "next/cache"

export interface GiftCityLimit {
  id: string
  gift_id: string
  city_id: string
  max_winners: number
}

export async function getGiftCityLimits(giftId: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("gift_city_limits")
    .select("*")
    .eq("gift_id", giftId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: data as GiftCityLimit[] }
}

export async function upsertGiftCityLimit(giftId: string, cityId: string, maxWinners: number) {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from("gift_city_limits")
    .upsert({ gift_id: giftId, city_id: cityId, max_winners: maxWinners }, { onConflict: "gift_id, city_id" })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Recalculate and update the global limit for the gift
  const { data: allLimits } = await supabase
    .from("gift_city_limits")
    .select("max_winners")
    .eq("gift_id", giftId)

  const totalWinners = allLimits?.reduce((sum, limit) => sum + limit.max_winners, 0) || 0

  await supabase
    .from("gifts")
    .update({ max_winners: totalWinners })
    .eq("id", giftId)

  revalidatePath("/admin/dashboard")
  return { success: true, data }
}
