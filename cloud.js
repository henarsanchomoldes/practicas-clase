import { createClient } from "@supabase/supabase-js";

export class CloudAccount {
  constructor() {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    this.client = url && key ? createClient(url, key) : null;
    this.user = null;
    this.revision = null;
  }
  get configured() { return Boolean(this.client); }
  async session() {
    if (!this.client) return null;
    const { data, error } = await this.client.auth.getSession();
    if (error) throw error;
    this.user = data.session?.user || null;
    return this.user;
  }
  async login(email, password) {
    if (!this.client) throw new Error("Falta configurar la conexión con ALIHEN.");
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw new Error("No se ha podido iniciar sesión. Revisa el email y la contraseña.");
    this.user = data.user;
  }
  async logout() {
    if (this.client) {
      const { error } = await this.client.auth.signOut();
      if (error) throw error;
    }
    this.user = null;
    this.revision = null;
  }
  async load() {
    const { data, error } = await this.client.rpc("alihen_load_account");
    if (error) throw error;
    this.revision = data?.revision ?? null;
    return data?.snapshot ?? null;
  }
  async save(snapshot) {
    if (!this.user) throw new Error("Inicia sesión para guardar en ALIHEN.");
    const { data, error } = await this.client.rpc("alihen_save_account", {
      snapshot, expected_revision: this.revision
    });
    if (error) {
      if (error.message.includes("ALIHEN_CONFLICT")) throw new Error("Los datos cambiaron en otra sesión. Exporta tu copia local antes de recargar para no perder cambios.");
      if (error.code === "23505") throw new Error("Ya existe una factura con ese número y emisor, o el PDF está duplicado.");
      throw new Error("No se pudo guardar en ALIHEN. Conserva una copia local y revisa la conexión.");
    }
    this.revision = data;
  }
  async upload(file, hash) {
    if (!this.user) throw new Error("Inicia sesión para subir el PDF a ALIHEN.");
    const { data: existing, error: queryError } = await this.client.from("alihen_documents").select("id,state,result").eq("sha256", hash).maybeSingle();
    if (queryError) throw queryError;
    if (existing) {
      if (existing.state === "reviewed") throw new Error("Este PDF ya se ha importado.");
      return existing;
    }
    const id = crypto.randomUUID();
    const path = `${this.user.id}/${id}.pdf`;
    const { error: storageError } = await this.client.storage.from("alihen-invoices").upload(path, file, { contentType: "application/pdf", upsert: false });
    if (storageError) throw new Error("No se pudo subir el PDF. Revisa el almacenamiento de ALIHEN.");
    const { data, error } = await this.client.from("alihen_documents").insert({ id, owner_id: this.user.id, storage_path: path, sha256: hash, filename: file.name, state: "pending" }).select().single();
    if (error) {
      await this.client.storage.from("alihen-invoices").remove([path]);
      throw new Error("No se pudo registrar el PDF. Puede que ya exista o falten las tablas de ALIHEN.");
    }
    return data;
  }
  async extract(documentId) {
    const { data, error } = await this.client.functions.invoke("extract-invoice", { body: { documentId } });
    if (error) {
      let detail = "No se ha podido extraer el PDF. Puedes reintentar o rellenar los datos manualmente.";
      try { detail = (await error.context.json()).error || detail; } catch { /* Respuesta sin JSON. */ }
      throw new Error(detail);
    }
    if (data.error) throw new Error(data.error);
    return data;
  }
  async documentUrl(id) {
    const { data, error } = await this.client.from("alihen_documents").select("storage_path").eq("id", id).single();
    if (error) throw new Error("No se encuentra el PDF original.");
    const result = await this.client.storage.from("alihen-invoices").createSignedUrl(data.storage_path, 60);
    if (result.error) throw new Error("No se pudo abrir el PDF original.");
    return result.data.signedUrl;
  }
}
