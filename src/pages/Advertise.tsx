interface AdPosition {
  id: number;
  name: string;
  description: string;
  price: number;
  icon: string;
  thumbnail: string;
}

interface UserAd {
  id: number;
  name: string;
  url: string;
  position: string;
  status: "active" | "finished";
  date: string;
  iconBg: string;
  icon: string;
}

const adPositions: AdPosition[] = [
  {
    id: 1,
    name: "Banner principal",
    description: "Exibido no topo da página inicial com máxima visibilidade para todos os usuários.",
    price: 300,
    icon: "home",
    thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuDiFDEWh1Iy2gk2vMZmFUskkMPqSIqiEbIV5FeBhvcb6OHa-E8-XlYLkPhv8AaYqTgedSJW-NlQkPFeeSbSnvSw70t4iBmRshbE1qqVSF-B7IHo7BXnMwe_sslxKMTY4hYeDFVmHSEFqhG_B8Kcnr-Hq-7VkxDBNdQ-dOPhsujgC6tp1mZF0Pvx5_I5VO1Bj-w__oC4gEwrNCE8fC47tqYZmz-ZwyVD9liIORA_7jYoJamXWtaYvzQ37pXrr25aM_TiQSITmz4bAv0",
  },
  {
    id: 2,
    name: "Página de checkout",
    description: "Exibido antes do botão de finalizar compra, alta taxa de conversão.",
    price: 250,
    icon: "credit_card",
    thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuAW-i7P4C6ReYAYym6_iMCSLLXc1iFq8qHMLof4rSmy-P7weoHeS-C_3Fuk6FOA6HWhqlUIqEzwqBx2NLRCqqRSxL2f4OoaqkQacfU65c1qI9cXWqgsUxlcAAlI6novJCn55UvCswWSFiL2lNH6r-dYULlvSAQMM4bPg0UF33CuchAQFUpxdUEjqad6vh2_XBMjA8Cr5uX-papFKhssKyEwvetu5ZFaNg1sz-fMxbNSzcnDg9zsB8Eq57ACztX5ChQrGENeIsNc6DI",
  },
  {
    id: 3,
    name: "Pop-up",
    description: "Exibido quando o usuário entra na plataforma, impossível de ignorar.",
    price: 200,
    icon: "info",
    thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuDxxUnAEQ5fa2Kh0jJuIWToo0iWBH2PcC3kdhwD4AogwVXr-fE2VZTxFROu0_A2P6jAkK8VCaIZ62Z9v7qJbN9_-DA-b4a-79LFSRo8amq2u2wxqipC5h2kUMpMGEt7yYGEMh41-QD3euRR6PXmqptHorqP9XBCcQyK9HiQmutKx72fXaXc1fQ7saOV9t49LVgpnZtHCZWhTomfJTVSjNccuNL5eKiZHvvPFRbgJ798qWcBL5ZG4rHJxq3Q2luCgJIIUYm2GUABlWQ",
  },
  {
    id: 4,
    name: "Entre produtos",
    description: "Exibido na listagem de produtos da página inicial, integração natural.",
    price: 150,
    icon: "inbox",
    thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuCYgJCmOb5oOkAnZnRkrPRfiiDqqAbmtQa5hxiJd43Z8717eMwkjlX_kjvuSpMou_DOm_3n6zpi-WuAXWZkGI6VGh9ZwTlRCVk31lIWCwHoLux071qrEkOMYWl4Yk7gJhFd5qw5M6XRsDGIEq0yORCb0KUN741RtrymB0aRXrQfXiliB0VF8axKV_pB8vN7ipzuCFnn_8tCRgMZgBCtBgiFDksoTvvBU_s1BmiSIwFTl9FZ1P-ZuIhgjJ9oLZgeeslGMcclIk0ejyc",
  },
  {
    id: 5,
    name: "Página dedicada",
    description: "Exibido na página de anúncios especiais, ideal para conteúdo detalhado.",
    price: 100,
    icon: "article",
    thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuBC3qUeAvLOo9SRKBpUHFb4xhTymhvj5UouWJZ2lLizk7JM7UrdVBeGZiI38lb3U1McVr_n7sF2cQ_CIXDh2FrTonKqHarUcpx62tFDO4UYSbt5YKRUR-Gw-kIY_nybKDDjwWInAbjTwSiiw8aknrUPtxjLOP1QPFrtuzeaeWJnYXFZOWCrEHLaScn6JTyv_Uq0sNEjQqR3blDqsdUIRA0Ppczo9_kTBN0wcI8DbKa6XLd7QzGcDlqL-scgUo2KERzjThELjnanPUk",
  },
];

const userAds: UserAd[] = [
  {
    id: 1,
    name: "Promoção de Verão",
    url: "https://exemplo.com/promo",
    position: "Banner principal",
    status: "active",
    date: "2023-10-15",
    iconBg: "bg-gradient-to-br from-indigo-500 to-purple-600",
    icon: "campaign",
  },
  {
    id: 2,
    name: "Black Friday 2022",
    url: "https://exemplo.com/black",
    position: "Entre produtos",
    status: "finished",
    date: "2022-11-25",
    iconBg: "bg-gradient-to-br from-gray-500 to-gray-600",
    icon: "history",
  },
];

export default function Advertise() {
  const balance = 1450.0;

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Alert Banner */}
      <div className="w-full bg-gradient-to-r from-orange-600 to-danger rounded-lg p-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3 text-danger-foreground">
          <span className="material-symbols-outlined">local_fire_department</span>
          <span className="font-medium text-sm sm:text-base">
            Espaço limitado! Reserve seu anúncio agora e alcance mais de 4 mil clientes ativos.
          </span>
        </div>
        <button className="hidden sm:block bg-background text-danger text-xs font-bold px-3 py-1.5 rounded hover:bg-muted transition-colors">
          Premium
        </button>
      </div>

      {/* Page Header */}
      <div className="text-center space-y-3 max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">Anuncie em nosso site</h1>
        <p className="text-text-secondary text-lg">
          Promova seu negócio dentro da plataforma usando o saldo disponível. Escolha onde quer aparecer para ganhar mais visibilidade.
        </p>
      </div>

      {/* Balance Card */}
      <div className="glass-card rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="text-sm text-text-secondary mb-1">Seu saldo disponível</p>
          <div className="text-3xl font-bold text-foreground tracking-tight">
            R$ {balance.toFixed(2).replace(".", ",")}
          </div>
        </div>
        <button className="bg-danger hover:bg-red-600 text-danger-foreground font-medium py-2.5 px-6 rounded-lg transition-all shadow-[0_4px_14px_0_rgba(255,59,48,0.39)] hover:shadow-[0_6px_20px_rgba(255,59,48,0.23)] hover:-translate-y-0.5 flex items-center gap-2">
          <span className="material-symbols-outlined text-xl">add_circle</span>
          Adicionar saldo
        </button>
      </div>

      {/* Ad Positions */}
      <section>
        <div className="flex items-center gap-2 mb-6">
          <h2 className="text-xl font-bold text-foreground">Escolha onde seu anúncio vai aparecer</h2>
          <span className="material-symbols-outlined text-text-secondary text-sm cursor-help" title="Saiba mais sobre os posicionamentos">
            info
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {adPositions.map((position) => (
            <div
              key={position.id}
              className="glass-card rounded-xl overflow-hidden group hover:border-primary/20 transition-all duration-300 flex flex-col"
            >
              {/* Thumbnail */}
              <div className="h-32 bg-background relative overflow-hidden">
                <img
                  alt={position.name}
                  className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-500"
                  src={position.thumbnail}
                />
                <div className="absolute bottom-0 left-0 w-full p-3 bg-gradient-to-t from-black/80 to-transparent">
                  <span className="text-white font-bold text-sm">{position.name}</span>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 flex flex-col flex-grow">
                <div className="flex justify-between items-center mb-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <span className="material-symbols-outlined text-muted-foreground text-sm">{position.icon}</span>
                  </div>
                  <span className="text-danger font-bold">R$ {position.price}</span>
                </div>
                <p className="text-xs text-text-secondary mb-4 flex-grow leading-relaxed">
                  {position.description}
                </p>
                <button className="w-full bg-danger hover:bg-red-600 text-danger-foreground text-sm font-medium py-2 rounded transition-colors">
                  Selecionar
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* User Ads Table */}
      <section className="pb-12">
        <h2 className="text-xl font-bold text-foreground mb-6">Seus anúncios</h2>
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="p-4 text-xs font-semibold uppercase tracking-wide text-text-secondary">Nome</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wide text-text-secondary">Posição</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wide text-text-secondary text-center">Status</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wide text-text-secondary">Data</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wide text-text-secondary text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {userAds.map((ad) => (
                  <tr
                    key={ad.id}
                    className={`hover:bg-muted transition-colors ${ad.status === "finished" ? "opacity-75" : ""}`}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded flex items-center justify-center text-white shadow-md ${ad.iconBg}`}>
                          <span className="material-symbols-outlined text-sm">{ad.icon}</span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-foreground">{ad.name}</div>
                          <div className="text-xs text-text-secondary">{ad.url}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{ad.position}</td>
                    <td className="p-4 text-center">
                      {ad.status === "active" ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary">
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-text-secondary">
                          Finalizado
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-sm text-text-secondary">{ad.date}</td>
                    <td className="p-4 text-right">
                      {ad.status === "active" ? (
                        <button className="text-sm text-danger hover:text-red-400 font-medium transition-colors">
                          Editar
                        </button>
                      ) : (
                        <button className="text-sm text-text-secondary hover:text-foreground font-medium transition-colors">
                          Detalhes
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
