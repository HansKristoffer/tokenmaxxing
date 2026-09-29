// The one local page: pick a name, and the app signs you up and opens the world.
const form = document.getElementById("sign-up");
const name = document.getElementById("name");
const error = document.getElementById("error");
const go = document.getElementById("go");

const MESSAGES = {
  name_taken: "That name is taken.",
  invalid_name: "Use 2–32 characters: a–z, 0–9, dot, dash or underscore.",
  rate_limited: "Too many sign-ups right now. Try again in a few minutes.",
  offline: "Can't reach the server.",
};

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  error.textContent = "";
  go.disabled = true;
  try {
    await window.__TAURI__.core.invoke("sign_up", { name: name.value.trim() });
  } catch (code) {
    error.textContent = MESSAGES[code] ?? "Something went wrong.";
    go.disabled = false;
  }
});

name.focus();
