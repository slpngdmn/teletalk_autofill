// ==========================================
// THE PAGE 2 WATCHER (Aggressive Hunter)
// ==========================================
chrome.storage.local.get(["savedProfiles", "page2Armed"], (result) => {
    // 1. Check if the popup armed the watcher on Page 1
    const profileName = result.page2Armed;
    if (!profileName) return; 

    const profile = result.savedProfiles ? result.savedProfiles[profileName] : null;
    if (!profile) return;

    let injectedAnything = false;
    let attempts = 0;

    // 2. The Virtual File Injector
    function injectVirtualFile(base64Data, filename, keywords) {
        if (!base64Data || base64Data.trim() === "") return false;
        
        const fileInputs = document.querySelectorAll('input[type="file"]');
        let target = null;
        
        for (const el of fileInputs) {
            const identifier = ((el.name || "") + " " + (el.id || "") + " " + (el.className || "")).toLowerCase();
            if (keywords.some(kw => identifier.includes(kw))) {
                target = el;
                break;
            }
        }

        if (target && target.files.length === 0) {
            try {
                const arr = base64Data.split(',');
                const mime = arr[0].match(/:(.*?);/)[1];
                const bstr = atob(arr[1]);
                let n = bstr.length;
                const u8arr = new Uint8Array(n);
                while(n--){ u8arr[n] = bstr.charCodeAt(n); }
                const file = new File([u8arr], filename, { type: mime });

                const dt = new DataTransfer();
                dt.items.add(file);
                target.files = dt.files;
                
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
                
                target.style.border = "3px solid #4CAF50";
                console.log(`✅ Auto-uploaded: ${filename}`);
                return true;
            } catch (err) {
                console.error(`❌ Error uploading ${filename}:`, err);
            }
        }
        return false;
    }

    // 3. The Checkbox Clicker
    function checkDeclaration() {
        // Find the checkbox by name or grab the first checkbox on the screen
        const checkbox = document.querySelector('input[name="agree"], input[name="declare"], input[type="checkbox"]');
        if (checkbox && !checkbox.checked) {
            checkbox.click();
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            console.log("✅ Page 2 Declaration checked automatically.");
            return true;
        }
        return false;
    }

    console.log("👀 Page 2 Watcher is hunting for photo boxes and checkboxes...");

    // 4. The Hunter Loop (Checks every 0.5 seconds)
    const huntInterval = setInterval(() => {
        attempts++;
        
        const photoInjected = injectVirtualFile(profile.photo_base64, "photo.jpg", ["photo", "pic", "image"]);
        const sigInjected = injectVirtualFile(profile.signature_base64, "signature.jpg", ["sig", "sign"]); 
        const boxChecked = checkDeclaration();

        if (photoInjected || sigInjected || boxChecked) {
            injectedAnything = true;
        }

        // 5. DISARM THE WATCHER 
        if (injectedAnything || attempts >= 10) {
            clearInterval(huntInterval);
            if (injectedAnything) {
                chrome.storage.local.remove("page2Armed"); 
                console.log("✅ Watcher finished and disarmed.");
            }
        }
    }, 500); 
});