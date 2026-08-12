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
    if (!name || (taxID.length !== 11 && taxID.length !== 14)) return null;

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
