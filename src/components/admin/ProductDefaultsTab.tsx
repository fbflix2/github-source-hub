import { useState, useEffect } from "react";
import { Plus, Trash2, SquarePen, Save, Loader2, PackageOpen, X, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ProductDefault {
  id: string;
  name: string;
  tags: string[];
  created_at: string;
}

interface ProductDefaultsTabProps {
  searchTerm: string;
}

export default function ProductDefaultsTab({ searchTerm }: ProductDefaultsTabProps) {
  const [items, setItems] = useState<ProductDefault[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductDefault | null>(null);
  const [formName, setFormName] = useState("");
  const [formTags, setFormTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("product_defaults")
      .select("*")
      .order("name");
    if (data) setItems(data as ProductDefault[]);
    if (error) toast.error("Erro ao carregar padrões de produto");
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setFormName("");
    setFormTags([]);
    setTagInput("");
    setModalOpen(true);
  };

  const openEdit = (item: ProductDefault) => {
    setEditing(item);
    setFormName(item.name);
    setFormTags([...item.tags]);
    setTagInput("");
    setModalOpen(true);
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag) return;
    if (formTags.includes(tag)) {
      toast.error("Tag já adicionada");
      return;
    }
    setFormTags((prev) => [...prev, tag]);
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setFormTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error("Nome do produto é obrigatório");
      return;
    }
    setSaving(true);

    if (editing) {
      const { error } = await supabase
        .from("product_defaults")
        .update({ name: formName.trim(), tags: formTags } as any)
        .eq("id", editing.id);
      if (error) toast.error("Erro ao atualizar");
      else toast.success("Padrão atualizado!");
    } else {
      const { error } = await supabase
        .from("product_defaults")
        .insert({ name: formName.trim(), tags: formTags } as any);
      if (error) toast.error("Erro ao criar");
      else toast.success("Padrão criado!");
    }
    setSaving(false);
    setModalOpen(false);
    fetchItems();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("product_defaults").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else {
      toast.success("Padrão removido!");
      fetchItems();
    }
  };

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <>
      <section className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <PackageOpen className="w-5 h-5 text-primary" />
            Padrões de Produtos
          </h2>
          <Button
            onClick={openCreate}
            className="bg-primary hover:bg-red-700 text-white font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            Novo Padrão
          </Button>
        </div>
        <p className="text-gray-500 text-sm mb-6">
          Crie nomes padrão de produtos com tags pré-definidas. Na blocagem, ao selecionar um padrão, as tags serão vinculadas automaticamente.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <PackageOpen className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Nenhum padrão de produto cadastrado.</p>
            <p className="text-gray-500 text-xs mt-1">Crie padrões para agilizar a blocagem.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="group relative p-5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-white text-sm">{item.name}</h3>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(item)}
                      className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                    >
                      <SquarePen className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {item.tags.length === 0 ? (
                    <span className="text-xs text-gray-600">Sem tags</span>
                  ) : (
                    item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary text-xs font-medium"
                      >
                        <Tag className="w-3 h-3" />
                        {tag}
                      </span>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Padrão" : "Novo Padrão de Produto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Nome do Produto</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Perfil BR Marketplace"
                className="bg-black/30 border-white/10 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Tags</label>
              <div className="flex gap-2 mb-3">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Digite uma tag e pressione Enter"
                  className="bg-black/30 border-white/10 focus:border-primary flex-1"
                />
                <Button
                  type="button"
                  onClick={addTag}
                  variant="outline"
                  className="border-white/10 text-gray-300 hover:bg-white/5 px-3"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 min-h-[32px]">
                {formTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-medium"
                  >
                    {tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-red-400 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {formTags.length === 0 && (
                  <span className="text-xs text-gray-600">Nenhuma tag adicionada</span>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} className="border-white/10 text-gray-300 hover:bg-white/5">
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-red-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
