"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CityManager } from "@/components/city-manager"
import { CampaignManager } from "@/components/campaign-manager"

interface AdminDashboardProps {
  userId: string
}

export function AdminDashboard({ userId }: AdminDashboardProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/admin/login")
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-white to-blue-50 p-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 rounded-2xl p-4 md:p-6 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 shadow-sm">
          <div className="flex items-center gap-3">
            <img src="/casa_logo.png" alt="Logo" className="w-10 h-10 rounded-lg shadow-sm" />
            <div className="space-y-0.5">
              <h1 className="text-3xl md:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-amber-600 to-yellow-600">
                Tableau de bord administrateur
              </h1>
              <p className="text-sm md:text-base text-amber-700">Gérer les campagnes et les villes</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button onClick={handleSignOut} variant="outline" className="w-full bg-gray-900 hover:bg-gray-800 text-white">
              Se déconnecter
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="campaigns" className="w-full">
          <TabsList className="w-full justify-start h-auto p-2 bg-transparent gap-2 flex-wrap mb-8 border-b border-amber-200">
            <TabsTrigger
              value="campaigns"
              className="rounded-full px-4 py-2 text-base font-semibold text-gray-900 data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:border data-[state=active]:border-amber-700"
            >
              Campagnes
            </TabsTrigger>
            <TabsTrigger
              value="cities"
              className="rounded-full px-4 py-2 text-base font-semibold text-gray-900 data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:border data-[state=active]:border-amber-700"
            >
              Villes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns">
            <CampaignManager />
          </TabsContent>

          <TabsContent value="cities">
            <CityManager />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
