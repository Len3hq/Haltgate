import { LandingNav } from "@/components/landing/LandingNav";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Features } from "@/components/landing/Features";
import { GovernanceSection } from "@/components/landing/GovernanceSection";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <>
      <LandingNav />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <Features />
        <GovernanceSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
