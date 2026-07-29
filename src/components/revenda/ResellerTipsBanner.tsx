import { useEffect, useState } from "react";
import growthAsset from "@/assets/reseller-banner-growth.jpg.asset.json";
import rechargeAsset from "@/assets/reseller-banner-recharge.jpg.asset.json";
import salesAsset from "@/assets/reseller-banner-sales.jpg.asset.json";

const BANNERS = [
  {
    img: growthAsset.url,
    tag: "Dica de divulgação",
    title: "Divulgue seus proxies nos grupos certos",
    text: "Compartilhe o link da sua loja em comunidades de tráfego pago e Facebook Ads — é onde estão os compradores de proxy.",
  },
  {
    img: rechargeAsset.url,
    tag: "Recarga inteligente",
    title: "Mantenha saldo para não perder vendas",
    text: "Sem créditos, a compra do seu cliente é bloqueada. Recarregue antes de campanhas e promoções.",
  },
  {
    img: salesAsset.url,
    tag: "Aumente o ticket",
    title: "Crie cupons e ofertas sazonais",
    text: "Use cupons de primeira compra para converter novos clientes e fidelizar na renovação mensal.",
  },
];

export default function ResellerTipsBanner() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIndex(i => (i + 1) % BANNERS.length), 7000);
    return () => clearInterval(t);
  }, []);

  const banner = BANNERS[index];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card">
      <img
        src={banner.img}
        alt={banner.title}
        className="absolute inset-0 h-full w-full object-cover opacity-30"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/30" />
      <div className="relative p-5 md:p-7 min-h-[150px] flex flex-col justify-center gap-2">
        <span className="w-fit rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary">
          {banner.tag}
        </span>
        <h3 className="text-lg md:text-xl font-bold text-foreground">{banner.title}</h3>
        <p className="text-sm text-muted-foreground max-w-2xl">{banner.text}</p>

        <div className="mt-2 flex gap-1.5">
          {BANNERS.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Banner ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-primary" : "w-2.5 bg-muted-foreground/30"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
