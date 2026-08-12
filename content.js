// ==========================================
// PAGE 2 WATCHER
// Only runs when the popup armed it, and only for a short window.
// ==========================================
(() => {
  const ARM_TTL_MS = 5 * 60 * 1000; // an arm request older than this is stale
  const HUNT_TIMEOUT_MS = 15000;

  chrome.storage.local.get(["savedProfiles", "page2Armed"], (result) => {
    const armed = result.page2Armed;
    if (!armed) return;

    // Supports both the legacy string shape and the {profile, ts} shape.
    const profileName = typeof armed === "string" ? armed : armed.profile;
    const armedAt = typeof armed === "string" ? Date.now() : armed.ts || 0;

    if (!profileName) return disarm();
    if (Date.now() - armedAt > ARM_TTL_MS) return disarm();

    const profile = result.savedProfiles ? result.savedProfiles[profileName] : null;
    if (!profile) return disarm();

    const hasPhoto = !!(profile.photo_base64 || "").trim();
    const hasSig = !!(profile.signature_base64 || "").trim();

    let photoDone = !hasPhoto;
    let sigDone = !hasSig;
    let declarationDone = false;

    function disarm() {
      chrome.storage.local.remove("page2Armed");
    }

    function injectVirtualFile(base64Data, filename, keywords) {
      const fileInputs = document.querySelectorAll('input[type="file"]');
      let target = null;

      for (const el of fileInputs) {
        const identifier = (
          (el.name || "") + " " + (el.id || "") + " " + (el.className || "")
        ).toLowerCase();
        if (keywords.some((kw) => identifier.includes(kw))) {
          target = el;
          break;
        }
      }

      if (!target || target.files.length > 0) return false;

      try {
        const arr = base64Data.split(",");
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) u8arr[n] = bstr.charCodeAt(n);
        const file = new File([u8arr], filename, { type: mime });

        const dt = new DataTransfer();
        dt.items.add(file);
        target.files = dt.files;

        target.dispatchEvent(new Event("input", { bubbles: true }));
        target.dispatchEvent(new Event("change", { bubbles: true }));
        target.style.border = "3px solid #4CAF50";
        return true;
      } catch (err) {
        console.error(`Autofill: could not attach ${filename}`, err);
        return true; // don't retry a broken image forever
      }
    }

    // Only clicks a checkbox that actually looks like a declaration/agreement.
    function checkDeclaration() {
      const explicit = document.querySelector(
        'input[type="checkbox"][name*="agree" i], input[type="checkbox"][name*="declar" i], ' +
          'input[type="checkbox"][id*="agree" i], input[type="checkbox"][id*="declar" i]',
      );
      let target = explicit;

      if (!target) {
        for (const box of document.querySelectorAll('input[type="checkbox"]')) {
          const label =
            (box.closest("label") ? box.closest("label").textContent : "") +
            " " +
            (box.labels && box.labels[0] ? box.labels[0].textContent : "");
          if (/agree|declar|certif|সত্য|ঘোষণা/i.test(label)) {
            target = box;
            break;
          }
        }
      }

      if (!target) return false;
      if (!target.checked) {
        target.click();
        target.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return true;
    }

    function sweep() {
      if (!photoDone) photoDone = injectVirtualFile(profile.photo_base64, "photo.jpg", ["photo", "pic", "image"]);
      if (!sigDone) sigDone = injectVirtualFile(profile.signature_base64, "signature.jpg", ["sig", "sign"]);
      if (!declarationDone) declarationDone = checkDeclaration();
      return photoDone && sigDone && declarationDone;
    }

    if (sweep()) return disarm();

    // React to DOM changes instead of polling on a fixed timer: fills the
    // moment the fields appear, and costs nothing while the page is idle.
    const observer = new MutationObserver(() => {
      if (sweep()) stop(true);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    const timer = setTimeout(() => stop(photoDone || sigDone || declarationDone), HUNT_TIMEOUT_MS);

    function stop(shouldDisarm) {
      observer.disconnect();
      clearTimeout(timer);
      if (shouldDisarm) disarm();
    }
  });
})();
