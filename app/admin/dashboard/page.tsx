import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminDashboard } from "@/components/admin-dashboard"

export const dynamic = "force-dynamic"

export default async function AdminDashboardPage() {
  let supabase;
  try {
    supabase = await createClient()
  } catch (error) {
    console.error("Supabase initialization failed:", error)
    redirect("/admin/login")
  }

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/admin/login")
  }

  // Check if user is admin
  const { data: adminData, error: adminError } = await supabase
    .from("admins")
    .select("id")
    .eq("id", data.user.id)
    .single()

  if (adminError || !adminData) {
    redirect("/admin/login")
  }

  return <AdminDashboard userId={data.user.id} />
}
