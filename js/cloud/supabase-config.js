// @ts-check
/**
 * supabase-config.js — Credenziali del TUO progetto Supabase.
 * =====================================================================
 * Vuoto di default: senza queste due righe compilate, js/cloud/cloud-sync.js
 * si disattiva da solo (window.CloudSync.available === false) e il gioco
 * resta interamente giocabile offline come sempre — la sincronizzazione
 * cloud è un'aggiunta OPZIONALE, mai un requisito.
 *
 * Come compilarlo:
 *   1) Crea un progetto su https://supabase.com (gratuito).
 *   2) Esegui UNA VOLTA supabase/schema.sql nell'SQL Editor del progetto
 *      (dashboard → SQL Editor → New query → incolla → Run).
 *   3) Project Settings → API: copia "Project URL" e la chiave
 *      "anon public" (MAI la "service_role", che ha accesso pieno e va
 *      tenuta solo lato server — qui serve solo quella pubblica, pensata
 *      apposta per stare nel codice client insieme alle policy RLS
 *      definite in schema.sql).
 *   4) Incollale qui sotto.
 *
 * Questo file NON contiene segreti sensibili in senso stretto (la chiave
 * "anon" è progettata per essere pubblica), ma se il repository è
 * pubblico e preferisci non pubblicare comunque l'URL del tuo progetto,
 * aggiungi questo file a .gitignore e distribuiscilo separatamente.
 */
window.SUPABASE_CONFIG = {
    url: 'https://yuadnvnkdppgjkagpcwt.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRudm5rZHBwZ2prYWdwY3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0Mjg1NzAsImV4cCI6MjEwMzAwNDU3MH0.q5g3iUoY4QVdNnHPpkrDcwqNVRV0Qq4n6PmX2DCu5b4'
};
