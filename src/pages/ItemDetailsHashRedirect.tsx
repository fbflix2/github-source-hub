import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Compat: URLs antigas estavam indo como /item-details/#ORD-.../1
 * O navegador transforma tudo após "#" em hash (não faz parte do pathname),
 * então a rota não bate e caía no 404.
 *
 * Esta página captura /item-details e redireciona para
 * /item-details/%23ORD-.../1
 */
export default function ItemDetailsHashRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const raw = location.hash?.startsWith("#") ? location.hash.slice(1) : "";
    if (!raw) {
      navigate("/orders", { replace: true });
      return;
    }

    // Ex.: "ORD-2023-882/1" ou "ORD-2023-882"
    const [orderIdPart, itemIdPart] = raw.split("/");
    const orderId = `#${decodeURIComponent(orderIdPart || "")}`;
    const itemId = decodeURIComponent(itemIdPart || "1");

    navigate(`/item-details/${encodeURIComponent(orderId)}/${encodeURIComponent(itemId)}`, { replace: true });
  }, [location.hash, navigate]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="flex items-center gap-2 text-text-secondary">
        <div className="w-6 h-6 rounded-full border-2 border-border border-t-primary animate-spin" />
        <span>Carregando detalhes…</span>
      </div>
    </div>
  );
}
