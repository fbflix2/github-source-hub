import { Navigate } from "react-router-dom";

export default function AdminConfigEsteiras() {
  return <Navigate to="/admin/esteira-admin?tab=configuracoes" replace />;
}
