// Renders the Apps / Games grids, with search filtering and user-added shortcuts.
(() => {
  const kind = document.body.dataset.kind; // "apps" | "games"
  const key = "custom_" + kind;
  const grid = document.getElementById("grid");
  const filter = document.getElementById("filter");
  const modal = document.getElementById("modal");

  const custom = () => GM.Settings.get(key) || [];
  const all = () => [...custom().map((x) => ({ ...x, custom: true })), ...GM_CATALOG[kind]];

  function render() {
    const q = filter.value.trim().toLowerCase();
    const items = all().filter((i) => !q || i.name.toLowerCase().includes(q) || (i.desc || "").toLowerCase().includes(q));
    if (!items.length) {
      grid.innerHTML = `<div class="empty">Nothing matches "${GM.escapeHtml(q)}". Press Enter to search the web for it.</div>`;
      return;
    }
    grid.innerHTML = items
      .map((i) => `
        <div class="tile" role="button" tabindex="0" data-url="${GM.escapeHtml(i.url)}">
          ${i.custom ? `<button class="remove" title="Remove" data-remove="${GM.escapeHtml(i.url)}">✕</button>` : ""}
          <div class="icon" style="background:${GM.colorFor(i.name)}">${GM.escapeHtml(i.name.slice(0, 1).toUpperCase())}</div>
          <div><div class="name">${GM.escapeHtml(i.name)}</div><div class="desc">${GM.escapeHtml(i.desc || new URL(i.url).hostname)}</div></div>
        </div>`)
      .join("");
  }

  grid.addEventListener("click", (e) => {
    const rm = e.target.closest("[data-remove]");
    if (rm) {
      e.stopPropagation();
      GM.Settings.set(key, custom().filter((c) => c.url !== rm.dataset.remove));
      render();
      GM.toast("Removed");
      return;
    }
    const tile = e.target.closest(".tile");
    if (tile) location.href = "/browse?url=" + encodeURIComponent(tile.dataset.url);
  });
  grid.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.classList.contains("tile")) e.target.click();
  });

  filter.addEventListener("input", render);
  filter.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && filter.value.trim()) {
      const first = grid.querySelector(".tile");
      if (first) first.click();
      else GM.go(filter.value);
    }
  });

  // add-shortcut modal
  document.getElementById("add").onclick = () => {
    modal.classList.add("open");
    document.getElementById("m-name").focus();
  };
  document.getElementById("m-cancel").onclick = () => modal.classList.remove("open");
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("open"); });
  document.getElementById("m-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("m-name").value.trim();
    let url = document.getElementById("m-url").value.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    try { new URL(url); } catch { return GM.toast("That URL isn't valid"); }
    if (!name) return GM.toast("Give it a name");
    GM.Settings.set(key, [{ name, url, desc: document.getElementById("m-desc").value.trim() }, ...custom()]);
    e.target.reset();
    modal.classList.remove("open");
    render();
    GM.toast("Added " + name);
  });

  render();
})();
