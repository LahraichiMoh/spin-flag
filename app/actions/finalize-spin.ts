"use server"

import { createServiceClient } from "@/lib/supabase/service"
import { getAvailablePrizes, type Campaign, type Gift } from "@/app/actions/campaigns"

export async function finalizeSpin(participantId: string, selectedPrizeId: string, cityId?: string, _allowRespin?: boolean) {
  try {
    const supabase = createServiceClient()

    const { data: participantRow, error: participantFetchError } = await supabase
      .from("participants")
      .select("name, code, city, campaign_id, won, prize_id")
      .eq("id", participantId)
      .single()

    if (participantFetchError) {
      throw participantFetchError
    }

    // Resolve effective city id once for availability checks
    let effectiveCityId: string | undefined = cityId
    let effectiveCityName: string | undefined = participantRow.city

    // Always resolve from participant data to ensure correct city limits
    if (participantRow.city) {
      const { data: cityRows } = await supabase
        .from("cities")
        .select("id, name")
        .ilike("name", participantRow.city)
        .limit(1)
      
      if (cityRows && cityRows.length > 0) {
        effectiveCityId = cityRows[0].id
        effectiveCityName = cityRows[0].name
      }
    }

    if (participantRow.won === true) {
      return { success: false, error: "Already spun" }
    }

    // Strong guard: verify the selected prize is currently available for this campaign/city
    if (participantRow.campaign_id) {
      const availability = await getAvailablePrizes(participantRow.campaign_id, effectiveCityId, effectiveCityName)
      if (availability.success && availability.data) {
        const selected = availability.data.find((g: any) => g.id === selectedPrizeId)
        if (!selected || selected.available === false) {
          return { success: false, error: "La période de participation est terminée pour aujourd'hui." }
        }
      }
    }

    // --- CHECK LIMITS BEFORE AWARDING PRIZE ---
    const { data: prizeData, error: prizeFetchError } = await supabase
      .from("gifts")
      .select("current_winners, max_winners")
      .eq("id", selectedPrizeId)
      .single()

    if (prizeFetchError) {
      throw prizeFetchError
    }

    let isEligible = true
    let limitError = ""

    // 1. Check Global Limit
    if (prizeData.current_winners >= prizeData.max_winners) {
      isEligible = false
      limitError = "Global limit reached"
    }

    // 2. Check City Limit & Campaign City Limit (if global is okay)
    if (isEligible && (effectiveCityName || effectiveCityId)) {

      if (effectiveCityId) {
        // A. Check Gift City Limit
        const { data: limitRow } = await supabase
            .from("gift_city_limits")
            .select("max_winners")
            .eq("gift_id", selectedPrizeId)
            .eq("city_id", effectiveCityId)
            .single()

        if (limitRow && effectiveCityName) {
           const { count, error: countError } = await supabase
              .from("participants")
              .select("*", { count: "exact", head: true })
              .eq("prize_id", selectedPrizeId)
              .ilike("city", effectiveCityName) // Use ilike for safety
              .eq("won", true)
           
           if (!countError && count !== null && count >= limitRow.max_winners) {
             isEligible = false
             limitError = "La période de participation est terminée pour aujourd'hui."
           }
        }
      }
    }

    if (!isEligible) {
      // If not eligible, we don't mark as won. We might want to return an error or pick a fallback.
      // But since the wheel already spun, this is a race condition or configuration issue.
      // Ideally, the spin API should return the prize.
      // Here, we just fail the update to avoid over-awarding.
      return { success: false, error: limitError || "La période de participation est terminée pour aujourd'hui." }
    }
    // ------------------------------------------

    const { error: updateParticipantError } = await supabase
      .from("participants")
      .update({ won: true, prize_id: selectedPrizeId })
      .eq("id", participantId)
      .eq("won", false)

    if (updateParticipantError) {
      throw updateParticipantError
    }

    // Increment global counter
    const { error: incError } = await supabase
      .from("gifts")
      .update({ current_winners: prizeData.current_winners + 1 })
      .eq("id", selectedPrizeId)

    if (incError) {
      throw incError
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return { success: false, error: message }
  }
}

export async function getSpinData(participantId: string) {
  try {
    const supabase = createServiceClient()

    const { data: participant, error: participantError } = await supabase
      .from("participants")
      .select("id, name, code, city, won, prize_id, campaign_id")
      .eq("id", participantId)
      .single()

    if (participantError || !participant) {
      return { success: false as const, error: participantError?.message || "Participant introuvable" }
    }

    let campaign: Campaign | null = null
    if (participant.campaign_id) {
      const { data: campaignRow, error: campaignError } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", participant.campaign_id)
        .single()
      if (!campaignError && campaignRow) {
        campaign = campaignRow as Campaign
      }
    }

    let cityId: string | undefined
    if (participant.city) {
      const { data: cityRows } = await supabase.from("cities").select("id").ilike("name", participant.city).limit(1)
      if (cityRows && cityRows.length > 0) cityId = cityRows[0].id
    }

    let prizes: Gift[] = []
    if (participant.campaign_id) {
      const res = await getAvailablePrizes(participant.campaign_id, cityId, participant.city)
      prizes = res.success && res.data ? (res.data as Gift[]) : []
    } else {
      let query = supabase.from("gifts").select("*")
      const ownerId = process.env.NEXT_PUBLIC_GIFTS_OWNER_ID || ""
      if (ownerId) query = query.eq("created_by", ownerId)
      const { data: giftsData } = await query.order("created_at", { ascending: true })
      prizes = (giftsData || []) as Gift[]
    }

    return { success: true as const, data: { participant, campaign, prizes, cityId } }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return { success: false as const, error: message }
  }
}
