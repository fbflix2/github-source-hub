interface Tutorial {
  id: number;
  title: string;
  level: string;
  levelIcon: string;
  category: string;
  duration: string;
  thumbnail: string;
  isPremium?: boolean;
}

const heroData = {
  badge: "Destaque da Semana",
  title: "Dominando o",
  titleHighlight: "FBFLIX ADS",
  description: "Aprenda como escalar suas campanhas e maximizar o ROI utilizando as novas ferramentas de automação da versão 2.0. Um guia completo do zero ao avançado.",
  heroImage: "https://lh3.googleusercontent.com/aida-public/AB6AXuBcE2IgF4rncgfsFRBXcpi_2HMknhC7YMsgCtuHHmav8imi7qT9Kzspr-RhKSO_j4ekv_ALbL8ZzPt1mXB0jk_jHKINK6AecyWfNooujAkSpjSko-HfNYdqJG314FbIKo_3-LQ3J9Rzu91u0qmy12aWvt3sSemmGlhvePfnkCfg3xl4Hzwec82Ite6I_vUDX0NMCXC2sl_-taJ_5wtHdQ7B1kNorgkQ_ADm8ziEUsXTnC0rwSdidL6zxDiO_6By_H1L53IYPGOiXqA",
};

const beginnerTutorials: Tutorial[] = [
  { id: 1, title: "Configurando sua Conta", level: "Iniciante", levelIcon: "school", category: "Atualizado hoje", duration: "04:20", thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuAOqtczkn42EjPKXLHuDwY5rKb8QBe4zbvH3DFZMByzxdyw4PV530ltkzx6mme0dq_z6wSJ2b8cdDKz4t1u0IxorBJ36cwzk2HEvEkqsVXJtN9RsglqtcMS0WHQ0ODKcBYbjfb21sLLfQMtznio4MJl--Qx-ico4BVRqm3a4OFr45RHy5rLlp0O2VPlSrzNSDzV5Rd_HOCexVcz758_dC_fZmLmboCTZP14_j6TIZ8MbbE1x_EEkKFjxQ54tzbNivuFinGY5C0Lnzw" },
  { id: 2, title: "Tour pelo Dashboard", level: "Iniciante", levelIcon: "school", category: "Módulo 1", duration: "08:45", thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuA1kKIlMMLbCXgv-ERmVHr2pWBBSzI_CBbd-5BvszNrXGQj1t_CJICUZf8Rygb_3lkVI9Pr1CcLvSJzCor4ye-Ocq86FN-NoxjPi8Ky-Y5EdXqf4iyJcriouOzFOWwpeP6hDme-Dcd6u-aA6f4EzzlC0H7OPba7nYtr1fakSDw0D85y2OJaBExFnFtpVAaNF-GcGCu2wqTswSRWN71239DeYny1_uCtDYzX3aHLpa89so5xoWpehgGpZ9tjRETrHv4wDhMvpNjs05E" },
  { id: 3, title: "Gerenciando Pagamentos", level: "Iniciante", levelIcon: "school", category: "Financeiro", duration: "03:15", thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuBlnVR6Q_znO6iRP-mdfrQ9P8ZbdDZreVpVYa8I1acT_dy3noJnVpJQiYk17yRVCTAPVNXT5fWcfkSvwANuH6PvP_icVEY8Pze3Vo2waSKCnMUzXTJJ1hI82Nd-dsOAC33Rg6TL4Mrm3RthoVdRQB_3Hiklyoc1c_Qe8K2gIpHze41mUxlkvjgChU8li0goCh5RciVAX8XPSIaDF5QAPCS3PCbH3c8hFc3fAQXgFwL1XYQS9V_GGS5pJT8ete0-7a_gtUuKE9ks5P8" },
  { id: 4, title: "Integrações Básicas", level: "Iniciante", levelIcon: "school", category: "API", duration: "06:30", thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuDzMFjKol03rFU95Z1zWc9im7nWLbZKUIHAxhMPu7wmJG7dPa2iuphHmcfCRt7mwVyMCesLvrt6k62yAdoDEamhTugQKqupgnsgHat6PN8pYBQPKzBWT-3HZIRjqZDcLeSsPce3_dOJjuG3YpoIpZS2YPSDipCqEZrGw-kzW7R1mEwGq1-c2eytOBvYsTKp2EpOXRA-kEczyzKuGCss1A1fxQ9dwcbnQYdhZZM8qqzUiSLYY9pm4vCNlug-1sIyV4aWUFjlUa7QN7k" },
];

const advancedTutorials: Tutorial[] = [
  { id: 5, title: "Análise de Dados Complexa", level: "Avançado", levelIcon: "bolt", category: "Analytics", duration: "15:20", thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuDtrt7XnH8HeL5Ff4v5-OMUSGVIigoEJ91k-mgCxP-LMGBrfcOGc4oqPw4MjtoWwYy2tB13zz72zCURWQdfwRXxL19OrJASSBSyjvFwV5jS5v8RP25V7QVxmmO8-jt5ApcgdwimglZfFieolnA8R6NMmWJ1xwWoBEQ_koW_cUFqR8CmxG1vCAxl5UTbRv_NdcrsHQKFz4yk8l_S--RzGfbcjMasYTwUuwTI6DlLaCKssaG-j-w23FONkn0i3j7MZ26jAjC464c4TZE", isPremium: true },
  { id: 6, title: "Automação de Marketing", level: "Avançado", levelIcon: "bolt", category: "Marketing", duration: "12:10", thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuAAutJXvlHk3XC9L5J0dYsbQcX-VpZByVD3IDeC2C4_QRNRiP_2ibSlddPhFzwYp5CmWyWcxjUtlGsXqUxjywe7B4MF1VeInO18Od2QdCuV5wpZ7itmD5_wZzdCpLuLbd6C8YJdiKO_dkTw1mbuGafFM8cdFxpeWcYTZ2d7TuQLX6Idt5LkFSXVujx4Ch8sFyW8FbPovy9LofXE7oeju87A8Azn8L3fBQSehzFFtwnjtPNpkD6M1ipgtzaDjiHXDyaB5NqnJMBe2lE", isPremium: true },
  { id: 7, title: "Estratégias de Retenção", level: "Avançado", levelIcon: "bolt", category: "Negócios", duration: "22:00", thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuC92-HRqAjGB_7CkQex95LUZRFWz9tDw7HG_Fsl9mc1gancba8_LaCjBVt2aZ1rjkkxrw1ZoDj5vGbZ1SoyRxUnd8grgcJpHk5gi8hM9-0d9cu87vlJWqlW2ZR4hcnK8GgeUl-HD92uQ0UNptyBo7t5-bG2HrHovmF7mwhGPqLkb8wwDTcz4Tm8Wk3sqvX7RhVptr7QsnWZEsuf3Q7BjYD89xhxmAM_qqGccehSxgwMeF9hOn0obKXKLslSfa9PTFqw9-9fL3lLO94", isPremium: true },
];

const supportTutorials: Tutorial[] = [
  { id: 8, title: "Recuperar Senha", level: "Suporte", levelIcon: "build", category: "Acesso", duration: "02:45", thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuCirXGqh0yyrEUaTHdESUPANmBKfSjeV30zslOiKOR06-8MtgLuclWovfmzd9SrV77tiUO6pEEemSFfdvhSXqkVWNhmbW3WQfQ6GiNGDsMW-6KVxyH7AdItsKrBYfX98hP6I3xKbA6hqdYUtQrwF-IIuYa9gWVfaCiT1euMIJuNhk31cHTMQOL2UQgY3CKtdz1BxwDE3SSh9e6iAVUTo074fAWEpF0ZbMVGew93qlSZbGmedXRNH39xLhMeN02MUTu-xqOetnBuI30" },
  { id: 9, title: "Erro de Pagamento", level: "Suporte", levelIcon: "build", category: "Financeiro", duration: "05:00", thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuB_IWbqC2DDWw0bNs2KoiRs9iwF3CHwyQuMn1osjo-Ok4Tb1gqmF1_qaaSOfFOMTER33Rt9O7ks5oRfLri41Fj3KPeJk716IcNfFxtjjeSaW-dz1fCSUO4CDm4ijIerasFLaJuh1s3TPeDakJ-AlEZq6sU1DfLocy0RlxHuqy54b6ob-tyBbejbiuHljcOFo7LdlxDq9W2_jPPqKel8qN7BiWgOc5HnbhmKE2SSAnJaVvTcjMl7QccyHFpt-3QgDnN-ogEkRDoA_ys" },
];

interface TutorialCardProps {
  tutorial: Tutorial;
  hoverColorClass?: string;
}

const TutorialCard = ({ tutorial, hoverColorClass = "group-hover:text-primary" }: TutorialCardProps) => (
  <div className="min-w-[280px] md:min-w-[320px] relative group cursor-pointer transition-transform duration-300 hover:scale-105 hover:z-10">
    <div className="aspect-video rounded-lg overflow-hidden bg-background relative shadow-lg">
      <img
        alt={tutorial.title}
        className="w-full h-full object-cover"
        src={tutorial.thumbnail}
      />
      {/* Premium badge */}
      {tutorial.isPremium && (
        <div className="absolute top-2 left-2 bg-gradient-to-r from-yellow-400 to-yellow-600 text-black text-[10px] font-bold px-2 py-0.5 rounded shadow">
          PREMIUM
        </div>
      )}
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform scale-50 group-hover:scale-100">
          <span className="material-symbols-outlined text-white">play_arrow</span>
        </div>
      </div>
      {/* Duration */}
      <div className="absolute bottom-2 right-2 bg-foreground/80 px-1.5 py-0.5 rounded text-[10px] font-bold text-background">
        {tutorial.duration}
      </div>
    </div>
    <div className="mt-3">
      <h3 className={`text-base font-semibold text-foreground transition-colors ${hoverColorClass}`}>
        {tutorial.title}
      </h3>
      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className={`material-symbols-outlined text-[14px] ${tutorial.levelIcon === "bolt" ? "text-yellow-500" : ""}`}>
            {tutorial.levelIcon}
          </span>
          {tutorial.level}
        </span>
        <span>•</span>
        <span>{tutorial.category}</span>
      </div>
    </div>
  </div>
);

interface TutorialSectionProps {
  title: string;
  accentColor: string;
  tutorials: Tutorial[];
  hoverColorClass?: string;
}

const TutorialSection = ({ title, accentColor, tutorials, hoverColorClass }: TutorialSectionProps) => (
  <div className="space-y-4">
    <h2 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
      <span className={`w-1 h-6 rounded-full ${accentColor}`}></span>
      {title}
    </h2>
    <div className="flex overflow-x-auto hide-scrollbar pb-8 pt-2 gap-4 pr-8">
      {tutorials.map((tutorial) => (
        <TutorialCard key={tutorial.id} tutorial={tutorial} hoverColorClass={hoverColorClass} />
      ))}
    </div>
  </div>
);

export default function Tutorials() {
  return (
    <div className="animate-fade-in -mx-4 sm:-mx-6 lg:-mx-8 -mt-8">
      {/* Hero Section */}
      <section className="relative w-full h-[65vh] md:h-[75vh] flex items-center">
        <div className="absolute inset-0 w-full h-full">
          <img
            alt="Hero background"
            className="w-full h-full object-cover"
            src={heroData.heroImage}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent"></div>
        </div>

        <div className="relative max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 w-full z-10">
          <div className="max-w-2xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 backdrop-blur-sm border border-primary/30 text-primary mb-6">
              <span className="material-symbols-outlined text-sm">star</span>
              <span className="text-xs font-bold uppercase tracking-wider">{heroData.badge}</span>
            </div>

            {/* Title */}
            <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-4 leading-tight">
              {heroData.title} <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-700">
                {heroData.titleHighlight}
              </span>
            </h1>

            {/* Description */}
            <p className="text-lg text-muted-foreground mb-8 max-w-lg leading-relaxed">
              {heroData.description}
            </p>

            {/* Buttons */}
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3.5 rounded font-bold transition-transform transform hover:scale-105 shadow-glow">
                <span className="material-symbols-outlined">play_arrow</span>
                Assistir Agora
              </button>
              <button className="flex items-center gap-2 bg-secondary hover:bg-secondary/80 backdrop-blur-md text-foreground px-8 py-3.5 rounded font-semibold transition-colors border border-border">
                <span className="material-symbols-outlined">info</span>
                Mais Detalhes
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Tutorial Sections */}
      <div className="relative z-20 -mt-20 md:-mt-32 space-y-12 pl-4 sm:pl-6 lg:pl-8 overflow-hidden">
        <TutorialSection
          title="Comece Por Aqui"
          accentColor="bg-primary"
          tutorials={beginnerTutorials}
          hoverColorClass="group-hover:text-primary"
        />

        <TutorialSection
          title="Dicas Avançadas"
          accentColor="bg-danger"
          tutorials={advancedTutorials}
          hoverColorClass="group-hover:text-danger"
        />

        <TutorialSection
          title="Resolvendo Problemas"
          accentColor="bg-gray-500"
          tutorials={supportTutorials}
          hoverColorClass="group-hover:text-gray-400"
        />
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8 mt-12 px-4">
        <div className="max-w-[1600px] mx-auto text-center">
          <p className="text-muted-foreground text-sm">© 2023 FBFLIX 2.0. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
