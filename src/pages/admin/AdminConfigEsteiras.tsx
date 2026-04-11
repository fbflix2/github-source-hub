import AdminEsteiraAdmin from "./AdminEsteiraAdmin";

export default function AdminConfigEsteiras() {
  // Renders the Esteira Admin page with the "configuracoes" tab pre-selected via URL param
  // The actual component reads ?tab=configuracoes from searchParams
  return <AdminEsteiraAdmin />;
}
