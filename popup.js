// --- 1. GLOBAL DATA VARIABLES ---
let districtData = {};
let subjectData = {};

// --- 2. INITIALIZATION ---
document.addEventListener("DOMContentLoaded", async () => {
  await loadAllData();
  refreshProfileDropdown();
  
  // Attach Event Listeners once everything is loaded
  setupDynamicDropdowns();
});

async function loadAllData() {
  try {
    const [distRes, gradRes, masRes, sscRes, hscRes] = await Promise.all([
      fetch("data/districts.json"),
      fetch("data/graduation.json"),
      fetch("data/masters.json"),
      fetch("data/ssc.json"),
      fetch("data/hsc.json"),
    ]);

    districtData = await distRes.json();
    const gData = await gradRes.json();
    const mData = await masRes.json();
    const sData = await sscRes.json();
    const hData = await hscRes.json();
    
    // Combine all subject data into one object
    subjectData = { ...gData, ...mData, ...sData, ...hData };
    console.log("✅ Data files loaded!");
  } catch (err) {
    console.error("❌ Error loading data:", err);
  }
}

// --- 3. DYNAMIC DROPDOWN LOGIC ---
function setupDynamicDropdowns() {
  // District -> Upazila
  document.querySelector('[name="present_district"]').addEventListener("change", function () {
    const districtName = this.options[this.selectedIndex].text;
    const upazilaSelect = document.querySelector('[name="present_upazila"]');
    upazilaSelect.innerHTML = '<option value="">-- Select Upazila --</option>';

    if (districtData[districtName]) {
      districtData[districtName].forEach((upazila) => {
        const option = document.createElement("option");
        option.value = upazila.id;
        option.textContent = upazila.name;
        upazilaSelect.appendChild(option);
      });
    }
  });

  // Exam -> Subject Logic
  const setupExamListener = (examName, subjectName) => {
    const examSelect = document.querySelector(`[name="${examName}"]`);
    const subSelect = document.querySelector(`[name="${subjectName}"]`);
    
    examSelect.addEventListener("change", function () {
      const selectedExam = this.options[this.selectedIndex].text;
      subSelect.innerHTML = '<option value="">-- Select Subject --</option>';
      if (subjectData[selectedExam]) {
        subjectData[selectedExam].forEach((sub) => {
          const option = document.createElement("option");
          option.value = sub.id;
          option.textContent = sub.name;
          subSelect.appendChild(option);
        });
      }
    });
  };

  setupExamListener("gra_exam", "gra_subject");
  setupExamListener("mas_exam", "mas_subject");
  setupExamListener("ssc_exam", "ssc_group");
  setupExamListener("hsc_exam", "hsc_group");
}

// --- 4. FORM HANDLING ---
function getFormData() {

  const formData = new FormData(document.getElementById("jsonForm"));

  const jsonObject = {};

  formData.forEach((value, key) => {
    jsonObject[key] = value;
  });

  jsonObject.other_exp = [
    {
        id: "26",
        value: jsonObject.other_exp_26 || ""
    }
];

// Optional: remove the temporary field
delete jsonObject.other_exp_26;

  // Checkbox values
  jsonObject.same_as_present =
    document.querySelector('[name="same_as_present"]')?.checked
      ? "1"
      : "0";

  // Extra fields
  jsonObject.display_name = jsonObject.name || "";
  jsonObject.confirm_mobile = jsonObject.mobile || "";

  return jsonObject;
}

function fillFormFromData(data) {
  for (const key in data) {
    const field = document.querySelector(`[name="${key}"]`);
    if (field) {
      field.value = data[key];
      // Trigger change to load dynamic dependencies (Upazilas/Subjects)
      field.dispatchEvent(new Event("change"));
    }
  }

  // Final validation delay to ensure dynamic options are populated before setting values
  setTimeout(() => {
    const fieldsToSet = ["present_upazila", "gra_subject", "mas_subject", "ssc_group", "hsc_group"];
    fieldsToSet.forEach(f => {
      if (data[f]) document.querySelector(`[name="${f}"]`).value = data[f];
    });
  }, 300);
}



// --- 5. TAB SWITCHING ---
document.getElementById("tabAutofill").addEventListener("click", () => switchTab("Autofill"));
document.getElementById("tabProfile").addEventListener("click", () => switchTab("Profile"));

function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active-view"));
  document.getElementById(`tab${tab}`).classList.add("active");
  document.getElementById(`view${tab}`).classList.add("active-view");
}

// --- 6. PROFILE STORAGE ---
function refreshProfileDropdown() {
  chrome.storage.local.get(["savedProfiles"], function (result) {
    const profiles = result.savedProfiles || {};
    const selector = document.getElementById("profileSelector");
    selector.innerHTML = '<option value="">-- Choose Profile --</option>';
    for (const profileName in profiles) {
      const opt = document.createElement("option");
      opt.value = profileName;
      opt.textContent = profileName;
      selector.appendChild(opt);
    }
  });
}

document.getElementById("saveBtn").addEventListener("click", function () {
  const profileName = document.getElementById("profileName").value.trim();
  if (!profileName) return alert("Please enter a name to save this profile as!");
  
  const finalData = getFormData();
  chrome.storage.local.get(["savedProfiles"], function (result) {
    let profiles = result.savedProfiles || {};
    profiles[profileName] = finalData;
    chrome.storage.local.set({ savedProfiles: profiles }, () => {
      const btn = document.getElementById("saveBtn");
      btn.textContent = "✅ Saved!";
      setTimeout(() => (btn.textContent = "💾 Save Profile"), 2000);
      refreshProfileDropdown();
    });
  });
});

document.getElementById("downloadBtn").addEventListener("click", function () {
  const finalData = getFormData();
  const jsonString = JSON.stringify(finalData, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  chrome.downloads.download({
    url: URL.createObjectURL(blob),
    filename: (document.getElementById("profileName").value || "profile") + ".json",
    saveAs: true,
  });
});

document.getElementById("importFile").addEventListener("change", function (event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      document.getElementById("profileName").value = file.name.replace(".json", "");
      fillFormFromData(data);
    } catch (error) { alert("Error reading JSON file."); }
  };
  reader.readAsText(file);
});

// --- PREVIEW LOGIC ---
// Ensure preview card is hidden by default; only show when a profile is selected
const _previewCard = document.getElementById("previewCard");
if (_previewCard) _previewCard.style.display = "none";

document.getElementById("profileSelector").addEventListener("change", function() {
  const selectedName = this.value;
  const previewCard = document.getElementById("previewCard");
    
  if (!selectedName) {
    if (previewCard) previewCard.style.display = "none";
    return;
  }

  chrome.storage.local.get(["savedProfiles"], (result) => {
    const profiles = result.savedProfiles || {};
    const profile = profiles[selectedName];

    if (profile) {
      // Populate the card
      const dn = document.getElementById("displayName");
      const mi = document.getElementById("mobileInfo");
      const ei = document.getElementById("emailInfo");
      if (dn) dn.textContent = "👤 Name: " + (profile.name || "N/A");
      if (mi) mi.textContent = "📱 Mobile: " + (profile.mobile || "N/A");
      if (ei) ei.textContent = "📧 Email: " + (profile.email || "N/A");
            
      // Show the card
      if (previewCard) previewCard.style.display = "block";
    }
  });
});

// --- 7. INJECTION LOGIC ---

document.getElementById("injectBtn").addEventListener("click", async () => {
  const selectedProfile = document.getElementById("profileSelector").value;
  if (!selectedProfile) return alert("Please select a profile first!");

  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.storage.local.get(["savedProfiles"], async (result) => {
    const dataToInject = result.savedProfiles[selectedProfile];

    // ==========================================
    // 🧠 BUILD THE MASTER DICTIONARY
    // We map every numeric ID to its actual visible text before injecting
    // ==========================================
    const masterDict = {};
    
    // 1. Grab static options directly from the popup's HTML menus
    document.querySelectorAll('select').forEach(select => {
        masterDict[select.name] = {};
        for(let opt of select.options) {
            if(opt.value) masterDict[select.name][opt.value] = opt.text.trim();
        }
    });

    // 2. Add all dynamic Upazilas from your JSON data
    if (!masterDict["present_upazila"]) masterDict["present_upazila"] = {};
    for (const dist in districtData) {
        districtData[dist].forEach(upz => {
            masterDict["present_upazila"][upz.id] = upz.name.trim();
        });
    }

    // 3. Add all dynamic Education Groups/Subjects from your JSON data
    const subFields = ["ssc_group", "hsc_group", "gra_subject", "mas_subject"];
    subFields.forEach(field => {
        if (!masterDict[field]) masterDict[field] = {};
        for (const exam in subjectData) {
            subjectData[exam].forEach(sub => {
                masterDict[field][sub.id] = sub.name.trim();
            });
        }
    });
    // ==========================================

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      // Notice we are passing the dict into the function now!
      func: async (profile, dict) => { 
          
        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        function fill(name, value) {
            if (value === undefined || value === "") return;
            
            const el = document.getElementsByName(name)[0] || document.getElementById(name);
            if (!el) return;

            // Step 1: Try exact match first
            el.value = value;

            if (el.tagName === 'SELECT') {
                // Look up what the visible text SHOULD be based on the dictionary
                const expectedText = dict[name] && dict[name][value] ? dict[name][value].toLowerCase().trim() : null;
                
                // Step 2: Check if the exact match was actually correct
                let isCorrect = false;
                if (el.selectedIndex >= 0) {
                    const currentText = el.options[el.selectedIndex].text.toLowerCase().trim();
                    const currentVal = el.options[el.selectedIndex].value;
                    
                    if (expectedText && currentText === expectedText) {
                        isCorrect = true; // Text matches perfectly
                    } else if (!expectedText && currentVal === String(value)) {
                        isCorrect = true; // No text known, but ID matched
                    }
                }

                // Step 3: If incorrect, SEARCH for the correct option
                if (!isCorrect) {
                    const targetValStr = String(value).toLowerCase().trim();
                    
                    for (let i = 0; i < el.options.length; i++) {
                        const optVal = el.options[i].value;
                        const optText = el.options[i].text.toLowerCase().trim();

                        // PRIORITY 1: Match by Visible Text (Fixes ID Shuffling like "19" vs "3")
                        if (expectedText && optText === expectedText) {
                            el.selectedIndex = i;
                            break;
                        }

                        // PRIORITY 2: Numeric Match (Fixes "082" vs "82")
                        if (!isNaN(optVal) && !isNaN(value) && optVal.trim() !== "" && String(value).trim() !== "") {
                            if (Number(optVal) === Number(value)) {
                                el.selectedIndex = i;
                                break;
                            }
                        }

                        // PRIORITY 3: Loose String Fallback
                        if (optVal.toLowerCase().trim() === targetValStr || optText === targetValStr) {
                            el.selectedIndex = i;
                            break;
                        }
                    }
                }
            }

            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }

        function check(name) {
            const el = document.getElementsByName(name)[0] || document.getElementById(name);
            if (el && !el.checked) {
                el.click();
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        console.log("🚀 Starting Smart Auto-Fill with Dictionary Logic...");

        // ==========================================
        // PHASE 1: STATIC TEXT & TRIGGERS
        // ==========================================
        fill("name", profile.name);
        fill("name_bn", profile.name_bn);
        fill("father", profile.father);
        fill("father_bn", profile.father_bn);
        fill("mother", profile.mother);
        fill("mother_bn", profile.mother_bn);
        fill("dob", profile.dob);
        fill("nationality", profile.nationality);
        fill("religion", profile.religion);
        fill("gender", profile.gender);
        
        const hasNid = profile.nid_no && profile.nid_no.trim() !== "";
        fill("nid", hasNid ? profile.nid : "No"); 
        if (hasNid) fill("nid_no", profile.nid_no);

        const hasBreg = profile.breg_no && profile.breg_no.trim() !== "";
        fill("breg", hasBreg ? profile.breg : "No"); 
        if (hasBreg) fill("breg_no", profile.breg_no);

        const hasPassport = profile.passport_no && profile.passport_no.trim() !== "";
        fill("passport", hasPassport ? profile.passport : "No"); 
        if (hasPassport) fill("passport_no", profile.passport_no);

        fill("marital_status", profile.marital_status);
        fill("mobile", profile.mobile);
        fill("confirm_mobile", profile.confirm_mobile);
        fill("email", profile.email);
        fill("quota", profile.quota);
        fill("dep_status", profile.dep_status);

        fill("present_careof", profile.present_careof);
        fill("present_village", profile.present_village);
        fill("present_post", profile.present_post);
        fill("present_postcode", profile.present_postcode);
        
        fill("present_district", profile.present_district); 
        
        fill("ssc_roll", profile.ssc_roll);
        fill("ssc_result_type", profile.ssc_result_type);
        fill("ssc_result", profile.ssc_result);
        fill("ssc_year", profile.ssc_year);
        fill("ssc_exam", profile.ssc_exam); 

        if (profile.hsc_exam) {
            check("if_applicable_hsc");
            fill("hsc_roll", profile.hsc_roll);
            fill("hsc_result_type", profile.hsc_result_type);
            fill("hsc_result", profile.hsc_result);
            fill("hsc_year", profile.hsc_year);
            fill("hsc_exam", profile.hsc_exam); 
        }

        if (profile.gra_exam) {
            check("if_applicable_gra");
            fill("gra_result_type", profile.gra_result_type);
            fill("gra_result", profile.gra_result);
            fill("gra_duration", profile.gra_duration);
            fill("gra_year", profile.gra_year);
            fill("gra_exam", profile.gra_exam); 
        }

        if (profile.mas_exam) {
            check("if_applicable_mas");
            fill("mas_result_type", profile.mas_result_type);
            fill("mas_result", profile.mas_result);
            fill("mas_duration", profile.mas_duration);
            fill("mas_year", profile.mas_year);
            fill("mas_exam", profile.mas_exam); 
        }

        // ==========================================
        // PHASE 2: WAIT FOR TELETALK SERVERS
        // ==========================================
        await sleep(1500); // Wait for 1.5 seconds to ensure all dynamic dropdowns are populated

        // ==========================================
        // PHASE 3: FILL THE DEPENDENT DROPDOWNS
        // ==========================================
        fill("present_upazila", profile.present_upazila);
        fill("ssc_board", profile.ssc_board);
        fill("ssc_group", profile.ssc_group);
        
        if (profile.hsc_exam) {
            fill("hsc_board", profile.hsc_board);
            fill("hsc_group", profile.hsc_group);
        }
        if (profile.gra_exam) {
            fill("gra_institute", profile.gra_institute);
            fill("gra_subject", profile.gra_subject);
        }
        if (profile.mas_exam) {
            fill("mas_institute", profile.mas_institute);
            fill("mas_subject", profile.mas_subject);
        }

        // ==========================================
        // PHASE 4: FINAL CHECKBOXES & EXPERIENCES
        // ==========================================
        await sleep(500);

        console.log("🔍 Scanning for Experience dropdowns...");
        const allSelects = document.querySelectorAll('select');
        const protectedFields = ["nid", "breg", "passport", "gender", "religion", "quota", "dep_status", "marital_status"];
        
        allSelects.forEach(select => {
            if (protectedFields.includes(select.name)) return;
            for (let i = 0; i < select.options.length; i++) {
                if (select.options[i].text.trim().toLowerCase() === "yes") {
                    select.selectedIndex = i;
                    select.dispatchEvent(new Event('input', { bubbles: true }));
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    break;
                }
            }
        });

        check("same_as_present");
        check("agree");
        console.log("✅ Auto-Fill Complete!");

      },
      // Pass the generated dictionary into the injection script!
      args: [dataToInject, masterDict] 
    });

    window.close(); 
  });
});