// Paste the Inbound Webhook URL from the GoHighLevel "Hobby Quiz" workflow trigger here.
// Looks like: https://services.leadconnectorhq.com/hooks/XXXX/webhook-trigger/YYYY
// Leave it empty and the quiz still works; sign-ups just aren't sent anywhere.
const GHL_WEBHOOK_URL = "https://services.leadconnectorhq.com/hooks/4QsLYjGwLmkwPq9qWOs2/webhook-trigger/420a7946-1828-45df-af4f-4213a6e46eee";

// Paid product links per hobby type. Leave "" to hide the "When you're ready for more" box.
const PRODUCT_LINKS = { A: "", B: "", C: "", D: "" };

const Q = window.QUIZ;
const LETTERS = ["A", "B", "C", "D"];
const ALL = [...Q.questions.map((x) => ({ ...x, scored: true })), ...Q.extra.map((x) => ({ ...x, scored: false }))];
let step = 0;
const answers = [];

const $ = (id) => document.getElementById(id);
const screens = ["s-start", "s-q", "s-gate", "s-result"];
function show(id, focusEl) {
  screens.forEach((s) => ($(s).hidden = s !== id));
  window.scrollTo(0, 0);
  if (focusEl) $(focusEl).focus();
}

function renderQ() {
  const item = ALL[step];
  const n = Q.questions.length;
  $("bar").style.width = Math.round((step / ALL.length) * 100) + "%";
  $("qCount").textContent = item.scored ? `Question ${step + 1} of ${n}` : `Two quick ones for me · ${step - n + 1} of ${Q.extra.length}`;
  $("qText").textContent = item.q;
  const box = $("qOpts");
  box.innerHTML = "";
  item.opts.forEach((text, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "opt" + (answers[step] === i ? " picked" : "");
    b.textContent = text;
    b.addEventListener("click", () => pick(i, b));
    box.appendChild(b);
  });
  $("backBtn").style.visibility = step === 0 ? "hidden" : "visible";
  show("s-q", "qText");
}

function pick(i, el) {
  answers[step] = i;
  el.classList.add("picked");
  setTimeout(() => {
    step++;
    if (step < ALL.length) renderQ();
    else show("s-gate", "gateTitle");
  }, 180);
}

function score() {
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  Q.questions.forEach((_, i) => { if (answers[i] != null) counts[LETTERS[answers[i]]]++; });
  const max = Math.max(...Object.values(counts));
  const tied = LETTERS.filter((L) => counts[L] === max);
  let top = tied[0];
  if (tied.length > 1) {
    // Break ties with the last question ("What do you want more of this year?"), else prefer Cozy.
    const last = LETTERS[answers[Q.questions.length - 1]];
    top = tied.includes(last) ? last : tied.includes("C") ? "C" : tied[0];
  }
  const second = LETTERS.filter((L) => L !== top).sort((a, b) => counts[b] - counts[a])[0];
  return { counts, top, second: counts[second] >= max - 1 && counts[second] > 0 ? second : null };
}

function spoons(n) { return "🥄".repeat(n) + `<span style="opacity:.3">${"🥄".repeat(5 - n)}</span>`; }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

function renderResult(res) {
  const t = Q.types[res.top];
  const app = $("s-result");
  app.style.setProperty("--c", t.accent);
  app.style.setProperty("--t", t.tint);
  $("rName").textContent = t.name;
  $("rTag").textContent = t.tag;
  $("rBadge").textContent = res.top;
  $("rAbout").innerHTML = t.about.map((p) => `<p>${esc(p)}</p>`).join("");
  $("rStrength").textContent = t.strength;
  $("rWatch").textContent = t.watch;
  if (res.second) {
    $("rAlso").hidden = false;
    $("rAlso").innerHTML = `You're also a little bit <b>${esc(Q.types[res.second].name)}</b>. Your printable guide has their hobbies too.`;
  } else $("rAlso").hidden = true;
  $("rHobbies").innerHTML = Q.hobbies[res.top].map((h) => `
    <div class="hob"><h4>${esc(h.name)}</h4>
      <div class="meta">${spoons(h.spoons)} · ${h.spoons} spoon${h.spoons > 1 ? "s" : ""} · Cost: ${esc(h.cost)}</div>
      <div class="why">${esc(h.why)}</div>
      <div class="two"><div class="free"><b>Try it free</b>${esc(h.free)}</div><div class="bat"><b>2% battery version</b>${esc(h.battery)}</div></div>
    </div>`).join("");
  const link = PRODUCT_LINKS[res.top];
  $("rNext").hidden = !link;
  if (link) { $("rNextName").textContent = t.next.name; $("rNextDesc").textContent = t.next.desc; $("rNextLink").href = link; }
  show("s-result", "rName");
}

$("startBtn").addEventListener("click", () => { step = 0; renderQ(); });
$("backBtn").addEventListener("click", () => { if (step > 0) { step--; renderQ(); } });
$("retakeBtn").addEventListener("click", () => { answers.length = 0; step = 0; show("s-start"); });
$("copyBtn").addEventListener("click", async () => {
  const url = location.href.split("#")[0].split("?")[0];
  try { await navigator.clipboard.writeText(url); $("copyBtn").textContent = "Link copied!"; }
  catch (_) { prompt("Copy this link:", url); }
});

$("gateForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target, err = $("gateErr"), btn = $("gateBtn");
  err.textContent = "";
  const data = new FormData(form);
  if (data.get("company")) return; // honeypot: bots fill hidden fields
  const firstName = (data.get("first_name") || "").trim();
  const email = (data.get("email") || "").trim();
  if (!firstName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    err.textContent = "Please add your first name and a valid email address.";
    return;
  }
  const res = score();
  const t = Q.types[res.top];
  const n = Q.questions.length;
  const params = new URLSearchParams(location.search);
  const payload = {
    first_name: firstName,
    email,
    source: "Hobby Matchmaker Quiz",
    tags: `hobby-quiz, hobby-type-${t.key}`,
    type_tag: `hobby-type-${t.key}`,
    hobby_type: t.name,
    hobby_type_second: res.second ? Q.types[res.second].name : "",
    score_maker: res.counts.A, score_explorer: res.counts.B, score_cozy: res.counts.C, score_social: res.counts.D,
    spoons_per_day: answers[n] != null ? Q.extra[0].opts[answers[n]] : "",
    hobby_budget: answers[n + 1] != null ? Q.extra[1].opts[answers[n + 1]] : "",
    utm_source: params.get("utm_source") || "", utm_medium: params.get("utm_medium") || "", utm_campaign: params.get("utm_campaign") || "",
  };
  btn.disabled = true;
  btn.textContent = "Finding your match…";
  try {
    if (GHL_WEBHOOK_URL) {
      const r = await fetch(GHL_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error("Webhook returned " + r.status);
    } else {
      console.warn("GHL_WEBHOOK_URL is not set; quiz sign-up was not sent.", payload);
    }
    renderResult(res);
  } catch (_) {
    err.textContent = "Something went wrong sending that. Please check your connection and try again.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Show my hobby type";
  }
});
