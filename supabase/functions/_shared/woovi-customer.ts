// Builds the `customer` block required by Woovi/OpenPix to auto-issue NFS-e.
// Returns null when the profile lacks the minimum fiscal data (name + taxID).

export interface WooviCustomer {
  name: string;
  taxID: string;
  email?: string;
  phone?: string;
  address?: {
    zipcode: string;
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    complement?: string;
    country: string;
  };
}

const onlyDigits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

function isValidCPF(cpf: string) {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number(cpf[10]);
}

function isValidCNPJ(cnpj: string) {
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (len: number) => {
    let pos = len - 7;
    let sum = 0;
    for (let i = 0; i < len; i++) {
      sum += Number(cnpj[i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
}

export const isValidTaxID = (v: string) => isValidCPF(v) || isValidCNPJ(v);

export async function buildWooviCustomer(
  admin: { from: (t: string) => any; auth: { admin: { getUserById: (id: string) => Promise<any> } } },
  userId: string,
): Promise<WooviCustomer | null> {
  try {
    const { data: p } = await admin
      .from("profiles")
      .select("full_name, cpf, phone, rua, numero, bairro, cidade, estado, cep, address")
      .eq("user_id", userId)
      .maybeSingle();

    if (!p) return null;

    const name = String(p.full_name ?? "").trim();
    const taxID = onlyDigits(p.cpf);
    if (!name || !isValidTaxID(taxID)) return null;

    let email: string | undefined;
    try {
      const { data: u } = await admin.auth.admin.getUserById(userId);
      email = u?.user?.email || undefined;
    } catch (_) {
      email = undefined;
    }

    const phoneDigits = onlyDigits(p.phone);
    const phone = phoneDigits
      ? phoneDigits.startsWith("55")
        ? `+${phoneDigits}`
        : `+55${phoneDigits}`
      : undefined;

    const customer: WooviCustomer = { name, taxID };
    if (email) customer.email = email;
    if (phone) customer.phone = phone;

    const zipcode = onlyDigits(p.cep);
    const street = String(p.rua || p.address || "").trim();
    const city = String(p.cidade ?? "").trim();
    const state = String(p.estado ?? "").trim().toUpperCase().slice(0, 2);

    if (zipcode.length === 8 && street && city && state) {
      customer.address = {
        zipcode,
        street,
        number: String(p.numero ?? "").trim() || "S/N",
        neighborhood: String(p.bairro ?? "").trim() || "Centro",
        city,
        state,
        country: "BR",
      };
    }

    return customer;
  } catch (e) {
    console.error("[woovi-customer] build failed:", e);
    return null;
  }
}
