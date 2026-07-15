let profile = null;

const select = document.getElementById("profileSelect");

// Load profile list
fetch(chrome.runtime.getURL("profiles.json"))
.then(r => r.json())
.then(async profiles => {

    profiles.forEach(name => {

        const option = document.createElement("option");

        option.value = name;

        option.textContent = name;

        select.appendChild(option);

    });

    // Load last selected profile
    const last = localStorage.getItem("lastProfile");

    if(last){

        select.value = last;

    }

    loadProfile(select.value);

});

// Load selected profile
async function loadProfile(name){

    const response = await fetch(
        chrome.runtime.getURL("profiles/" + name + ".json")
    );

    profile = await response.json();

    console.log("Loaded Profile:", profile);

    document.getElementById("displayName").innerHTML =
    "👤 " + profile.display_name;

document.getElementById("mobileInfo").innerHTML =
    "📱 " + profile.mobile;

document.getElementById("emailInfo").innerHTML =
    "📧 " + profile.email;

}

select.addEventListener("change", () => {

    localStorage.setItem(

        "lastProfile",

        select.value

    );

    loadProfile(select.value);

});

document.getElementById("fillBtn").addEventListener("click", async () => {

    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    await chrome.scripting.executeScript({

        target: {
            tabId: tab.id
        },

        func: (profile) => {

            function check(id){

                const e = document.getElementById(id);

                if(!e) return;

                e.click();

            } 


            function fill(id, value){

                const e = document.getElementById(id);

                if(!e) return;

                e.value = value;

                e.dispatchEvent(new Event("input",{bubbles:true}));
                e.dispatchEvent(new Event("change",{bubbles:true}));

            }

            fill("name",profile.name);
            fill("name_bn",profile.name_bn);

            fill("father",profile.father);
            fill("father_bn",profile.father_bn);

            fill("mother",profile.mother);
            fill("mother_bn",profile.mother_bn);

            fill("dob",profile.dob);

            fill("nationality",profile.nationality);

            fill("religion",profile.religion);

            fill("gender",profile.gender);

            fill("nid",profile.nid);
            fill("nid_no",profile.nid_no);

            fill("breg",profile.breg);
            fill("breg_no",profile.breg_no);

            fill("passport",profile.passport);
            fill("passport_no",profile.passport_no);

            fill("marital_status",profile.marital_status);

            fill("mobile",profile.mobile);
            fill("confirm_mobile",profile.confirm_mobile);

            fill("email",profile.email);

            fill("quota", profile.quota);

            fill("dep_status", profile.dep_status);

            fill("present_careof",profile.present_careof);

            fill("present_village",profile.present_village);

            fill("present_district",profile.present_district);

            setTimeout(() => {

                fill("present_upazila", profile.present_upazila);

            }, 1500);

            fill("present_post",profile.present_post);

            fill("present_postcode",profile.present_postcode);

            // Permanent Address

            
            setTimeout(() => {

                const same = document.getElementById("same_as_present");

                if (same && !same.checked) {

                    same.click();

                }

            }, 2500);


            // SSC

            fill("ssc_exam", profile.ssc_exam);

            fill("ssc_roll", profile.ssc_roll);

            fill("ssc_group", profile.ssc_group);

            fill("ssc_board", profile.ssc_board);

            fill("ssc_result_type", profile.ssc_result_type);

            fill("ssc_result", profile.ssc_result);

            fill("ssc_year", profile.ssc_year);


            // HSC

            if (profile.hsc_exam) {

                const hsc = document.getElementById("if_applicable_hsc");

                if (hsc && !hsc.checked) {

                    hsc.click();

                }

            }

            fill("hsc_exam", profile.hsc_exam);
            fill("hsc_roll", profile.hsc_roll);
            fill("hsc_group", profile.hsc_group);
            fill("hsc_board", profile.hsc_board);
            fill("hsc_result_type", profile.hsc_result_type);
            fill("hsc_result", profile.hsc_result);
            fill("hsc_year", profile.hsc_year);


            // Graduation

            if (profile.gra_exam) {

                const gra = document.getElementById("if_applicable_gra");

                if (gra && !gra.checked) {

                    gra.click();

                }

            }

                fill("gra_exam", profile.gra_exam);

                fill("gra_institute", profile.gra_institute);

                fill("gra_year", profile.gra_year);

                fill("gra_subject", profile.gra_subject);

                fill("gra_result_type", profile.gra_result_type);

                fill("gra_result", profile.gra_result);

                fill("gra_duration", profile.gra_duration);

            // Postgraduation

            if (profile.mas_exam) {

                const mas = document.getElementById("if_applicable_mas");

                if (mas && !mas.checked) {

                    mas.click();

                }

            }

            fill("mas_exam", profile.mas_exam);

            fill("mas_institute", profile.mas_institute);

            fill("mas_year", profile.mas_year);

            fill("mas_subject", profile.mas_subject);

            fill("mas_result_type", profile.mas_result_type);

            fill("mas_result", profile.mas_result);

            fill("mas_duration", profile.mas_duration);

            // I Agree

            const agree = document.getElementById("agree");

            if (agree && !agree.checked) {

                agree.click();

            }

                    alert("All Information Filled.");

                },

        args:[profile]

    });

});

document.getElementById("createProfileBtn").addEventListener("click", () => {

    chrome.tabs.create({ url: chrome.runtime.getURL("create_profile/profile.html") });

});

// Set version from manifest; works in extension context. Fallback to manifest.json fetch if needed.
;(function(){
    function setVersion(v){
        var el = document.getElementById('version');
        if(el) el.textContent = 'Version ' + v;
    }
    try{
        if(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest){
            var m = chrome.runtime.getManifest();
            if(m && m.version) return setVersion(m.version);
        }
    }catch(e){}
    // Fallback: fetch manifest.json
    fetch('manifest.json').then(function(r){ return r.json(); }).then(function(j){ if(j && j.version) setVersion(j.version); }).catch(function(){});
})();