// Sync progress to a private GitHub Gist. Shared by every page: add <div id="sync-mount"></div>.
// Token is kept in localStorage under its own key and never leaves for anywhere but api.github.com.
(function () {
  var GIST_FILE = "pokopia-progress.json";
  var GIST_DESC = "Pokopia progress sync";
  var API = "https://api.github.com";
  var K_TOKEN = "pokopia.token";
  var K_GIST = "pokopia.gistId";
  var K_LAST = "pokopia.lastSync"; // updatedAt both sides agreed on at the last sync
  var DELAY = 3000;

  var timer = null;
  var running = false;
  var statusEl, panel, tokenEl, dialog;

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

  function status(text) { if (statusEl) statusEl.textContent = text; }

  function stamp(iso) {
    return iso ? new Date(iso).toLocaleString() : "never changed";
  }

  function gh(path, options) {
    options = options || {};
    var headers = { Authorization: "Bearer " + get(K_TOKEN), Accept: "application/vnd.github+json" };
    if (options.body) headers["Content-Type"] = "application/json";
    return fetch(API + path, {
      method: options.method || "GET",
      body: options.body,
      cache: "no-store", // a stale copy could make us overwrite newer data
      headers: headers
    }).then(function (res) {
      if (res.status === 401) throw new Error("token rejected");
      if (!res.ok) { var e = new Error("GitHub error " + res.status); e.status = res.status; throw e; }
      return res.json();
    });
  }

  function payload(data) {
    return JSON.stringify({ app: "pokopia", data: data });
  }

  function parse(text) {
    var f = JSON.parse(text);
    if (!f || f.app !== "pokopia" || !f.data) throw new Error("not a Pokopia file");
    return PokopiaStorage.migrate(f.data);
  }

  function findGist() {
    var saved = get(K_GIST);
    if (saved) return Promise.resolve({ id: saved, created: false });
    function page(n) {
      return gh("/gists?per_page=100&page=" + n).then(function (gists) {
        var hit = gists.filter(function (g) { return g.files && g.files[GIST_FILE]; })[0];
        if (hit) { set(K_GIST, hit.id); return { id: hit.id, created: false }; }
        if (gists.length === 100 && n < 10) return page(n + 1);
        var files = {};
        files[GIST_FILE] = { content: payload(PokopiaStorage.load()) };
        return gh("/gists", {
          method: "POST",
          body: JSON.stringify({ description: GIST_DESC, public: false, files: files })
        }).then(function (g) { set(K_GIST, g.id); return { id: g.id, created: true }; });
      });
    }
    return page(1);
  }

  function readGist(id) {
    return gh("/gists/" + id).then(function (gist) {
      var file = gist.files && gist.files[GIST_FILE];
      if (!file) return null;
      if (!file.truncated) return parse(file.content);
      return fetch(file.raw_url, { cache: "no-store" }).then(function (r) { return r.text(); }).then(parse);
    });
  }

  function push(id, data) {
    var files = {};
    files[GIST_FILE] = { content: payload(data) };
    return gh("/gists/" + id, { method: "PATCH", body: JSON.stringify({ description: GIST_DESC, files: files }) });
  }

  // Ask which side to keep. Resolves "local", "remote" or null (cancel).
  function choose(local, remote) {
    return new Promise(function (resolve) {
      document.getElementById("sync-local-time").textContent = stamp(local.updatedAt);
      document.getElementById("sync-remote-time").textContent = stamp(remote.updatedAt);
      var done = function (v) { dialog.close(); resolve(v); };
      document.getElementById("sync-keep-local").onclick = function () { done("local"); };
      document.getElementById("sync-keep-remote").onclick = function () { done("remote"); };
      document.getElementById("sync-cancel").onclick = function () { done(null); };
      dialog.oncancel = function () { resolve(null); };
      dialog.showModal();
    });
  }

  function finish(data) {
    set(K_LAST, data.updatedAt || "");
    status("Synced " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }

  function syncNow() {
    clearTimeout(timer);
    timer = null;
    if (!get(K_TOKEN)) { status("Not connected"); return Promise.resolve(); }
    if (running) return Promise.resolve();
    running = true;
    status("Syncing…");
    var gistId;
    return findGist().then(function (g) {
      gistId = g.id;
      return readGist(g.id);
    }).then(function (remote) {
      var local = PokopiaStorage.load();
      var last = get(K_LAST);
      if (!remote) return push(gistId, local).then(function () { finish(local); });
      if (remote.updatedAt === local.updatedAt) return finish(local);
      var hasLast = last !== null;
      var lastStamp = last || null; // "" is stored for "agreed on an empty state"
      var localChanged = (local.updatedAt || null) !== lastStamp;
      var remoteChanged = (remote.updatedAt || null) !== lastStamp;
      if (hasLast && localChanged && !remoteChanged) {
        return push(gistId, local).then(function () { finish(local); });
      }
      // This device has never saved anything (new browser, cleared storage): just take the Gist, nothing to lose.
      if (!local.updatedAt && remote.updatedAt) {
        PokopiaStorage.replace(remote);
        document.dispatchEvent(new Event("pokopia-synced"));
        return finish(remote);
      }
      if (hasLast && remoteChanged && !localChanged) {
        PokopiaStorage.replace(remote);
        document.dispatchEvent(new Event("pokopia-synced"));
        return finish(remote);
      }
      // Both changed (or first connect with different data): I choose.
      return choose(local, remote).then(function (pick) {
        if (pick === "local") return push(gistId, local).then(function () { finish(local); });
        if (pick === "remote") {
          PokopiaStorage.replace(remote);
          document.dispatchEvent(new Event("pokopia-synced"));
          return finish(remote);
        }
        status("Sync cancelled");
      });
    }).catch(function (err) {
      if (err && err.status === 404) del(K_GIST); // gist deleted: look again next time
      status("Sync error: " + (err && err.message));
    }).then(function () { running = false; });
  }

  function schedule() {
    if (!get(K_TOKEN)) return;
    clearTimeout(timer);
    timer = setTimeout(syncNow, DELAY);
  }

  function showConnected() {
    var on = !!get(K_TOKEN);
    panel.classList.toggle("connected", on);
    tokenEl.value = "";
    tokenEl.placeholder = on ? "Connected. Paste a new token to replace" : "GitHub token (gist scope)";
    if (!on) status("Not connected");
  }

  function mount() {
    var host = document.getElementById("sync-mount");
    if (!host) return;
    host.innerHTML =
      '<details id="sync-panel" class="sync">' +
      '<summary><span class="sync-dot"></span><span id="sync-status"></span></summary>' +
      '<div class="sync-body">' +
      '<div class="sync-row"><input id="gist-token" type="password" autocomplete="off" aria-label="GitHub token">' +
      '<button type="button" id="gist-save">Connect</button></div>' +
      '<div class="sync-row"><button type="button" id="sync-now">Sync now</button>' +
      '<button type="button" id="gist-disconnect">Disconnect</button></div>' +
      '</div></details>' +
      '<dialog id="sync-dialog" class="sync-dialog"><h2>Progress differs</h2>' +
      '<p>This device: <b id="sync-local-time"></b><br>Gist: <b id="sync-remote-time"></b></p>' +
      '<p>Which one do you want to keep? The other is overwritten (the old local copy is kept as a backup).</p>' +
      '<div class="sync-row"><button type="button" id="sync-keep-local">Keep this device</button>' +
      '<button type="button" id="sync-keep-remote">Keep Gist</button>' +
      '<button type="button" id="sync-cancel">Cancel</button></div></dialog>';
    panel = document.getElementById("sync-panel");
    statusEl = document.getElementById("sync-status");
    tokenEl = document.getElementById("gist-token");
    dialog = document.getElementById("sync-dialog");

    document.getElementById("gist-save").addEventListener("click", function () {
      var v = tokenEl.value.trim();
      if (!v) return;
      set(K_TOKEN, v);
      del(K_GIST);
      del(K_LAST);
      showConnected();
      syncNow();
    });
    document.getElementById("gist-disconnect").addEventListener("click", function () {
      del(K_TOKEN); del(K_GIST); del(K_LAST);
      showConnected();
    });
    document.getElementById("sync-now").addEventListener("click", syncNow);
    document.addEventListener("pokopia-saved", schedule);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") syncNow();
      else if (timer) syncNow();
    });
    window.addEventListener("online", syncNow);
    showConnected();
    if (get(K_TOKEN)) syncNow();
  }

  document.addEventListener("DOMContentLoaded", mount);
  window.PokopiaSync = { syncNow: syncNow };
})();
