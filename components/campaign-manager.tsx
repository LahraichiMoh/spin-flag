"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Plus, Trash2, Globe, Settings, Gift as GiftIcon, BarChart3, Palette, Save, Upload, ExternalLink, Users, Trophy } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getCampaigns, createCampaign, updateCampaign, deleteCampaign, type Campaign, type CampaignTheme } from "@/app/actions/campaigns"
import { CampaignGiftManager } from "@/components/campaign-gift-manager"
import { ParticipantList } from "@/components/participant-list"
import { createClient } from "@/lib/supabase/client"

export function CampaignManager() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [locationCities, setLocationCities] = useState<Array<{ id: string; name: string }>>([])
  const [locationVenues, setLocationVenues] = useState<
    Array<{
      id: string
      name: string
      type?: string | null
      stock: number
      city_id: string
      city?: { id: string; name: string } | null
    }>
  >([])
  const [locationCityId, setLocationCityId] = useState("")
  const [newVenueName, setNewVenueName] = useState("")
  const [newVenueType, setNewVenueType] = useState<"restau" | "bar" | "point de vente">("bar")
  const [newVenueStock, setNewVenueStock] = useState("0")
  const [savingVenue, setSavingVenue] = useState(false)
  const [deleteVenueId, setDeleteVenueId] = useState<string | null>(null)
  
  // Create/Edit form state
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    accessUsername: "",
    accessPassword: "",
    isActive: true,
    primaryColor: "#7f1d1d",
    secondaryColor: "#facc15",
    logoUrl: "",
    backgroundUrl: "",
  })
  
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingBg, setUploadingBg] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const bgInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadCampaigns()
  }, [])

  useEffect(() => {
    if (!editingCampaign) return
    const supabase = createClient()
    const load = async () => {
      const { data: citiesData } = await supabase.from("cities").select("id, name").order("name")
      setLocationCities((citiesData || []) as any)

      const { data: venuesData } = await supabase
        .from("venues")
        .select("id, name, type, stock, city_id, campaign_id, city:cities ( id, name )")
        .eq("campaign_id", editingCampaign.id)
        .order("name")
      setLocationVenues((venuesData || []) as any)
    }
    load()
  }, [editingCampaign])

  const loadCampaigns = async () => {
    setLoading(true)
    const res = await getCampaigns()
    if (res.success && res.data) {
      setCampaigns(res.data)
    }
    setLoading(false)
  }

  const handleUpload = async (file: File, type: 'logo' | 'bg') => {
    const isLogo = type === 'logo'
    
    if (isLogo) setUploadingLogo(true)
    else setUploadingBg(true)

    const fd = new FormData()
    fd.append("file", file)
    fd.append("bucket", "campaign-assets")
    
    try {
      const res = await fetch("/api/upload-prize", { method: "POST", body: fd })
      const json = await res.json()
      if (json.success) {
        setFormData(prev => ({
          ...prev,
          [isLogo ? 'logoUrl' : 'backgroundUrl']: json.url
        }))
        toast.success("Image téléchargée avec succès")
      } else {
        toast.error("Erreur lors de l'upload: " + json.error)
      }
    } catch (e) {
      toast.error("Erreur lors de l'upload")
    } finally {
      if (isLogo) setUploadingLogo(false)
      else setUploadingBg(false)
    }
  }

  const handleEdit = (campaign: Campaign) => {
    setEditingCampaign(campaign)
    setFormData({
      name: campaign.name,
      slug: campaign.slug,
      description: campaign.description || "",
      accessUsername: campaign.access_username || "",
      accessPassword: "",
      isActive: campaign.is_active !== false,
      primaryColor: campaign.theme.primaryColor || "#7f1d1d",
      secondaryColor: campaign.theme.secondaryColor || "#facc15",
      logoUrl: campaign.theme.logoUrl || "",
      backgroundUrl: campaign.theme.backgroundUrl || "",
    })
  }

  const handleDelete = (id: string) => {
    setDeleteId(id)
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    const res = await deleteCampaign(deleteId)
    if (res.success) {
      setCampaigns(campaigns.filter(c => c.id !== deleteId))
      if (editingCampaign?.id === deleteId) setEditingCampaign(null)
      toast.success("Campagne supprimée")
    } else {
      toast.error("Erreur: " + res.error)
    }
    setDeleteId(null)
  }

  const handleSave = async () => {
    const theme: CampaignTheme = {
      primaryColor: formData.primaryColor,
      secondaryColor: formData.secondaryColor,
      logoUrl: formData.logoUrl,
      backgroundUrl: formData.backgroundUrl,
    }

    if (editingCampaign) {
      const updatePayload: any = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        theme,
        is_active: formData.isActive,
        access_username: formData.accessUsername,
      }
      if (formData.accessPassword.trim()) {
        updatePayload.access_password = formData.accessPassword
      }
      const res = await updateCampaign(editingCampaign.id, updatePayload)
      if (res.success && res.data) {
        setCampaigns(campaigns.map(c => c.id === editingCampaign.id ? res.data! : c))
        setEditingCampaign(res.data) // Update current editing
        setFormData((prev) => ({ ...prev, accessPassword: "" }))
        toast.success("Campagne mise à jour")
      } else {
        toast.error("Erreur: " + (res.error || "Impossible de mettre à jour la campagne"))
      }
    } else {
      const res = await createCampaign({
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        theme,
        is_active: formData.isActive,
        access_username: formData.accessUsername,
        access_password: formData.accessPassword,
      })
      if (res.success && res.data) {
        setCampaigns([res.data, ...campaigns])
        setShowCreateForm(false)
        setFormData({
            name: "",
            slug: "",
            description: "",
            accessUsername: "",
            accessPassword: "",
            isActive: true,
            primaryColor: "#7f1d1d",
            secondaryColor: "#facc15",
            logoUrl: "",
            backgroundUrl: "",
        })
        toast.success("Campagne créée")
      } else {
        toast.error("Erreur: " + (res.error || "Impossible de créer la campagne"))
      }
    }
  }

  if (loading) return <div>Chargement...</div>

  if (editingCampaign) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => setEditingCampaign(null)}>← Retour</Button>
          <h2 className="text-2xl font-bold">{editingCampaign.name}</h2>
        </div>

        <Tabs defaultValue="settings">
          <TabsList className="inline-flex h-12 items-center gap-1 rounded-xl bg-slate-100 p-1 shadow-sm ring-1 ring-slate-200">
            <TabsTrigger
              value="settings"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900"
            >
              <Settings className="mr-2 h-4 w-4" /> Paramètres
            </TabsTrigger>
            <TabsTrigger
              value="gifts"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900"
            >
              <GiftIcon className="mr-2 h-4 w-4" /> Cadeaux
            </TabsTrigger>
            <TabsTrigger
              value="venues"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900"
            >
              <Globe className="mr-2 h-4 w-4" /> Établissements
            </TabsTrigger>
            <TabsTrigger
              value="participants"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900"
            >
              <Users className="mr-2 h-4 w-4" /> Participants
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Paramètres de la campagne</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Nom</Label>
                        <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <Label>Slug (URL)</Label>
                        <Input value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} />
                    </div>
                    <div className="col-span-2 space-y-2">
                        <Label>Description</Label>
                        <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <Label>Utilisateur (Campagne)</Label>
                        <Input value={formData.accessUsername} onChange={e => setFormData({...formData, accessUsername: e.target.value})} placeholder="ex: campagne1" />
                    </div>
                    <div className="space-y-2">
                        <Label>Mot de passe (Campagne)</Label>
                        <Input type="password" value={formData.accessPassword} onChange={e => setFormData({...formData, accessPassword: e.target.value})} placeholder="••••••••" />
                    </div>
                    <div className="col-span-2 flex items-center gap-2 pt-2">
                        <Checkbox
                          id="campaign-active-edit"
                          checked={formData.isActive}
                          onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked === true })}
                        />
                        <Label htmlFor="campaign-active-edit">Campagne active (visible sur la page d&apos;accueil)</Label>
                    </div>
                </div>
                
                <div className="space-y-4 border-t pt-4">
                    <h3 className="font-medium flex items-center"><Palette className="mr-2 h-4 w-4" /> Apparence</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Couleur principale</Label>
                            <div className="flex gap-2">
                                <Input type="color" className="w-12 p-1" value={formData.primaryColor} onChange={e => setFormData({...formData, primaryColor: e.target.value})} />
                                <Input value={formData.primaryColor} onChange={e => setFormData({...formData, primaryColor: e.target.value})} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Couleur secondaire</Label>
                            <div className="flex gap-2">
                                <Input type="color" className="w-12 p-1" value={formData.secondaryColor} onChange={e => setFormData({...formData, secondaryColor: e.target.value})} />
                                <Input value={formData.secondaryColor} onChange={e => setFormData({...formData, secondaryColor: e.target.value})} />
                            </div>
                        </div>
                         <div className="space-y-2">
                            <Label>URL du Logo</Label>
                            <div className="flex gap-2">
                                <Input value={formData.logoUrl} onChange={e => setFormData({...formData, logoUrl: e.target.value})} placeholder="/logo.png" />
                                <input 
                                  type="file" 
                                  ref={logoInputRef} 
                                  className="hidden" 
                                  accept="image/*"
                                  onChange={(e) => {
                                    if (e.target.files?.[0]) handleUpload(e.target.files[0], 'logo')
                                  }}
                                />
                                <Button 
                                  type="button"
                                  variant="outline" 
                                  size="icon"
                                  onClick={() => logoInputRef.current?.click()}
                                  disabled={uploadingLogo}
                                >
                                  {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                </Button>
                            </div>
                            {formData.logoUrl && (
                                <img src={formData.logoUrl} alt="Logo preview" className="h-16 object-contain border rounded bg-gray-50 mt-2" />
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>URL de l&apos;arrière-plan</Label>
                            <div className="flex gap-2">
                                <Input value={formData.backgroundUrl} onChange={e => setFormData({...formData, backgroundUrl: e.target.value})} placeholder="/bg.jpg" />
                                <input 
                                  type="file" 
                                  ref={bgInputRef} 
                                  className="hidden" 
                                  accept="image/*"
                                  onChange={(e) => {
                                    if (e.target.files?.[0]) handleUpload(e.target.files[0], 'bg')
                                  }}
                                />
                                <Button 
                                  type="button"
                                  variant="outline" 
                                  size="icon"
                                  onClick={() => bgInputRef.current?.click()}
                                  disabled={uploadingBg}
                                >
                                  {uploadingBg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                </Button>
                            </div>
                            {formData.backgroundUrl && (
                                <img src={formData.backgroundUrl} alt="BG preview" className="h-16 w-full object-cover border rounded mt-2" />
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button onClick={handleSave} style={{ backgroundColor: formData.primaryColor, color: "white" }}>
                      <Save className="mr-2 h-4 w-4" /> Enregistrer les modifications
                    </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="gifts">
            <CampaignGiftManager campaignId={editingCampaign.id} campaignName={editingCampaign.name} />
          </TabsContent>

          <TabsContent value="venues">
            <Card>
              <CardHeader>
                <CardTitle>Restau / Bar</CardTitle>
                <CardDescription>Créez des établissements et associez-les à une ville.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Ville</Label>
                    <select
                      value={locationCityId}
                      onChange={(e) => setLocationCityId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    >
                      <option value="">Choisir une ville</option>
                      {locationCities.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Nom (Restau / Bar)</Label>
                    <Input value={newVenueName} onChange={(e) => setNewVenueName(e.target.value)} placeholder="Ex: Le Nord Bar" />
                  </div>

                  <div className="space-y-2">
                    <Label>Type</Label>
                    <select
                      value={newVenueType}
                      onChange={(e) => setNewVenueType(e.target.value as any)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    >
                      <option value="bar">bar</option>
                      <option value="restau">restau</option>
                      <option value="point de vente">point de vente</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Stock (optionnel)</Label>
                    <Input type="number" min="0" value={newVenueStock} onChange={(e) => setNewVenueStock(e.target.value)} />
                  </div>

                  <div className="md:col-span-2 flex items-end justify-end">
                    <Button
                      type="button"
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                      disabled={
                        savingVenue ||
                        !locationCityId ||
                        !newVenueName.trim()
                      }
                      onClick={async () => {
                        const supabase = createClient()
                        setSavingVenue(true)
                        try {
                          const { error: venueError } = await supabase.from("venues").insert({
                            city_id: locationCityId,
                            campaign_id: editingCampaign.id,
                            name: newVenueName.trim(),
                            type: newVenueType,
                            stock: parseInt(newVenueStock) || 0,
                          })
                          if (venueError) {
                            toast.error(venueError.message || "Erreur lors de la création")
                            return
                          }

                          const { data: venuesData, error: venuesError } = await supabase
                            .from("venues")
                            .select("id, name, type, stock, city_id, campaign_id, city:cities ( id, name )")
                            .eq("campaign_id", editingCampaign.id)
                            .order("name")
                          if (venuesError) {
                            toast.error(venuesError.message || "Erreur lors du chargement des établissements")
                          }
                          setLocationVenues((venuesData || []) as any)

                          setNewVenueName("")
                          setNewVenueType("bar")
                          setNewVenueStock("0")
                          toast.success("Établissement créé")
                        } catch (err) {
                          const msg =
                            (typeof (err as any)?.message === "string" && (err as any).message) ||
                            "Erreur lors de la création"
                          toast.error(msg)
                        } finally {
                          setSavingVenue(false)
                        }
                      }}
                    >
                      {savingVenue ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Créer
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Liste</h3>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        const supabase = createClient()
                        const { data, error } = await supabase
                          .from("venues")
                          .select("id, name, type, stock, city_id, campaign_id, city:cities ( id, name )")
                          .eq("campaign_id", editingCampaign.id)
                          .order("name")
                        if (error) toast.error(error.message || "Erreur lors du chargement des établissements")
                        setLocationVenues((data || []) as any)
                      }}
                    >
                      Rafraîchir
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {locationVenues
                      .filter((v) => (locationCityId ? v.city_id === locationCityId : true))
                      .map((v) => (
                        <div key={v.id} className="flex items-center justify-between border rounded-lg p-3 bg-slate-50">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-800">
                              {v.name}{v.type ? ` (${v.type})` : ""}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {v.city?.name || "-"}
                            </span>
                            <span className="text-xs text-slate-500">Stock: {v.stock ?? 0}</span>
                          </div>
                          <Button type="button" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteVenueId(v.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                  </div>

                  {locationVenues.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center">Aucun établissement.</p>
                  )}
                </div>

                <AlertDialog open={!!deleteVenueId} onOpenChange={(open) => !open && setDeleteVenueId(null)}>
                  <AlertDialogContent className="bg-white dark:bg-slate-900">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer l&apos;établissement ?</AlertDialogTitle>
                      <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700"
                        onClick={async () => {
                          if (!deleteVenueId) return
                          const supabase = createClient()
                          const { error } = await supabase
                            .from("venues")
                            .delete()
                            .eq("id", deleteVenueId)
                            .eq("campaign_id", editingCampaign.id)
                          if (error) {
                            toast.error(error.message)
                            setDeleteVenueId(null)
                            return
                          }
                          setLocationVenues((prev) => prev.filter((x) => x.id !== deleteVenueId))
                          setDeleteVenueId(null)
                          toast.success("Établissement supprimé")
                        }}
                      >
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="participants">
            <ParticipantList campaignId={editingCampaign.id} />
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Mes Campagnes</h2>
        <Button onClick={() => setShowCreateForm(true)}><Plus className="mr-2 h-4 w-4" /> Nouvelle Campagne</Button>
      </div>

      {showCreateForm && (
        <Card
          className="mb-6 border-dashed overflow-hidden relative"
          style={{
            backgroundImage: formData.backgroundUrl ? `url(${formData.backgroundUrl})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backgroundColor: formData.primaryColor,
          }}
        >
          <div className="absolute inset-0 bg-white/85" />
          <CardHeader className="relative">
            <CardTitle>Créer une nouvelle campagne</CardTitle>
          </CardHeader>
          <CardContent className="relative space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: Été 2024" />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} placeholder="ete-2024" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Description</Label>
                <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Description de la campagne" />
              </div>
              <div className="space-y-2">
                <Label>Utilisateur (Campagne)</Label>
                <Input value={formData.accessUsername} onChange={e => setFormData({...formData, accessUsername: e.target.value})} placeholder="ex: campagne1" />
              </div>
              <div className="space-y-2">
                <Label>Mot de passe (Campagne)</Label>
                <Input type="password" value={formData.accessPassword} onChange={e => setFormData({...formData, accessPassword: e.target.value})} placeholder="••••••••" />
              </div>
              <div className="col-span-2 flex items-center gap-2 pt-2">
                <Checkbox
                  id="campaign-active-create"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked === true })}
                />
                <Label htmlFor="campaign-active-create">Campagne active (visible sur la page d&apos;accueil)</Label>
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium flex items-center"><Palette className="mr-2 h-4 w-4" /> Apparence</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Couleur principale</Label>
                  <div className="flex gap-2">
                    <Input type="color" className="w-12 p-1" value={formData.primaryColor} onChange={e => setFormData({...formData, primaryColor: e.target.value})} />
                    <Input value={formData.primaryColor} onChange={e => setFormData({...formData, primaryColor: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Couleur secondaire</Label>
                  <div className="flex gap-2">
                    <Input type="color" className="w-12 p-1" value={formData.secondaryColor} onChange={e => setFormData({...formData, secondaryColor: e.target.value})} />
                    <Input value={formData.secondaryColor} onChange={e => setFormData({...formData, secondaryColor: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>URL du Logo</Label>
                  <div className="flex gap-2">
                    <Input value={formData.logoUrl} onChange={e => setFormData({...formData, logoUrl: e.target.value})} placeholder="/logo.png" />
                    <input
                      type="file"
                      ref={logoInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleUpload(e.target.files[0], 'logo')
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                    >
                      {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    </Button>
                  </div>
                  {formData.logoUrl && (
                    <img src={formData.logoUrl} alt="Logo preview" className="h-16 object-contain border rounded bg-gray-50 mt-2" />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>URL de l&apos;arrière-plan</Label>
                  <div className="flex gap-2">
                    <Input value={formData.backgroundUrl} onChange={e => setFormData({...formData, backgroundUrl: e.target.value})} placeholder="/bg.jpg" />
                    <input
                      type="file"
                      ref={bgInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleUpload(e.target.files[0], 'bg')
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => bgInputRef.current?.click()}
                      disabled={uploadingBg}
                    >
                      {uploadingBg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    </Button>
                  </div>
                  {formData.backgroundUrl && (
                    <img src={formData.backgroundUrl} alt="BG preview" className="h-16 w-full object-cover border rounded mt-2" />
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowCreateForm(false)}>Annuler</Button>
              <Button onClick={handleSave} style={{ backgroundColor: formData.primaryColor, color: "white" }}>Créer</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {campaigns.map(campaign => (
          <Card key={campaign.id} className="hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => handleEdit(campaign)}>
            <div className="h-32 bg-cover bg-center relative" style={{ backgroundImage: `url(${campaign.theme.backgroundUrl || '/placeholder-bg.jpg'})`, backgroundColor: campaign.theme.primaryColor }}>
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                {campaign.theme.logoUrl && (
                    <img src={campaign.theme.logoUrl} alt="" className="absolute bottom-[-20px] left-4 w-16 h-16 rounded-full border-4 border-white object-contain bg-white" />
                )}
            </div>
            <CardHeader className="pt-8">
              <CardTitle className="flex justify-between items-start">
                <span>{campaign.name}</span>
                <div className="flex gap-1">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            window.open(`/c/${campaign.slug}`, '_blank');
                        }} 
                        title="Voir la campagne"
                        className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                    >
                        <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(campaign.id) }} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Globe className="h-3 w-3" />
                <span>/{campaign.slug}</span>
                {campaign.is_active === false ? (
                  <span className="ml-auto rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Inactive
                  </span>
                ) : null}
              </CardDescription>
            </CardHeader>
            <CardContent>
               <p className="text-sm text-gray-500 line-clamp-2">{campaign.description || "Aucune description"}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Cela supprimera définitivement cette campagne et toutes les données associées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
