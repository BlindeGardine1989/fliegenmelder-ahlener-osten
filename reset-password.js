import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const input = document.querySelector("#newPassword");
const button = document.querySelector("#savePassword");
const status = document.querySelector("#resetStatus");

button?.addEventListener("click", async () => {
  const password = input.value.trim();

  if (password.length < 8) {
    status.textContent = "Das Passwort muss mindestens 8 Zeichen lang sein.";
    return;
  }

  status.textContent = "Passwort wird gespeichert ...";

  const { error } = await supabase.auth.updateUser({
    password
  });

  if (error) {
    console.error(error);
    status.textContent = "Passwort konnte nicht gespeichert werden.";
    return;
  }

  status.textContent = "Passwort wurde gespeichert. Du kannst dich jetzt einloggen.";
});
