"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
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

export function CampaignManager() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  
  // Create/Edit form state
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    primaryColor: "#7f1d1d",
    secondaryColor: "#facc15",
    logoUrl: "",
    backgroundUrl: "",
    loaderUrl: ""
  })
  
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingBg, setUploadingBg] = useState(false)
  const [uploadingLoader, setUploadingLoader] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const bgInputRef = useRef<HTMLInputElement>(null)
  const loaderInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadCampaigns()
  }, [])

  const loadCampaigns = async () => {
    setLoading(true)
    const res = await getCampaigns()
    if (res.success && res.data) {
      setCampaigns(res.data)
    }
    setLoading(false)
  }

  const handleUpload = async (file: File, type: 'logo' | 'bg' | 'loader') => {
    const isLogo = type === 'logo'
    const isLoader = type === 'loader'
    
    if (isLogo) setUploadingLogo(true)
    else if (isLoader) setUploadingLoader(true)
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
          [isLogo ? 'logoUrl' : isLoader ? 'loaderUrl' : 'backgroundUrl']: json.url
        }))
        toast.success("Image téléchargée avec succès")
      } else {
        toast.error("Erreur lors de l'upload: " + json.error)
      }
    } catch (e) {
      toast.error("Erreur lors de l'upload")
    } finally {
      if (isLogo) setUploadingLogo(false)
      else if (isLoader) setUploadingLoader(false)
      else setUploadingBg(false)
    }
  }

  const handleEdit = (campaign: Campaign) => {
    setEditingCampaign(campaign)
    setFormData({
      name: campaign.name,
      slug: campaign.slug,
      description: campaign.description || "",
      primaryColor: campaign.theme.primaryColor || "#7f1d1d",
      secondaryColor: campaign.theme.secondaryColor || "#facc15",
      logoUrl: campaign.theme.logoUrl || "",
      backgroundUrl: campaign.theme.backgroundUrl || "",
      loaderUrl: campaign.theme.loaderUrl || ""
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
      loaderUrl: formData.loaderUrl
    }

    if (editingCampaign) {
      const res = await updateCampaign(editingCampaign.id, {
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        theme
      })
      if (res.success && res.data) {
        setCampaigns(campaigns.map(c => c.id === editingCampaign.id ? res.data! : c))
        setEditingCampaign(res.data) // Update current editing
        toast.success("Campagne mise à jour")
      }
    } else {
      const res = await createCampaign({
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        theme
      })
      if (res.success && res.data) {
        setCampaigns([res.data, ...campaigns])
        setShowCreateForm(false)
        setFormData({
            name: "",
            slug: "",
            description: "",
            primaryColor: "#7f1d1d",
            secondaryColor: "#facc15",
            logoUrl: "",
            backgroundUrl: "",
            loaderUrl: ""
        })
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
          <TabsList>
            <TabsTrigger value="settings"><Settings className="mr-2 h-4 w-4" /> Paramètres</TabsTrigger>
            <TabsTrigger value="gifts"><GiftIcon className="mr-2 h-4 w-4" /> Cadeaux</TabsTrigger>
            <TabsTrigger value="participants"><Users className="mr-2 h-4 w-4" /> Participants</TabsTrigger>
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
                        <div className="space-y-2">
                            <Label>URL de l&apos;image de chargement</Label>
                            <div className="flex gap-2">
                                <Input value={formData.loaderUrl} onChange={e => setFormData({...formData, loaderUrl: e.target.value})} placeholder="/loader.jpg" />
                                <input 
                                  type="file" 
                                  ref={loaderInputRef} 
                                  className="hidden" 
                                  accept="image/*"
                                  onChange={(e) => {
                                    if (e.target.files?.[0]) handleUpload(e.target.files[0], 'loader')
                                  }}
                                />
                                <Button 
                                  type="button"
                                  variant="outline" 
                                  size="icon"
                                  onClick={() => loaderInputRef.current?.click()}
                                  disabled={uploadingLoader}
                                >
                                  {uploadingLoader ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                </Button>
                            </div>
                            {formData.loaderUrl && (
                                <img src={formData.loaderUrl} alt="Loader preview" className="h-16 object-contain border rounded bg-gray-50 mt-2" />
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" /> Enregistrer les modifications</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="gifts">
            <CampaignGiftManager campaignId={editingCampaign.id} campaignName={editingCampaign.name} />
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
        <Card className="mb-6 border-dashed bg-slate-50">
            <CardHeader><CardTitle>Créer une nouvelle campagne</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Nom</Label>
                        <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: Été 2024" />
                    </div>
                    <div className="space-y-2">
                        <Label>Slug</Label>
                        <Input value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} placeholder="ete-2024" />
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setShowCreateForm(false)}>Annuler</Button>
                    <Button onClick={handleSave}>Créer</Button>
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
                    <img src={campaign.theme.logoUrl} className="absolute bottom-[-20px] left-4 w-16 h-16 rounded-full border-4 border-white object-contain bg-white" />
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
              <CardDescription className="flex items-center gap-1">
                <Globe className="h-3 w-3" /> /{campaign.slug}
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
