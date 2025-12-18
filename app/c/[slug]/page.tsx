import { notFound } from "next/navigation"
import { getCampaignBySlug } from "@/app/actions/campaigns"
import { getCurrentCity } from "@/app/actions/city-auth"
import { CityLoginForm } from "@/components/city-login-form"
import { CampaignParticipationForm } from "@/components/campaign-participation-form"

export default async function CampaignPage({ params }: { params: { slug: string } }) {
  const { slug } = await params
  const res = await getCampaignBySlug(slug)

  if (!res.success || !res.data) {
    notFound()
  }

  const campaign = res.data
  const city = await getCurrentCity()

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat"
      style={{ 
        backgroundImage: `url(${campaign.theme.backgroundUrl || '/placeholder-bg.jpg'})`,
        backgroundColor: campaign.theme.primaryColor || '#f3f4f6'
      }}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      
      <div className="relative z-10 w-full max-w-md">
        {city ? (
          <CampaignParticipationForm 
            campaignId={campaign.id}
            campaignName={campaign.name}
            cityId={city.id}
            cityName={city.name}
            theme={campaign.theme}
          />
        ) : (
          <CityLoginForm 
            campaignName={campaign.name}
            theme={campaign.theme}
          />
        )}
      </div>
    </div>
  )
}
