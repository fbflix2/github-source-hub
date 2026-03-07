import { useNavigate } from "react-router-dom";

export default function SaibaMaisFBX() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: "#0F0F0F", color: "#FFFFFF", fontFamily: "'Inter', sans-serif" }}>
      {/* Background Decorative Elements */}
      <div
        className="absolute top-0 left-1/4 pointer-events-none"
        style={{
          width: 300, height: 300,
          background: "radial-gradient(circle, rgba(255,255,255,0.03) 0%, rgba(15,15,15,0) 70%)",
          zIndex: 0,
        }}
      />
      <div
        className="absolute bottom-0 right-1/4 pointer-events-none"
        style={{
          width: 300, height: 300,
          background: "radial-gradient(circle, rgba(255,255,255,0.03) 0%, rgba(15,15,15,0) 70%)",
          zIndex: 0,
        }}
      />

      <main className="relative z-10 min-h-screen py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Hero Section */}
          <section className="text-center mb-20">
            <div
              className="inline-flex items-center px-3 py-1 mb-6 rounded-full text-xs font-medium tracking-wider uppercase"
              style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9CA3AF" }}
            >
              Moeda Digital FbFlix
            </div>
            <h1
              className="text-4xl md:text-6xl font-extrabold mb-6 tracking-tight"
              style={{
                background: "linear-gradient(135deg, #FFFFFF 0%, #A1A1AA 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              O que é FBX e como usar na FbFlix?
            </h1>
            <p className="text-lg md:text-xl max-w-3xl mx-auto leading-relaxed" style={{ color: "#9CA3AF" }}>
              FBX é a moeda digital exclusiva da FbFlix – cada{" "}
              <span className="font-semibold" style={{ color: "#FFFFFF" }}>1 FBX vale exatamente como 1 real</span>, mas em forma digital dentro da nossa plataforma.
            </p>
          </section>

          {/* Features Grid */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
            {/* Feature 1: Recarga Simples */}
            <div
              className="p-8 flex flex-col h-full transition-all duration-300 hover:-translate-y-1"
              style={{
                background: "rgba(255,255,255,0.03)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: "1.5rem",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)";
              }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                <svg className="text-white" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24">
                  <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
                  <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-3">Recarga Simples</h3>
              <p className="leading-relaxed" style={{ color: "#9CA3AF" }}>
                Recarregue com <span className="font-medium" style={{ color: "#FFFFFF" }}>Pix</span> e ganhe FBX instantaneamente. A paridade é simples: 1 FBX = R$ 1,00.
              </p>
            </div>

            {/* Feature 2: Economia Real */}
            <FeatureCard
              icon={
                <svg className="text-white" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24">
                  <line x1="19" x2="5" y1="5" y2="19" />
                  <circle cx="6.5" cy="6.5" r="2.5" />
                  <circle cx="17.5" cy="17.5" r="2.5" />
                </svg>
              }
              title="Economia Real"
            >
              Use FBX para comprar BMs, proxies, perfis e ativos com{" "}
              <span className="font-bold" style={{ color: "#10B981" }}>10-20% de desconto</span> garantido.
            </FeatureCard>

            {/* Feature 3: Bônus e Cashback */}
            <FeatureCard
              icon={
                <svg style={{ color: "#10B981" }} fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24">
                  <polyline points="20 12 20 22 4 22 4 12" />
                  <rect height="5" width="20" x="2" y="7" />
                  <line x1="12" x2="12" y1="22" y2="7" />
                  <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
                  <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
                </svg>
              }
              title="Bônus e Cashback"
            >
              Ganhe bônus exclusivos em cada recarga ou ao realizar compras diretas usando seu saldo.
            </FeatureCard>

            {/* Feature 4: Valorização */}
            <FeatureCard
              icon={
                <svg style={{ color: "#10B981" }} fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
              }
              title="Valorização"
            >
              O preço oscila conforme a demanda; compre na baixa e use ou venda na alta para maximizar seu capital.
            </FeatureCard>

            {/* Feature 5: Liquidez */}
            <FeatureCard
              icon={
                <svg className="text-white" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24">
                  <path d="m16 3 4 4-4 4" />
                  <path d="M20 7H4" />
                  <path d="m8 21-4-4 4-4" />
                  <path d="M4 17h16" />
                </svg>
              }
              title="Liquidez"
            >
              Liberdade total. Venda seu saldo FBX quando desejar e receba via{" "}
              <span className="font-medium" style={{ color: "#FFFFFF" }}>Pix direto na sua conta</span> bancária.
            </FeatureCard>

            {/* Feature 6: Transferências P2P */}
            <FeatureCard
              icon={
                <svg className="text-white" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              }
              title="Transferências P2P"
            >
              Envie e receba FBX entre usuários com facilidade e total segurança através da proteção{" "}
              <span className="italic">escrow</span> da FbFlix.
            </FeatureCard>
          </section>

          {/* Call to Action */}
          <section
            className="relative overflow-hidden p-8 md:p-12 text-center"
            style={{
              borderRadius: "2rem",
              backgroundColor: "#FFFFFF",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
          >
            <div
              className="absolute top-0 right-0 -mr-16 -mt-16 rounded-full"
              style={{ width: 256, height: 256, background: "rgba(0,0,0,0.05)", filter: "blur(48px)" }}
            />
            <h2 className="text-2xl md:text-4xl font-bold mb-4" style={{ color: "#000000" }}>
              Pronto para otimizar sua operação?
            </h2>
            <p className="mb-8 text-lg font-medium" style={{ color: "#4B5563" }}>
              Use e aproveite os benefícios exclusivos!
            </p>
            <button
              onClick={() => navigate("/mercado/token-fbx")}
              className="font-bold text-lg transition-transform hover:scale-105 active:scale-95"
              style={{
                backgroundColor: "#000000",
                color: "#FFFFFF",
                padding: "16px 32px",
                borderRadius: "9999px",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
              }}
            >
              Começar a usar FBX
            </button>
          </section>

          {/* Footer */}
          <footer className="mt-20 text-center pb-10 pt-10" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <p className="text-sm" style={{ color: "#6B7280" }}>
              © 2023 FbFlix Digital Ecosystem. Tecnologia e performance para sua operação.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div
      className="p-8 flex flex-col h-full transition-all duration-300 hover:-translate-y-1"
      style={{
        background: "rgba(255,255,255,0.03)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.05)",
        borderRadius: "1.5rem",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.05)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.03)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)";
      }}
    >
      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="leading-relaxed" style={{ color: "#9CA3AF" }}>
        {children}
      </p>
    </div>
  );
}
