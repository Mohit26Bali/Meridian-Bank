import { Hero } from "@/components/marketing/hero";
import { TrustedBy } from "@/components/marketing/trusted-by";
import { Features } from "@/components/marketing/features";
import { TrustBadges } from "@/components/marketing/trust-badges";
import { Testimonials } from "@/components/marketing/testimonials";
import { Faq } from "@/components/marketing/faq";
import { CtaSection } from "@/components/marketing/cta-section";

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustedBy />
      <Features />
      <TrustBadges />
      <Testimonials />
      <Faq />
      <CtaSection />
    </>
  );
}
