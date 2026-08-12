// --- 1. GLOBAL DATA VARIABLES ---
let districtData = {};
let subjectData = {};

// Resolves once the JSON lookup tables are in memory. The UI never blocks on
// it: only the dependent dropdowns wait for this.
let dataReady = null;

// --- CENTRALIZED APP STATE ---
let appState = {
  activeProfileName: null,
  isDirty: false,
  profiles: {},
  currentPhoto: "", // Holds Base64 string
  currentSig: "", // Holds Base64 string
};

const DYNAMIC_FIELDS = [
  "present_upazila",
  "gra_subject",
  "mas_subject",
  "ssc_group",
  "hsc_group",
  "ssc_board",
  "hsc_board",
];

// --- 2. INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
  setupDynamicDropdowns();
  setupActionListeners();
  dataReady = loadAllData();
  refreshProfileDropdown();
});

async function loadAllData() {
  try {
    const files = [
      "data/districts.json",
      "data/graduation.json",
      "data/masters.json",
      "data/ssc.json",
      "data/hsc.json",
    ];
    const [dist, grad, mas, ssc, hsc] = await Promise.all(
      files.map((f) => fetch(f).then((res) => res.json())),
    );

    districtData = dist;
    subjectData = { ...grad, ...mas, ...ssc, ...hsc };
  } catch (err) {
    console.error("Autofill: error loading data", err);
  }
}

// --- 3. DYNAMIC DROPDOWN LOGIC ---
function fillOptions(select, items, placeholder) {
  const frag = document.createDocumentFragment();
  const first = document.createElement("option");
  first.value = "";
  first.textContent = placeholder;
  frag.appendChild(first);

  (items || []).forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    frag.appendChild(option);
  });

  select.replaceChildren(frag);
}

function setupDynamicDropdowns() {
  const districtSelect = document.querySelector('[name="present_district"]');
  districtSelect?.addEventListener("change", function () {
    const upazilaSelect = document.querySelector('[name="present_upazila"]');
    if (!upazilaSelect) return;
    const districtName = this.selectedIndex >= 0 ? this.options[this.selectedIndex].text : "";
    fillOptions(upazilaSelect, districtData[districtName], "-- Select Upazila --");
  });

  const setupExamListener = (examName, subjectName) => {
    const examSelect = document.querySelector(`[name="${examName}"]`);
    const subSelect = document.querySelector(`[name="${subjectName}"]`);
    if (!examSelect || !subSelect) return;

    examSelect.addEventListener("change", function () {
      const selectedExam = this.selectedIndex >= 0 ? this.options[this.selectedIndex].text : "";
      fillOptions(subSelect, subjectData[selectedExam], "-- Select Subject --");
    });
  };

  setupExamListener("gra_exam", "gra_subject");
  setupExamListener("mas_exam", "mas_subject");
  setupExamListener("ssc_exam", "ssc_group");
  setupExamListener("hsc_exam", "hsc_group");
}

// --- IMAGE TO BASE64 HANDLERS ---
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

function setPreview(previewId, base64) {
  const preview = document.getElementById(previewId);
  if (!preview) return;
  if (base64) {
    preview.src = base64;
    preview.style.display = "block";
  } else {
    preview.removeAttribute("src");
    preview.style.display = "none";
  }
}

// --- 4. FORM HANDLING ---
function getFormData() {
  const form = document.getElementById("jsonForm");
  const jsonObject = {};

  new FormData(form).forEach((value, key) => {
    jsonObject[key] = value;
  });

  // FormData drops unchecked boxes, so persist every checkbox explicitly.
  form.querySelectorAll('input[type="checkbox"][name]').forEach((box) => {
    jsonObject[box.name] = box.checked ? "1" : "0";
  });

  jsonObject.display_name = jsonObject.name || "";
  jsonObject.confirm_mobile = jsonObject.mobile || "";
  jsonObject.photo_base64 = appState.currentPhoto || "";
  jsonObject.signature_base64 = appState.currentSig || "";
  return jsonObject;
}

function applyDynamicFields(data) {
  const form = document.getElementById("jsonForm");
  DYNAMIC_FIELDS.forEach((name) => {
    const field = form.querySelector(`[name="${name}"]`);
    if (field && data[name]) field.value = data[name];
  });
}

function applyProfileToForm(data) {
  const form = document.getElementById("jsonForm");

  for (const key in data) {
    const field = form.querySelector(`[name="${key}"]`);
    if (!field) continue;
    if (field.type === "checkbox") {
      field.checked = data[key] === "1" || data[key] === true;
    } else {
      field.value = data[key];
    }
    field.dispatchEvent(new Event("change"));
  }

  // The dependent dropdowns can only be set once their options exist, which
  // requires the JSON tables; awaiting the load beats guessing with a timeout.
  applyDynamicFields(data);
  Promise.resolve(dataReady).then(() => {
    for (const name of ["present_district", "ssc_exam", "hsc_exam", "gra_exam", "mas_exam"]) {
      const field = form.querySelector(`[name="${name}"]`);
      if (field && data[name]) field.dispatchEvent(new Event("change"));
    }
    applyDynamicFields(data);
  });
}

// --- 5. TAB SWITCHING ---
function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active-view"));
  document.getElementById(`tab${tab}`).classList.add("active");
  document.getElementById(`view${tab}`).classList.add("active-view");
}

// ==========================================
// 6. REACTIVE STATE & FORM SYNC
// ==========================================
function refreshProfileDropdown(profileToSelect = null) {
  chrome.storage.local.get(["savedProfiles", "lastActiveProfile"], function (result) {
    appState.profiles = result.savedProfiles || {};
    const storedLastActive = result.lastActiveProfile;
    const selector = document.getElementById("profileSelector");
    const names = Object.keys(appState.profiles);

    const frag = document.createDocumentFragment();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = names.length ? "-- Create New Profile --" : "-- No Profiles Saved Yet --";
    frag.appendChild(placeholder);

    names.forEach((profileName) => {
      const opt = document.createElement("option");
      opt.value = profileName;
      opt.textContent = profileName;
      frag.appendChild(opt);
    });
    selector.replaceChildren(frag);

    let targetSelection = "";
    if (profileToSelect && appState.profiles[profileToSelect]) {
      targetSelection = profileToSelect;
    } else if (appState.activeProfileName && appState.profiles[appState.activeProfileName]) {
      targetSelection = appState.activeProfileName;
    } else if (storedLastActive && appState.profiles[storedLastActive]) {
      targetSelection = storedLastActive;
    } else if (names.length) {
      targetSelection = names[names.length - 1];
    }

    selector.value = targetSelection;
    setActiveProfile(targetSelection === "" ? null : targetSelection);
  });
}

function setActiveProfile(name) {
  appState.activeProfileName = name;
  if (name) {
    chrome.storage.local.set({ lastActiveProfile: name });
  } else {
    chrome.storage.local.remove("lastActiveProfile");
  }
  updatePreviewCard();
  populateEditorTab();
}

function updatePreviewCard() {
  const previewCard = document.getElementById("previewCard");
  const profile = appState.activeProfileName
    ? appState.profiles[appState.activeProfileName]
    : null;

  if (!profile) {
    if (previewCard) previewCard.style.display = "none";
    return;
  }

  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  set("displayName", "👤 Name: " + (profile.name || "N/A"));
  set("mobileInfo", "📱 Mobile: " + (profile.mobile || "N/A"));
  set("emailInfo", "📧 Email: " + (profile.email || "N/A"));
  if (previewCard) previewCard.style.display = "block";
}

function populateEditorTab() {
  const form = document.getElementById("jsonForm");
  const header = document.getElementById("editorHeader");
  const saveBtn = document.getElementById("saveBtn");
  const profileNameInput = document.getElementById("profileName");
  const data = appState.activeProfileName
    ? appState.profiles[appState.activeProfileName]
    : null;

  // Always start from a clean form, otherwise values from the previously
  // selected profile survive into the one being loaded.
  form.reset();
  document.getElementById("profilePhoto").value = "";
  document.getElementById("profileSignature").value = "";

  appState.currentPhoto = data ? data.photo_base64 || "" : "";
  appState.currentSig = data ? data.signature_base64 || "" : "";
  setPreview("photoPreview", appState.currentPhoto);
  setPreview("sigPreview", appState.currentSig);

  if (!data) {
    profileNameInput.value = "";
    if (header) header.textContent = "✨ Creating New Profile";
    if (saveBtn) saveBtn.textContent = "💾 Save New Profile";
    return;
  }

  profileNameInput.value = appState.activeProfileName;
  if (header) header.textContent = `✏️ Editing: ${appState.activeProfileName}`;
  if (saveBtn) saveBtn.textContent = "💾 Update Profile";

  applyProfileToForm(data);
}

function markDirty(label) {
  appState.isDirty = true;
  const header = document.getElementById("editorHeader");
  if (header && !header.textContent.includes("*(Unsaved)*")) {
    header.textContent = (label || header.textContent) + " *(Unsaved)*";
  }
}

// ==========================================
// 7. ACTION BUTTON LISTENERS
// ==========================================
function setupActionListeners() {
  document.getElementById("tabAutofill").addEventListener("click", () => switchTab("Autofill"));
  document.getElementById("tabProfile").addEventListener("click", () => switchTab("Profile"));

  document.getElementById("profilePhoto")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    appState.currentPhoto = await fileToBase64(file);
    setPreview("photoPreview", appState.currentPhoto);
    markDirty();
  });

  document.getElementById("profileSignature")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    appState.currentSig = await fileToBase64(file);
    setPreview("sigPreview", appState.currentSig);
    markDirty();
  });

  document.getElementById("jsonForm").addEventListener("input", () => {
    if (!appState.isDirty) markDirty();
  });

  document.getElementById("profileSelector").addEventListener("change", function () {
    const selectedName = this.value;
    if (appState.isDirty && !confirm("You have unsaved changes in the editor. Discard them?")) {
      this.value = appState.activeProfileName || "";
      return;
    }
    appState.isDirty = false;
    setActiveProfile(selectedName === "" ? null : selectedName);
  });

  document.getElementById("editShortcutBtn")?.addEventListener("click", () => {
    switchTab("Profile");
  });

  document.getElementById("startBlankBtn")?.addEventListener("click", () => {
    if (appState.isDirty && !confirm("Discard unsaved changes?")) return;
    document.getElementById("profileSelector").value = "";
    appState.isDirty = false;
    setActiveProfile(null);
  });

  document.getElementById("saveBtn")?.addEventListener("click", function () {
    const saveBtn = this;
    const newProfileName = document.getElementById("profileName").value.trim();
    if (!newProfileName) return alert("Please enter a name to save this profile as!");

    const previousName = appState.activeProfileName;
    if (
      previousName !== newProfileName &&
      appState.profiles[newProfileName] &&
      !confirm(`A profile named "${newProfileName}" already exists. Overwrite it?`)
    ) {
      return;
    }

    appState.profiles[newProfileName] = getFormData();
    // Renaming should move the profile, not leave a stale duplicate behind.
    if (previousName && previousName !== newProfileName) {
      delete appState.profiles[previousName];
    }
    appState.activeProfileName = newProfileName;
    appState.isDirty = false;

    chrome.storage.local.set({ savedProfiles: appState.profiles }, () => {
      saveBtn.textContent = "✅ Saved!";
      setTimeout(() => {
        saveBtn.textContent = "💾 Update Profile";
      }, 1200);
      refreshProfileDropdown(newProfileName);
    });
  });

  document.getElementById("deleteBtn")?.addEventListener("click", () => {
    const name = appState.activeProfileName;
    if (!name) return alert("Select a saved profile to delete.");
    if (!confirm(`Delete profile "${name}"? This cannot be undone.`)) return;

    delete appState.profiles[name];
    appState.activeProfileName = null;
    appState.isDirty = false;
    chrome.storage.local.set({ savedProfiles: appState.profiles }, () => {
      chrome.storage.local.remove("lastActiveProfile");
      refreshProfileDropdown();
    });
  });

  document.getElementById("downloadBtn")?.addEventListener("click", function () {
    const jsonString = JSON.stringify(getFormData(), null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download(
      {
        url,
        filename: (document.getElementById("profileName").value.trim() || "profile") + ".json",
        saveAs: true,
      },
      () => {
        if (chrome.runtime.lastError) alert("Download failed: " + chrome.runtime.lastError.message);
      },
    );
  });

  document.getElementById("importFile")?.addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      let data;
      try {
        data = JSON.parse(e.target.result);
      } catch (error) {
        alert("Error reading JSON file.");
        return;
      }

      appState.activeProfileName = null;
      document.getElementById("jsonForm").reset();
      document.getElementById("profileName").value = file.name.replace(/\.json$/i, "");

      // Imported images were previously dropped on the floor.
      appState.currentPhoto = data.photo_base64 || "";
      appState.currentSig = data.signature_base64 || "";
      setPreview("photoPreview", appState.currentPhoto);
      setPreview("sigPreview", appState.currentSig);

      applyProfileToForm(data);
      appState.isDirty = false;
      markDirty("📂 Imported Profile");
      switchTab("Profile");
    };
    reader.readAsText(file);
    event.target.value = "";
  });

  document.getElementById("injectBtn").addEventListener("click", runAutofill);
}

// --- 8. INJECTION LOGIC ---
function buildMasterDict() {
  const masterDict = {};

  document.querySelectorAll("#jsonForm select[name]").forEach((select) => {
    masterDict[select.name] = {};
    for (const opt of select.options) {
      if (opt.value) masterDict[select.name][opt.value] = opt.text.trim();
    }
  });

  masterDict["present_upazila"] = masterDict["present_upazila"] || {};
  for (const dist in districtData) {
    districtData[dist].forEach((upz) => {
      masterDict["present_upazila"][upz.id] = upz.name.trim();
    });
  }

  ["ssc_group", "hsc_group", "gra_subject", "mas_subject"].forEach((field) => {
    masterDict[field] = masterDict[field] || {};
    for (const exam in subjectData) {
      subjectData[exam].forEach((sub) => {
        masterDict[field][sub.id] = sub.name.trim();
      });
    }
  });

  return masterDict;
}

async function runAutofill() {
  const injectBtn = document.getElementById("injectBtn");
  const selectedProfile = document.getElementById("profileSelector").value;
  if (!selectedProfile) return alert("Please select a profile first!");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return alert("No active tab to fill.");

  injectBtn.disabled = true;
  injectBtn.textContent = "Filling...";

  try {
    await Promise.resolve(dataReady);

    const stored = await chrome.storage.local.get(["savedProfiles"]);
    const dataToInject = (stored.savedProfiles || {})[selectedProfile];
    if (!dataToInject) throw new Error("Profile data could not be found!");

    // Arms the zero-click watcher for page 2, with a timestamp so a stale arm
    // can expire instead of firing on some unrelated page later.
    await chrome.storage.local.set({
      page2Armed: { profile: selectedProfile, ts: Date.now() },
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: injectedFiller,
      args: [dataToInject, buildMasterDict()],
    });

    window.close();
  } catch (err) {
    console.error("Autofill: injection failed", err);
    alert("Auto-fill failed: " + (err && err.message ? err.message : err));
    injectBtn.disabled = false;
    injectBtn.textContent = "Auto-Fill";
  }
}

// Runs inside the page. Must be self-contained.
async function injectedFiller(profile, dict) {
  const norm = (v) => String(v == null ? "" : v).toLowerCase().trim();

  function getEl(name) {
    return document.getElementsByName(name)[0] || document.getElementById(name);
  }

  function selectOption(el, value, expectedText) {
    const target = norm(value);
    const wanted = expectedText ? norm(expectedText) : "";
    const options = Array.from(el.options);

    // Ordered passes so an unrelated numeric id can never win over an exact
    // label match, which used to select the wrong option.
    const matchers = [
      (opt) => wanted && norm(opt.text) === wanted,
      (opt) => norm(opt.value) === target,
      (opt) =>
        opt.value.trim() !== "" &&
        !isNaN(opt.value) &&
        !isNaN(value) &&
        Number(opt.value) === Number(value),
      (opt) => norm(opt.text) === target,
      (opt) => wanted && norm(opt.text).includes(wanted),
    ];

    for (const matcher of matchers) {
      const index = options.findIndex(matcher);
      if (index !== -1) {
        el.selectedIndex = index;
        return true;
      }
    }
    return false;
  }

  function fill(name, value) {
    if (value === undefined || value === null || value === "") return false;

    const el = getEl(name);
    if (!el) return false;

    if (el.tagName === "SELECT") {
      const expectedText = dict[name] ? dict[name][value] : null;
      if (!selectOption(el, value, expectedText)) return false;
    } else {
      el.value = value;
    }

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function check(name) {
    const el = getEl(name);
    if (el && !el.checked) {
      el.click();
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  // Retries a field until the page has populated its dependent options,
  // instead of waiting a fixed (and usually far too long) delay.
  function fillWhenReady(name, value, deadline) {
    if (value === undefined || value === null || value === "") return Promise.resolve(true);

    return new Promise((resolve) => {
      const attempt = () => {
        if (fill(name, value)) return resolve(true);
        if (Date.now() > deadline) return resolve(false);
        setTimeout(attempt, 60);
      };
      attempt();
    });
  }

  // PHASE 1: STATIC TEXT & TRIGGERS
  const staticFields = [
    "name",
    "name_bn",
    "father",
    "father_bn",
    "mother",
    "mother_bn",
    "dob",
    "nationality",
    "religion",
    "gender",
  ];
  staticFields.forEach((f) => fill(f, profile[f]));

  const hasNid = String(profile.nid_no || "").trim() !== "";
  fill("nid", hasNid ? profile.nid : "No");
  if (hasNid) fill("nid_no", profile.nid_no);

  const hasBreg = String(profile.breg_no || "").trim() !== "";
  fill("breg", hasBreg ? profile.breg : "No");
  if (hasBreg) fill("breg_no", profile.breg_no);

  const hasPassport = String(profile.passport_no || "").trim() !== "";
  fill("passport", hasPassport ? profile.passport : "No");
  if (hasPassport) fill("passport_no", profile.passport_no);

  [
    "marital_status",
    "mobile",
    "email",
    "quota",
    "dep_status",
    "present_careof",
    "present_village",
    "present_post",
    "present_postcode",
    "present_district",
    "ssc_roll",
    "ssc_result_type",
    "ssc_result",
    "ssc_year",
    "ssc_exam",
  ].forEach((f) => fill(f, profile[f]));
  fill("confirm_mobile", profile.mobile);

  if (profile.hsc_exam) {
    check("if_applicable_hsc");
    ["hsc_roll", "hsc_result_type", "hsc_result", "hsc_year", "hsc_exam"].forEach((f) =>
      fill(f, profile[f]),
    );
  }

  if (profile.gra_exam) {
    check("if_applicable_gra");
    ["gra_result_type", "gra_result", "gra_duration", "gra_year", "gra_exam"].forEach((f) =>
      fill(f, profile[f]),
    );
  }

  if (profile.mas_exam) {
    check("if_applicable_mas");
    ["mas_result_type", "mas_result", "mas_duration", "mas_year", "mas_exam"].forEach((f) =>
      fill(f, profile[f]),
    );
  }

  // PHASE 2: DEPENDENT DROPDOWNS (filled as soon as the page loads them)
  const deadline = Date.now() + 8000;
  const dependent = [
    ["present_upazila", profile.present_upazila],
    ["ssc_board", profile.ssc_board],
    ["ssc_group", profile.ssc_group],
  ];
  if (profile.hsc_exam) {
    dependent.push(["hsc_board", profile.hsc_board], ["hsc_group", profile.hsc_group]);
  }
  if (profile.gra_exam) {
    dependent.push(["gra_institute", profile.gra_institute], ["gra_subject", profile.gra_subject]);
  }
  if (profile.mas_exam) {
    dependent.push(["mas_institute", profile.mas_institute], ["mas_subject", profile.mas_subject]);
  }

  await Promise.all(dependent.map(([name, value]) => fillWhenReady(name, value, deadline)));

  // PHASE 3: EXPERIENCE-STYLE YES/NO DROPDOWNS
  const handledNames = new Set([
    ...staticFields,
    "nid",
    "breg",
    "passport",
    "quota",
    "dep_status",
    "marital_status",
    ...dependent.map(([name]) => name),
    "ssc_exam",
    "hsc_exam",
    "gra_exam",
    "mas_exam",
    "ssc_result_type",
    "hsc_result_type",
    "gra_result_type",
    "mas_result_type",
    "ssc_year",
    "hsc_year",
    "gra_year",
    "mas_year",
    "gra_duration",
    "mas_duration",
  ]);

  document.querySelectorAll("select").forEach((select) => {
    if (handledNames.has(select.name)) return;
    // Never overwrite something the page or the user already answered.
    if (select.value && select.value.trim() !== "") return;

    const index = Array.from(select.options).findIndex((opt) => norm(opt.text) === "yes");
    if (index !== -1) {
      select.selectedIndex = index;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });

  check("same_as_present");
  check("agree");

  // PHASE 4: PHOTO / SIGNATURE
  function injectVirtualFile(base64Data, filename, keywords) {
    if (!base64Data || base64Data.trim() === "") return;

    let target = null;
    for (const el of document.querySelectorAll('input[type="file"]')) {
      const identifier = (
        (el.name || "") + " " + (el.id || "") + " " + (el.className || "")
      ).toLowerCase();
      if (keywords.some((kw) => identifier.includes(kw))) {
        target = el;
        break;
      }
    }
    if (!target) return;

    try {
      const arr = base64Data.split(",");
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);

      const dt = new DataTransfer();
      dt.items.add(new File([u8arr], filename, { type: mime }));
      target.files = dt.files;

      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
      target.style.border = "3px solid #4CAF50";
    } catch (err) {
      console.error(`Autofill: could not attach ${filename}`, err);
    }
  }

  injectVirtualFile(profile.photo_base64, "photo.jpg", ["photo", "pic", "image"]);
  injectVirtualFile(profile.signature_base64, "signature.jpg", ["sig", "sign"]);

  // PHASE 5: HAND OVER TO THE USER AT THE CAPTCHA
  const captchaInput =
    document.getElementById("captcha") || document.getElementsByName("captcha")[0];
  if (captchaInput) {
    captchaInput.style.border = "3px solid #ff9800";
    captchaInput.style.backgroundColor = "#fff3e0";
    captchaInput.style.boxShadow = "0 0 10px rgba(255, 152, 0, 0.8)";
    captchaInput.scrollIntoView({ behavior: "smooth", block: "center" });
    captchaInput.focus();
  }
}
