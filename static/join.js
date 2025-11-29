const form = document.getElementById("shield-form");
const nameInput = document.getElementById("name");
const messageEl = document.getElementById("message");
const paper = document.getElementById("paper");
const paperName = document.getElementById("paper-name");
const paperBody = document.getElementById("paper-body");
const heroHeadline = document.getElementById("hero-headline");
const heroBody = document.getElementById("hero-body");
const glitchOverlay = document.getElementById("glitch-overlay");
const scanLines = document.getElementById("scan-lines");
const glitchText = document.getElementById("glitch-text");

function setMessage(text, tone = "info") {
  messageEl.textContent = text;
  messageEl.dataset.tone = tone;
}

function playGlitch(message, after) {
  glitchText.textContent = message;
  glitchOverlay.classList.add("active");
  scanLines.classList.add("active");
  glitchText.classList.add("active");
  setTimeout(() => {
    glitchOverlay.classList.remove("active");
    scanLines.classList.remove("active");
    glitchText.classList.remove("active");
    if (after) after();
  }, 2000);
}

async function checkStatus() {
  try {
    const res = await fetch("/status");
    const data = await res.json();
    if (data.claimed && data.name) {
      form.classList.add("hidden");
      heroHeadline.textContent = "Too late. The Traitors are watching.";
      heroBody.textContent = `${data.name} has already been claimed.`;
      setMessage("The shield has already been taken.");
    }
  } catch (err) {
    setMessage("Unable to check status. Try again.", "warn");
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!name) {
    setMessage("Please enter a name.");
    return;
  }

  setMessage("Confirming your shield...");
  nameInput.disabled = true;

  try {
    const res = await fetch("/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || "Shield already claimed.");
    }

    playGlitch("COMMUNICATION INTERRUPTED", () => {
      heroHeadline.textContent = "Communication interrupted by the Traitors.";
      heroBody.textContent = "";
      form.classList.add("hidden");
      paperName.textContent = name;
      paperBody.innerHTML = `Dear ${name}<br/>By order of the Traitors you have been murdered<br/>Your eagerness to claim a shield has been your ultimate downfall`;
      paper.classList.remove("hidden");
      setMessage("");
    });
  } catch (err) {
    setMessage(err.message || "Unable to claim the shield.", "warn");
    nameInput.disabled = false;
  }
});

checkStatus();
