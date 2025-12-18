"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { revalidatePath } from "next/cache"

export type CampaignTheme = {
  primaryColor?: string
  secondaryColor?: string
  logoUrl?: string
  backgroundUrl?: string
  fontFamily?: string
}

export type Campaign = {
  id: string
  name: string
  slug: string
  description?: string
  theme: CampaignTheme
  is_active: boolean
  created_at: string
}

export interface Gift {
  id: string
  name: string
  emoji: string
  image_url?: string
  max_winners: number
  current_winners: number
  color?: string
  campaign_id?: string
  created_by?: string
  available?: boolean // Computed field
}

export async function getCampaigns() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching campaigns:", error)
    return { success: false, error: error.message }
  }

  return { success: true, data: data as Campaign[] }
}

export async function getCampaignBySlug(slug: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("slug", slug)
    .single()

  if (error) {
    console.error(`Error fetching campaign with slug ${slug}:`, error)
    return { success: false, error: error.message }
  }

  return { success: true, data: data as Campaign }
}

export async function getCampaignById(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    console.error(`Error fetching campaign with id ${id}:`, error)
    return { success: false, error: error.message }
  }

  return { success: true, data: data as Campaign }
}

export async function createCampaign(data: {
  name: string
  slug: string
  description?: string
  theme?: CampaignTheme
}) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: "Unauthorized" }
  }

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      name: data.name,
      slug: data.slug,
      description: data.description,
      theme: data.theme || {},
      created_by: user.id
    })
    .select()
    .single()

  if (error) {
    console.error("Error creating campaign:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/admin/dashboard")
  return { success: true, data: campaign as Campaign }
}

export async function updateCampaign(id: string, data: Partial<{
  name: string
  slug: string
  description: string
  theme: CampaignTheme
  is_active: boolean
}>) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "Unauthorized" }

  const { data: updated, error } = await supabase
    .from("campaigns")
    .update(data)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    console.error("Error updating campaign:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/admin/dashboard")
  return { success: true, data: updated as Campaign }
}

export async function deleteCampaign(id: string) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "Unauthorized" }

  const { error } = await supabase
    .from("campaigns")
    .delete()
    .eq("id", id)

  if (error) {
    console.error("Error deleting campaign:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/admin/dashboard")
  return { success: true }
}

// --- Gift Management ---

export async function getCampaignGifts(campaignId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("gifts")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("name")

  if (error) {
    console.error("Error fetching campaign gifts:", error)
    return { success: false, error: error.message }
  }

  return { success: true, data: data as Gift[] }
}

export async function createCampaignGift(campaignId: string, gift: {
  name: string
  image_url?: string
  emoji?: string
  max_winners: number
  color?: string
}) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "Unauthorized" }

  const payload = {
    ...gift,
    campaign_id: campaignId,
    created_by: user.id,
    current_winners: 0
  }

  const { data, error } = await supabase
    .from("gifts")
    .insert(payload)
    .select()
    .single()

  if (error) {
    console.error("Error creating gift:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/admin/dashboard")
  return { success: true, data: data as Gift }
}

export async function updateCampaignGift(giftId: string, updates: {
  name?: string
  image_url?: string
  emoji?: string
  max_winners?: number
  color?: string
}) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "Unauthorized" }

  const { data, error } = await supabase
    .from("gifts")
    .update(updates)
    .eq("id", giftId)
    .select()
    .single()

  if (error) {
    console.error("Error updating gift:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/admin/dashboard")
  return { success: true, data: data as Gift }
}

export async function resetGiftWinners(giftId: string) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "Unauthorized" }

  const { data, error } = await supabase
    .from("gifts")
    .update({ current_winners: 0 })
    .eq("id", giftId)
    .select()
    .single()

  if (error) {
    console.error("Error resetting gift winners:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/admin/dashboard")
  return { success: true, data: data as Gift }
}

export async function resetAllCampaignGifts(campaignId: string) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "Unauthorized" }
  
  const { data, error } = await supabase
    .from("gifts")
    .update({ current_winners: 0 })
    .eq("campaign_id", campaignId)
    .select()
  
  if (error) {
    console.error("Error resetting all campaign gifts:", error)
    return { success: false, error: error.message }
  }
  
  revalidatePath("/admin/dashboard")
  return { success: true, data: (data || []) as Gift[] }
}

export async function deleteCampaignGift(giftId: string) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "Unauthorized" }

  const { error } = await supabase
    .from("gifts")
    .delete()
    .eq("id", giftId)

  if (error) {
    console.error("Error deleting gift:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/admin/dashboard")
  return { success: true }
}

// --- Public / Spin Logic ---

export async function getAvailablePrizes(campaignId: string, cityId?: string, cityName?: string) {
  const supabase = createServiceClient() // Use service client to ensure we can read all limits/participants for counting

  // 1. Get all gifts for campaign
  const { data: gifts, error: giftsError } = await supabase
    .from("gifts")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("name")

  if (giftsError || !gifts) {
    return { success: false, error: "No gifts found" }
  }

  // Try to resolve cityId from cityName if missing
  if (!cityId && cityName) {
     const { data: cityRows } = await supabase
        .from("cities")
        .select("id")
        .ilike("name", cityName)
        .limit(1)
     if (cityRows && cityRows.length > 0) {
        cityId = cityRows[0].id
     }
  }

  // If no city info, just return global availability
  if (!cityId || !cityName) {
    const availableGifts = gifts.map(g => ({
      ...g,
      available: g.current_winners < g.max_winners
    }))
    return { success: true, data: availableGifts }
  }

  // 2. Fetch specific limits for this city
  const { data: cityLimits } = await supabase
    .from("gift_city_limits")
    .select("gift_id, max_winners")
    .eq("city_id", cityId)
    .in("gift_id", gifts.map(g => g.id))

  // 3. Fetch win counts for this city (for the relevant gifts)
  // We can't easily group-by in client, so we fetch winners. 
  // Optimization: Only fetch winners for this campaign and city.
  const { data: winners } = await supabase
    .from("participants")
    .select("prize_id")
    .eq("campaign_id", campaignId)
    .ilike("city", cityName)
    .eq("won", true)
    .not("prize_id", "is", null)

  // Map limits
  const limitsMap = new Map<string, number>()
  cityLimits?.forEach(l => limitsMap.set(l.gift_id, l.max_winners))

  // Count winners
  const winnerCounts = new Map<string, number>()
  winners?.forEach(w => {
    if (w.prize_id) {
        winnerCounts.set(w.prize_id, (winnerCounts.get(w.prize_id) || 0) + 1)
    }
  })

  // 4. Determine availability
  const availableGifts = gifts.map(gift => {
    const globalAvailable = gift.current_winners < gift.max_winners
    
    // City Limit Check
    let cityAvailable = true
    const cityLimit = limitsMap.get(gift.id)
    if (cityLimit !== undefined) {
      const cityCount = winnerCounts.get(gift.id) || 0
      if (cityCount >= cityLimit) {
        cityAvailable = false
      }
    }

    return {
      ...gift,
      available: globalAvailable && cityAvailable
    }
  })

  return { success: true, data: availableGifts }
}
