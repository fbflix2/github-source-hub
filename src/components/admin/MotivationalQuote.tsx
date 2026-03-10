import { useState, useEffect } from "react";
import { Quote } from "lucide-react";

const quotes = [
  { text: "O sucesso é a soma de pequenos esforços repetidos dia após dia.", author: "Robert Collier" },
  { text: "Não espere por oportunidades extraordinárias. Agarre ocasiões comuns e as torne grandes.", author: "Orison Swett Marden" },
  { text: "O segredo do sucesso é a constância do propósito.", author: "Benjamin Disraeli" },
  { text: "Vendas dependem da atitude do vendedor, não da atitude do cliente.", author: "W. Clement Stone" },
  { text: "Pessoas de sucesso fazem o que pessoas sem sucesso não estão dispostas a fazer.", author: "Jim Rohn" },
  { text: "A persistência é o caminho do êxito.", author: "Charles Chaplin" },
  { text: "Foco é dizer não a centenas de boas ideias.", author: "Steve Jobs" },
  { text: "Cada venda tem cinco obstáculos: não preciso, sem dinheiro, sem pressa, sem desejo e sem confiança.", author: "Zig Ziglar" },
  { text: "Seu trabalho vai preencher grande parte da sua vida. A única forma de ficar satisfeito é fazer o que você acredita ser um ótimo trabalho.", author: "Steve Jobs" },
  { text: "Disciplina é a ponte entre metas e conquistas.", author: "Jim Rohn" },
  { text: "O dinheiro segue a atenção. Onde você coloca foco, os resultados aparecem.", author: "Grant Cardone" },
  { text: "Não é sobre ter tempo, é sobre fazer tempo.", author: "Desconhecido" },
  { text: "O maior risco é não correr nenhum risco.", author: "Mark Zuckerberg" },
  { text: "Aja como se fosse impossível falhar.", author: "Dorothea Brande" },
  { text: "O sucesso geralmente vem para quem está ocupado demais para procurá-lo.", author: "Henry David Thoreau" },
  { text: "A diferença entre uma pessoa de sucesso e as outras não é falta de força, nem falta de conhecimento, mas sim falta de vontade.", author: "Vince Lombardi" },
  { text: "Quanto mais suor no treino, menos sangue na batalha.", author: "Provérbio" },
  { text: "Grandes coisas nunca vêm da zona de conforto.", author: "Desconhecido" },
  { text: "Se você não está disposto a arriscar o comum, terá que se contentar com o ordinário.", author: "Jim Rohn" },
  { text: "Não é a vontade de vencer que importa — todo mundo tem isso. É a vontade de se preparar para vencer que importa.", author: "Paul Bear Bryant" },
];

export default function MotivationalQuote() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * quotes.length));
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIndex(prev => (prev + 1) % quotes.length);
        setFade(true);
      }, 500);
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  const quote = quotes[index];

  return (
    <div className="w-full flex justify-center py-4">
      <div
        className={`flex items-start gap-3 max-w-2xl transition-all duration-500 ${
          fade ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
      >
        <Quote className="size-5 text-primary/40 mt-0.5 shrink-0 rotate-180" />
        <div>
          <p className="text-sm text-muted-foreground italic leading-relaxed">
            {quote.text}
          </p>
          <p className="text-xs text-muted-foreground/50 mt-1.5 font-medium">
            — {quote.author}
          </p>
        </div>
      </div>
    </div>
  );
}
