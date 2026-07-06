import { CategoryShowcase } from "@/components/home/category-showcase";
import { Editorial } from "@/components/home/editorial";
import { FeaturedProducts } from "@/components/home/featured-products";
import { Hero } from "@/components/home/hero";
import { Newsletter } from "@/components/home/newsletter";
import { PromoBanner } from "@/components/home/promo-banner";
import { ValueProps } from "@/components/home/value-props";
import { WorldCupSection } from "@/components/home/world-cup-section";

export default function HomePage() {
  return (
    <>
      <Hero />
      <FeaturedProducts />
      <WorldCupSection />
      <PromoBanner />
      <CategoryShowcase />
      <Editorial />
      <ValueProps />
      <Newsletter />
    </>
  );
}
