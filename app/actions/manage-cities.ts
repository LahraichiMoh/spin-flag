"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface City {
  id: string
  name: string
  username: string
  password?: string // Optional for display, required for update/create if changing
  created_at: string
}

export async function getCities() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("cities")
    .select("*")
    .order("name")

  if (error) {
    console.error("Error fetching cities:", error)
    return { success: false, error: error.message }
  }

  return { success: true, data: data as City[] }
}

export async function createCity(name: string, username: string, password: string) {
  const supabase = await createClient()
  
  // Check if username exists
  const { data: existing } = await supabase
    .from("cities")
    .select("id")
    .eq("username", username)
    .single()

  if (existing) {
    return { success: false, error: "Ce nom d'utilisateur existe déjà." }
  }

  const { data, error } = await supabase
    .from("cities")
    .insert([{ name, username, password }])
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/admin/dashboard")
  return { success: true, data }
}

export async function updateCity(id: string, updates: { name?: string; username?: string; password?: string }) {
  const supabase = await createClient()

  // If changing username, check uniqueness
  if (updates.username) {
    const { data: existing } = await supabase
      .from("cities")
      .select("id")
      .eq("username", updates.username)
      .neq("id", id) // Exclude self
      .single()

    if (existing) {
      return { success: false, error: "Ce nom d'utilisateur est déjà pris." }
    }
  }

  const { data, error } = await supabase
    .from("cities")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/admin/dashboard")
  return { success: true, data }
}

export async function deleteCity(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("cities")
    .delete()
    .eq("id", id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/admin/dashboard")
  return { success: true }
}
