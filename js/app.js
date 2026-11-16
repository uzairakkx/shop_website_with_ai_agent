(() => {
  const $ = (id) => document.getElementById(id);
  const chat = $("chatWindow"), fab = $("chatFab"), msgs = $("chatMsgs"),
        input = $("chatInput"), sendBtn = $("chatSend"), typing = $("typing");
  const ENDPOINT = "/.netlify/functions/chat";
  const store = {
    get: (k) => { try { return sessionStorage.getItem(k) || ""; } catch { return ""; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} }
  };

  let conversationId = store.get("conversation_id");
  let userId = store.get("user_id");
  if (!userId) {
    userId = "web-" + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2));
    store.set("user_id", userId);
  }
  let busy = false;

  function addMsg(text, type) {
    const el = document.createElement("div");
    el.className = "msg msg--" + type;
    el.textContent = text;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function openChat() {
    chat.hidden = false;
    chat.classList.add("open");
    fab.setAttribute("aria-expanded", "true");
    if (!msgs.children.length) addMsg("Hello! I'm the Ahmad Uzair Shop assistant. Ask me about products, prices, delivery or your order.", "bot");
    input.focus();
  }
  function closeChat() {
    chat.hidden = true;
    chat.classList.remove("open");
    fab.setAttribute("aria-expanded", "false");
  }

  async function send(text) {
    const query = text.trim();
    if (!query || busy) return;
    busy = true; sendBtn.disabled = true;
    addMsg(query, "user");
    input.value = "";
    typing.hidden = false;
    msgs.scrollTop = msgs.scrollHeight;
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, conversation_id: conversationId, user_id: userId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      if (data.conversation_id) { conversationId = data.conversation_id; store.set("conversation_id", conversationId); }
      addMsg(data.answer || "Sorry, I could not find an answer. Please rephrase your question.", "bot");
    } catch (err) {
      addMsg(err.message || "Could not reach the assistant. Check your connection and try again.", "error");
    } finally {
      typing.hidden = true; busy = false; sendBtn.disabled = false; input.focus();
    }
  }

  fab.addEventListener("click", () => (chat.hidden ? openChat() : closeChat()));
  $("chatClose").addEventListener("click", closeChat);
  document.querySelectorAll("[data-open-chat]").forEach((b) => b.addEventListener("click", openChat));
  document.querySelectorAll("[data-product]").forEach((b) =>
    b.addEventListener("click", () => {
      openChat();
      input.value = `Tell me more about the ${b.dataset.product}: is it in stock, and how long does delivery take?`;
      input.focus();
    })
  );
  sendBtn.addEventListener("click", () => send(input.value));
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input.value); } });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !chat.hidden) closeChat(); });

  // Mobile menu + footer year
  const toggle = $("navToggle"), links = $("navLinks");
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  links.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => { links.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); }));
  $("year").textContent = new Date().getFullYear();
})();
