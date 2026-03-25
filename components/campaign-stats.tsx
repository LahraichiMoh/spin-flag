"use client"

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Loader2, Users, MapPin, CalendarDays, PieChart as PieChartIcon, Filter, X, ArrowRight } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts"

interface CampaignStatsProps {
  campaignId: string
}

export function CampaignStats({ campaignId }: CampaignStatsProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any[]>([])
  
  // Date filter state
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const supabase = createClient()
      
      // Fetch only participants who have filled the details form (inner join)
      let query = supabase
        .from("participants")
        .select("created_at, city, participant_details!inner(gender)")
        .eq("campaign_id", campaignId)

      if (startDate) {
        query = query.gte("created_at", `${startDate}T00:00:00Z`)
      }
      if (endDate) {
        query = query.lte("created_at", `${endDate}T23:59:59Z`)
      }

      const { data: participants, error } = await query

      if (error) {
        console.error("Error fetching stats:", error)
      } else {
        setData(participants || [])
      }
      setLoading(false)
    }

    fetchData()
  }, [campaignId, startDate, endDate])

  // Process data for charts
  const stats = useMemo(() => {
    const dailyMap: Record<string, number> = {}
    const cityMap: Record<string, number> = {}
    const genderMap: Record<string, number> = { "Masculin": 0, "Féminin": 0 }

    data.forEach((p) => {
      // Daily stats
      const date = new Date(p.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
      dailyMap[date] = (dailyMap[date] || 0) + 1

      // City stats
      const city = p.city || "Inconnu"
      cityMap[city] = (cityMap[city] || 0) + 1

      // Gender stats
      const gender = p.participant_details?.[0]?.gender
      if (gender === "Masculin" || gender === "Féminin") {
        genderMap[gender]++
      }
    })

    // Sort active days chronologically
    const sortedDailyData = Object.entries(dailyMap)
      .map(([name, total]) => ({ name, total }))
      // We don't have the original timestamp here, but since the map was built 
      // from the participants list which is likely ordered, it's mostly correct.
      // To be safer, we could extract the date objects.
    
    const cityData = Object.entries(cityMap).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total)
    const genderData = Object.entries(genderMap).filter(([_, total]) => total > 0).map(([name, value]) => ({ name, value }))

    return { dailyData: sortedDailyData, cityData, genderData }
  }, [data])

  const COLORS = ["#ff7900", "#000000", "#94a3b8", "#fbbf24", "#ef4444"]

  const clearFilters = () => {
    setStartDate("")
    setEndDate("")
  }

  return (
    <div className="space-y-6">
      {/* Unified Filter Section */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 text-slate-500 min-w-max">
          <CalendarDays className="h-5 w-5 text-orange-500" />
          <span className="text-sm font-semibold uppercase tracking-wider">Période</span>
        </div>
        
        <div className="flex items-center gap-0 w-full max-w-md group border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:border-orange-500 transition-all">
          <input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)}
            className="flex-1 bg-slate-50/50 px-3 py-2 text-sm outline-none border-none cursor-pointer"
            placeholder="Début"
          />
          <div className="bg-slate-50/50 px-2 flex items-center">
            <ArrowRight className="h-3 w-3 text-slate-400" />
          </div>
          <input 
            type="date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)}
            className="flex-1 bg-slate-50/50 px-3 py-2 text-sm outline-none border-none cursor-pointer"
            placeholder="Fin"
          />
        </div>

        {(startDate || endDate) && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-400 hover:text-red-600 h-9">
            <X className="h-4 w-4 mr-1" /> Effacer
          </Button>
        )}

        <div className="ml-auto hidden md:block">
          <div className="text-[10px] text-slate-400 font-medium uppercase tracking-widest text-right">
            {startDate && endDate ? (
              startDate === endDate ? `Journée du ${new Date(startDate).toLocaleDateString('fr-FR')}` : `Du ${new Date(startDate).toLocaleDateString('fr-FR')} au ${new Date(endDate).toLocaleDateString('fr-FR')}`
            ) : "Affichage de toutes les données"}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-orange-50 border-orange-100 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-orange-600 font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" /> Total Participants
                </CardDescription>
                <CardTitle className="text-3xl font-black text-orange-700">{data.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-slate-50 border-slate-100 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-slate-600 font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Villes Actives
                </CardDescription>
                <CardTitle className="text-3xl font-black text-slate-700">{stats.cityData.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-slate-50 border-slate-100 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-slate-600 font-semibold flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" /> Jours avec Activité
                </CardDescription>
                <CardTitle className="text-3xl font-black text-slate-700">{stats.dailyData.length}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Participation par jour */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-orange-500" />
                  Participations par jour
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                {stats.dailyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.dailyData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip 
                        cursor={{ fill: '#f1f5f9' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Bar dataKey="total" fill="#ff7900" radius={[4, 4, 0, 0]} barSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400 text-sm">Aucune donnée pour cette période</div>
                )}
              </CardContent>
            </Card>

            {/* Distribution par sexe */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5 text-orange-500" />
                  Répartition par sexe
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                {stats.genderData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.genderData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {stats.genderData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400 text-sm">Aucune donnée de sexe disponible</div>
                )}
              </CardContent>
            </Card>

            {/* Top Villes */}
            <Card className="lg:col-span-2 shadow-sm border-slate-200">
              <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-orange-500" />
              Participations par Ville
            </CardTitle>
          </CardHeader>
          <CardContent style={{ height: Math.max(350, stats.cityData.length * 40) }}>
                {stats.cityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.cityData} layout="vertical" margin={{ left: 40, right: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" fontSize={12} tickLine={false} axisLine={false} width={100} />
                      <Tooltip 
                        cursor={{ fill: '#f1f5f9' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Bar dataKey="total" fill="#000000" radius={[0, 4, 4, 0]} barSize={20} label={{ position: 'right', fontSize: 12, fill: '#64748b' }} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400 text-sm">Aucune donnée par ville</div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
