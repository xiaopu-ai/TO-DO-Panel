import HeroSection from "./HeroSection";
import OperationMarquee from "./OperationMarquee";
import ProductStory from "./ProductStory";
import CapabilitiesSection from "./CapabilitiesSection";
import TabStack from "./TabStack";
import PrivacySection from "./PrivacySection";
import EndingSection from "./EndingSection";

export default function LandingPage() {
  return (
    <main className="landing-page">
      <HeroSection />
      <OperationMarquee />
      <ProductStory />
      <CapabilitiesSection />
      <section className="tabs-intro" data-section="tabs-intro" id="tabs"><span className="section-kicker">SIX WORKSPACES</span><h2>EVERY TAB</h2><p>一页解决一种高频动作。继续滚动，六个工作空间依次展开。</p></section>
      <section className="tab-stack-section" data-section="tab-stack"><TabStack /></section>
      <PrivacySection />
      <EndingSection />
    </main>
  );
}
