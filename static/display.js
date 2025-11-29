const joinUrl = `${window.location.origin}/join`;
const joinUrlEl = document.getElementById("join-url");
const qrContainer = document.getElementById("qr-code");
const deathPanel = document.getElementById("death-panel");
const deathName = document.getElementById("death-name");
const glitchOverlay = document.getElementById("glitch-overlay");
const scanLines = document.getElementById("scan-lines");
const glitchText = document.getElementById("glitch-text");
const heroCopy = document.getElementById("hero-copy");
const posterBody = document.getElementById("poster-body");
const resetBtn = document.getElementById("reset-hotspot");
let lastName = null;
let ws;

joinUrlEl.textContent = joinUrl;

// Render QR
new QRCode(qrContainer, {
  text: joinUrl,
  width: 220,
  height: 220,
  colorDark: "#2b1b16",
  colorLight: "#f8f1e6",
  correctLevel: QRCode.CorrectLevel.H,
});

function setWaiting() {
  deathPanel.classList.add("hidden");
  heroCopy.innerHTML = `Scan the code to seek protection.<br/>Only one shield exists.`;
  posterBody.classList.remove("hidden");
  lastName = null;
}

function revealName(name) {
  deathName.textContent = name;
  deathPanel.classList.remove("hidden");
  heroCopy.textContent = "Communication interrupted by the Traitors.";
  posterBody.classList.add("hidden");
  lastName = name;
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

function handleClaim(name) {
  if (lastName === name) return;
  playGlitch("COMMUNICATION INTERRUPTED", () => revealName(name));
}

function handleReset() {
  setWaiting();
  playGlitch("SYSTEM RESET", null);
}

function initSocket() {
  const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${wsProtocol}://${window.location.host}/ws/display`);

  ws.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "status") {
        if (data.name && data.name !== lastName) {
          handleClaim(data.name);
        }
      }
      if (data.type === "claimed") {
        handleClaim(data.name);
      }
      if (data.type === "reset") {
        handleReset();
      }
    } catch (err) {
      console.error("Bad message", err);
    }
  });

  ws.addEventListener("close", () => {
    setTimeout(initSocket, 1500);
  });
}

setWaiting();
initSocket();

async function pollStatus() {
  try {
    const res = await fetch("/status", { cache: "no-cache" });
    const data = await res.json();
    if (data.name && data.name !== lastName) {
      handleClaim(data.name);
    } else if (!data.name && lastName) {
      handleReset();
    }
  } catch (err) {
    // ignore poll errors
  }
}

setInterval(pollStatus, 2000);

resetBtn?.addEventListener("click", async () => {
  try {
    resetBtn.disabled = true;
    await fetch("/reset", { method: "POST" });
    handleReset();
  } catch (err) {
    // ignore errors
  } finally {
    setTimeout(() => {
      resetBtn.disabled = false;
    }, 500);
  }
});
