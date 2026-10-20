(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORAGE_KEY = "prompt-arch-library-v1";
  const DEFAULT_CATEGORIES = ["Writing", "Development", "Creative", "Research", "Productivity"];
  const GLYPHS = ["✳", "⌘", "◇", "↗", "◎", "▤", "△", "⊹"];
  let prompts = [];
  let categories = [...DEFAULT_CATEGORIES];
  let activeView = "all";
  let activeCategory = "";
  let quickFilter = "all";
  let currentDetailId = null;
  let listView = false;
  let toastTimer;
  let selectedLocalFile = null;
  let retainedMediaId = null;
  let removeExistingMedia = false;
  const localMediaURLs = new Map();
  let mediaDbPromise = null;
  const els = {
    sidebar: $("#sidebar"), search: $("#searchInput"), clearSearch: $("#clearSearch"), grid: $("#promptGrid"), empty: $("#emptyState"), resultCount: $("#resultCount"), allCount: $("#allCount"), starCount: $("#starCount"), heroCount: $("#heroCount"), storageCount: $("#storageCount"), breadcrumb: $("#breadcrumbView"), sectionTitle: $("#sectionTitle"), sort: $("#sortSelect"), typeFilter: $("#typeQuickFilter"), filterRow: $("#filterRow"), promptDialog: $("#promptDialog"), form: $("#promptForm"), promptId: $("#promptId"), title: $("#promptTitle"), category: $("#promptCategory"), tags: $("#promptTags"), body: $("#promptBody"), bodyCounter: $("#bodyCounter"), dialogTitle: $("#dialogTitle"), dialogEyebrow: $("#dialogEyebrow"), promptType: $("#promptType"), model: $("#promptModel"), template: $("#promptTemplate"), visualFields: $("#visualPromptFields"), aspectRatio: $("#promptAspectRatio"), resolution: $("#promptResolution"), duration: $("#promptDuration"), fps: $("#promptFps"), style: $("#promptStyle"), camera: $("#promptCamera"), seed: $("#promptSeed"), negative: $("#promptNegative"), previewFile: $("#promptPreviewFile"), localPreview: $("#localMediaPreview"), removePreview: $("#removePromptPreview"), suggestedTags: $("#suggestedTags"), detailPreview: $("#detailPreview"), detailMetadata: $("#detailMetadata"), detailDialog: $("#detailDialog"), categoryDialog: $("#categoryDialog"), categoryForm: $("#categoryForm"), categoryName: $("#categoryName"), fileInput: $("#fileInput"), toastRegion: $("#toastRegion")
  };
  function uid() { return globalThis.crypto?.randomUUID?.() || "p-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9); }
  function openMediaDb() {
    if (!("indexedDB" in window)) return Promise.reject(new Error("This browser does not support local preview storage."));
    if (!mediaDbPromise) mediaDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open("prompt-arch-media-v1", 1);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains("media")) request.result.createObjectStore("media", { keyPath: "id" }); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open local media storage."));
    });
    return mediaDbPromise;
  }
  async function storeLocalMedia(id, blob) {
    const db = await openMediaDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("media", "readwrite");
      tx.objectStore("media").put({ id, blob, type: blob.type, updatedAt: Date.now() });
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error || new Error("Could not save preview media."));
    });
    const oldURL = localMediaURLs.get(id); if (oldURL) URL.revokeObjectURL(oldURL);
    localMediaURLs.delete(id);
  }
  async function readLocalMedia(id) {
    const db = await openMediaDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("media", "readonly"), request = tx.objectStore("media").get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Could not read preview media."));
    });
  }
  async function removeLocalMedia(id) {
    if (!id) return;
    try { const db = await openMediaDb(); await new Promise((resolve, reject) => {
      const tx = db.transaction("media", "readwrite"); tx.objectStore("media").delete(id);
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error || new Error("Could not remove preview media."));
    }); } catch (error) { console.warn("Preview cleanup failed", error); }
    const oldURL = localMediaURLs.get(id); if (oldURL) URL.revokeObjectURL(oldURL); localMediaURLs.delete(id);
  }
  async function hydrateLocalMedia(root = document) {
    const nodes = [...root.querySelectorAll("[data-local-media]")];
    for (const node of nodes) {
      const id = node.dataset.localMedia;
      if (!id || node.dataset.mediaReady === "true") continue;
      try {
        const cached = localMediaURLs.get(id);
        if (cached) { node.src = cached; node.dataset.mediaReady = "true"; continue; }
        const record = await readLocalMedia(id);
        if (!record?.blob) { node.classList.add("media-missing"); node.title = "Preview file is unavailable on this device"; continue; }
        const url = URL.createObjectURL(record.blob); localMediaURLs.set(id, url); node.src = url; node.dataset.mediaReady = "true";
      } catch (error) { console.warn("Preview is unavailable", error); }
    }
  }
  function localPreviewMarkup(prompt, detail = false) {
    if (!prompt?.mediaId) return "";
    const tag = String(prompt.mediaType || "").startsWith("video/") ? "video" : "img";
    const controls = tag === "video" ? ' controls preload="metadata"' : ' loading="lazy" alt="Local preview for ' + escapeHTML(prompt.title) + '"';
    return '<' + tag + ' class="' + (detail ? "detail-preview-media" : "prompt-card-media") + '" data-local-media="' + escapeHTML(prompt.mediaId) + '"' + controls + '></' + tag + '>';
  }
  function promptTextForClipboard(prompt) {
    const settings = [
      ["Model / tool", prompt.modelName], ["Aspect ratio", prompt.aspectRatio], ["Resolution", prompt.resolution],
      ["Duration", prompt.durationSeconds ? prompt.durationSeconds + " seconds" : ""], ["Frame rate", prompt.fps ? prompt.fps + " fps" : ""],
      ["Style", prompt.style], ["Camera movement / angle", prompt.cameraMovement], ["Seed / parameters", prompt.seed]
    ].filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "");
    return [String(prompt.content || "").trim(), settings.length ? "Generation settings:\\n" + settings.map(([label, value]) => label + ": " + value).join("\\n") : "", prompt.negativePrompt ? "Negative prompt (avoid):\\n" + prompt.negativePrompt.trim() : ""].filter(Boolean).join("\\n\\n");
  }
  function metadataMarkup(prompt) {
    const items = [
      ["Type", prompt.promptType], ["Model / tool", prompt.modelName], ["Aspect ratio", prompt.aspectRatio],
      ["Resolution", prompt.resolution], ["Duration", prompt.durationSeconds ? prompt.durationSeconds + " sec" : ""],
      ["Frame rate", prompt.fps ? prompt.fps + " fps" : ""], ["Style", prompt.style],
      ["Camera", prompt.cameraMovement], ["Seed / params", prompt.seed], ["Negative prompt", prompt.negativePrompt]
    ].filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "");
    if (!items.length) { els.detailMetadata.hidden = true; els.detailMetadata.innerHTML = ""; return; }
    els.detailMetadata.hidden = false;
    els.detailMetadata.innerHTML = items.map(([label, value]) => '<div class="metadata-item"><span>' + escapeHTML(label) + '</span><p>' + escapeHTML(value) + '</p></div>').join("");
  }
  function setVisualFields() {
    const type = els.promptType.value || "Text";
    const visual = ["Image", "Video", "Image-to-Video"].includes(type);
    els.visualFields.hidden = !visual;
    $("#promptBodyLabel").textContent = type === "Image" ? "IMAGE PROMPT" : type === "Video" || type === "Image-to-Video" ? "VIDEO PROMPT / SCENE INSTRUCTIONS" : "THE PROMPT";
    if (!visual) { els.suggestedTags.innerHTML = ""; return; }
    const imageTags = ["photorealistic", "cinematic", "editorial", "portrait", "product-shot", "macro", "anime", "concept-art", "film-grain", "lighting"];
    const videoTags = ["cinematic", "slow-motion", "tracking-shot", "dolly-in", "handheld", "wide-shot", "close-up", "timelapse", "4k", "loop"];
    const tags = type === "Image" ? imageTags : videoTags;
    els.suggestedTags.innerHTML = '<span class="suggested-tags-label">QUICK TAGS</span>' + tags.map(tag => '<button type="button" class="suggested-tag" data-suggest-tag="' + tag + '">' + tag + ' +</button>').join("");
  }
  function applyLocalTemplate() {
    const templates = {
      photo: {type:"Image", model:"", ratio:"16:9", resolution:"4K", style:"photorealistic, natural textures, deliberate composition, cinematic lighting", tags:"photorealistic, cinematic, detailed", negative:"blurry, low resolution, distorted anatomy, extra fingers, watermark, text artifacts", body:"Create a photorealistic image of [SUBJECT].\n\nComposition: [FRAMING AND VISUAL HIERARCHY]\nEnvironment: [LOCATION AND BACKGROUND]\nLighting: [LIGHT SOURCE, QUALITY, DIRECTION]\nLens / perspective: [LENS AND CAMERA ANGLE]\nMaterials and details: [IMPORTANT TEXTURES]\nMood and palette: [MOOD, COLORS]\nQuality: clean details, coherent anatomy, realistic textures."},
      product: {type:"Image", model:"", ratio:"1:1", resolution:"4K", style:"premium studio product photography, softbox lighting, crisp material detail", tags:"product-shot, studio, commercial, premium", negative:"dust, scratches, warped logo, extra objects, clutter, low quality, text artifacts", body:"Create a premium product photograph of [PRODUCT].\n\nProduct details: [SHAPE, MATERIAL, COLOR, FINISH]\nBackdrop: [BACKGROUND AND SURFACE]\nComposition: clean hero framing with negative space.\nLighting: controlled studio softboxes, realistic reflections, natural contact shadow.\nCamera: [ANGLE AND LENS]\nBrand mood: [MOOD AND COLOR PALETTE]\nKeep the product geometry accurate and the frame uncluttered."},
      anime: {type:"Image", model:"", ratio:"2:3", resolution:"2K", style:"anime illustration, expressive linework, detailed lighting, cohesive palette", tags:"anime, character-design, concept-art, illustration", negative:"inconsistent face, uneven eyes, extra limbs, unreadable text, muddy colors", body:"Illustrate [CHARACTER OR SCENE] in a polished anime / concept-art style.\n\nCharacter / subject: [DESIGN AND DISTINCTIVE FEATURES]\nPose and expression: [POSE, GESTURE, EMOTION]\nSetting: [ENVIRONMENT AND ATMOSPHERE]\nComposition: [CAMERA ANGLE AND FRAMING]\nLighting: [LIGHTING DESIGN]\nPalette: [COLOR STORY]\nMaintain consistent proportions, expressive details, and a clear silhouette."},
      video: {type:"Video", model:"", ratio:"16:9", resolution:"1080p", duration:"8", fps:"24", style:"cinematic, motivated lighting, natural motion, filmic color grade", camera:"slow dolly-in", tags:"cinematic, video, dolly-in, 24fps", negative:"flicker, jitter, frame warping, morphing objects, unstable identity", body:"Create an [8-second] cinematic video of [SUBJECT] doing [ACTION].\n\nOpening frame: [SCENE AND COMPOSITION]\nAction: [CLEAR MOTION WITH BEGINNING, MIDDLE, END]\nCamera: [MOVEMENT, LENS, ANGLE]\nEnvironment: [SETTING AND BACKGROUND MOTION]\nLighting and color: [LIGHT SOURCE AND COLOR GRADE]\nMotion: smooth, physically plausible, consistent subject identity.\nEnding frame: [FINAL COMPOSITION OR LOOP POINT]"},
      i2v: {type:"Image-to-Video", model:"", ratio:"9:16", resolution:"1080p", duration:"5", fps:"24", style:"subtle cinematic movement, realistic physics", camera:"slow push-in with gentle parallax", tags:"image-to-video, motion, cinematic, loop", negative:"face drift, identity change, flicker, warping, melting, extra limbs", body:"Animate the supplied reference image without changing its identity or composition.\n\nPrimary motion: [ONE CLEAR, BELIEVABLE ACTION]\nSecondary motion: [HAIR, FABRIC, FOG, WATER, LIGHTS]\nCamera movement: [SLOW PAN / PUSH-IN / ORBIT]\nPreserve: subject identity, face, clothing, object shapes, lighting direction, and key background details.\nAvoid: sudden cuts, shape-shifting, unmotivated movement, flicker.\nEnd on a stable frame that can transition smoothly."},
      character: {type:"Image", model:"", ratio:"2:3", resolution:"2K", style:"character reference sheet, consistent proportions, neutral studio lighting", tags:"character-design, reference-sheet, consistency, turnaround", negative:"inconsistent face, changing costume, mismatched proportions, duplicate limbs", body:"Create a character reference sheet for [CHARACTER NAME].\n\nIdentity: [AGE RANGE, BUILD, FACE, HAIR, DISTINCTIVE FEATURES]\nWardrobe: [CLOTHING, MATERIALS, COLORS]\nViews: front, three-quarter, side, and back views.\nExpressions: neutral, happy, serious.\nConsistency rules: preserve the exact face, hairstyle, proportions, and clothing across all views.\nBackground: plain neutral studio backdrop, even lighting, full body visible."},
      agent: {type:"AI Agent", model:"", tags:"agent, workflow, reliable, structured-output", body:"ROLE\nYou are [ROLE / SPECIALIST].\n\nGOAL\n[MEASURABLE OUTCOME].\n\nCONTEXT\n[PROJECT, USERS, CONSTRAINTS, AVAILABLE TOOLS].\n\nWORKFLOW\n1. Clarify missing critical requirements.\n2. Plan the smallest reliable sequence of actions.\n3. Execute one step at a time and inspect results.\n4. Validate outputs before reporting completion.\n\nGUARDRAILS\n- Ask before destructive or external actions.\n- Never claim a tool succeeded without verifying its result.\n- Keep secrets out of logs and output.\n\nOUTPUT FORMAT\n[EXPECTED STRUCTURE, FILES, OR SUMMARY]."}
    };
    const template = templates[els.template.value];
    if (!template) return;
    els.promptType.value = template.type; els.model.value = template.model || "";
    els.aspectRatio.value = template.ratio || ""; els.resolution.value = template.resolution || "";
    els.duration.value = template.duration || ""; els.fps.value = template.fps || "";
    els.style.value = template.style || ""; els.camera.value = template.camera || "";
    els.seed.value = ""; els.negative.value = template.negative || "";
    els.tags.value = template.tags || ""; els.body.value = template.body || "";
    els.bodyCounter.textContent = els.body.value.length.toLocaleString() + " characters";
    setVisualFields(); toast("Template added. Customize the placeholders for your idea.");
    els.template.value = "";
  }
  
  function renderLocalEditorPreview() {
    const box = els.localPreview;
    if (selectedLocalFile) {
      const url = URL.createObjectURL(selectedLocalFile);
      box.innerHTML = selectedLocalFile.type.startsWith("video/") ? '<video controls class="editor-preview-media" src="' + url + '"></video>' : '<img class="editor-preview-media" alt="Selected prompt preview" src="' + url + '">';
      box.hidden = false; els.removePreview.hidden = false; return;
    }
    if (retainedMediaId && !removeExistingMedia) {
      box.innerHTML = localPreviewMarkup({ mediaId: retainedMediaId, mediaType: $("#promptId").dataset.mediaType || "", title: els.title.value || "prompt" }, true);
      box.hidden = false; els.removePreview.hidden = false; void hydrateLocalMedia(box); return;
    }
    box.innerHTML = ""; box.hidden = true; els.removePreview.hidden = true;
  }
  
  function safeText(value) { return String(value ?? "").trim(); }
  function formatDate(value, full = false) { const date = new Date(value); if (Number.isNaN(date.getTime())) return "Just now"; return new Intl.DateTimeFormat(undefined, full ? { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" } : { month: "short", day: "numeric" }).format(date); }
  function escapeHTML(value) { return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, categories, prompts })); return true; } catch (error) { console.error("Prompt Arch could not save the library.", error); toast("Couldn't save. Your browser storage may be full or disabled.", "error"); return false; } }
  function load() { try { const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return; const parsed = JSON.parse(raw); if (Array.isArray(parsed)) { prompts = parsed.filter(isValidPrompt).map(normalizePrompt); return; } if (parsed && typeof parsed === "object") { if (Array.isArray(parsed.categories)) categories = [...new Set([...DEFAULT_CATEGORIES, ...parsed.categories.map(safeText).filter(Boolean)])]; if (Array.isArray(parsed.prompts)) prompts = parsed.prompts.filter(isValidPrompt).map(normalizePrompt); } } catch (error) { console.warn("Prompt Arch could not read the saved library.", error); toast("Saved library could not be read. You can import a backup JSON file.", "error"); } }
  function isValidPrompt(item) { return item && typeof item === "object" && typeof item.title === "string" && typeof item.content === "string"; }
  function normalizePrompt(item) {
    const now = new Date().toISOString();
    return {
      id: safeText(item.id) || uid(), title: safeText(item.title).slice(0, 120) || "Untitled prompt",
      content: String(item.content ?? item.body ?? item.prompt ?? ""), category: safeText(item.category) || "Uncategorized",
      tags: Array.isArray(item.tags) ? [...new Set(item.tags.map(safeText).filter(Boolean).map(t => t.slice(0, 40)))].slice(0, 20) : (typeof item.tags === "string" ? parseTags(item.tags) : []),
      promptType: safeText(item.promptType ?? item.prompt_type) || "Text", modelName: safeText(item.modelName ?? item.model_name),
      aspectRatio: safeText(item.aspectRatio ?? item.aspect_ratio), resolution: safeText(item.resolution),
      durationSeconds: item.durationSeconds ?? item.duration_seconds ?? "", fps: item.fps ?? "",
      style: safeText(item.style), cameraMovement: safeText(item.cameraMovement ?? item.camera_movement),
      seed: safeText(item.seed), negativePrompt: safeText(item.negativePrompt ?? item.negative_prompt),
      mediaId: safeText(item.mediaId) || null, mediaType: safeText(item.mediaType) || null,
      favorite: Boolean(item.favorite), createdAt: item.createdAt || now, updatedAt: item.updatedAt || item.createdAt || now
    };
  }
  function parseTags(value) { return [...new Set(String(value || "").split(",").map(safeText).filter(Boolean).map(t => t.slice(0, 40)))].slice(0, 20); }
  function toast(message, type = "success") { const node = document.createElement("div"); node.className = "toast" + (type === "error" ? " error" : ""); const text = document.createElement("span"); text.textContent = message; const close = document.createElement("button"); close.type = "button"; close.setAttribute("aria-label", "Dismiss notification"); close.textContent = "×"; close.addEventListener("click", () => node.remove()); node.append(text, close); els.toastRegion.append(node); window.setTimeout(() => node.remove(), 3800); }
  function visiblePrompts() {
    const query = els.search.value.trim().toLocaleLowerCase();
    let result = [...prompts];
    if (activeView === "favorites" || quickFilter === "favorites") result = result.filter(prompt => prompt.favorite);
    else if (activeView === "recent") result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (activeCategory) result = result.filter(prompt => prompt.category === activeCategory);
    if (quickFilter === "untagged") result = result.filter(prompt => prompt.tags.length === 0);
    if (els.typeFilter?.value) result = result.filter(prompt => (prompt.promptType || "Text") === els.typeFilter.value);
    if (query) result = result.filter(prompt => [prompt.title, prompt.content, prompt.category, prompt.promptType, prompt.modelName, prompt.aspectRatio, prompt.resolution, prompt.durationSeconds, prompt.fps, prompt.style, prompt.cameraMovement, prompt.seed, prompt.negativePrompt, ...prompt.tags].join(" ").toLocaleLowerCase().includes(query));
    if (activeView !== "recent") {
      switch (els.sort.value) {
        case "newest": result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
        case "oldest": result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); break;
        case "title": result.sort((a, b) => a.title.localeCompare(b.title)); break;
        default: result.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      }
    }
    return result;
  }
  function render() { const result = visiblePrompts(); const favCount = prompts.filter(prompt => prompt.favorite).length; els.allCount.textContent = prompts.length; els.starCount.textContent = favCount; els.heroCount.textContent = String(prompts.length).padStart(2, "0"); els.storageCount.textContent = prompts.length + (prompts.length === 1 ? " prompt stored" : " prompts stored"); els.resultCount.textContent = result.length + (result.length === 1 ? " result" : " results"); els.clearSearch.hidden = !els.search.value; els.grid.classList.toggle("list-view", listView); const hasResults = result.length > 0; els.grid.hidden = !hasResults; els.empty.classList.toggle("visible", !hasResults); els.empty.setAttribute("aria-hidden", String(hasResults)); $("#emptyAddBtn").hidden = Boolean(els.search.value || activeCategory || activeView !== "all" || quickFilter !== "all"); $("#emptyImportBtn").hidden = $("#emptyAddBtn").hidden; if (!hasResults) { const searching = Boolean(els.search.value); $("#emptyKicker").textContent = searching ? "NO MATCHES FOUND" : "A BLANK CANVAS"; $("#emptyTitle").textContent = searching ? "Nothing in the archive yet." : activeCategory ? "This collection is waiting." : activeView === "favorites" || quickFilter === "favorites" ? "Nothing starred. Yet." : activeView === "recent" ? "No prompts to revisit." : "Every great library starts somewhere."; $("#emptyDescription").textContent = searching ? "Try a different phrase, tag, or collection name." : activeCategory ? "Add a prompt to this collection, or choose another one." : "Save that prompt you keep rewriting. Future you will be glad."; } els.grid.innerHTML = result.map((prompt, index) => cardMarkup(prompt, index)).join(""); void hydrateLocalMedia(els.grid); renderCategories(); renderCategoryOptions(); updateHeading(); }
  function cardMarkup(prompt, index) {
    const tags = prompt.tags.slice(0, 3).map(tag => '<span class="tag">' + escapeHTML(tag) + '</span>').join("");
    const extra = prompt.tags.length > 3 ? '<span class="tag">+' + (prompt.tags.length - 3) + '</span>' : "";
    const excerpt = prompt.content.length > 240 ? prompt.content.slice(0, 240) + "…" : prompt.content;
    const categoryIndex = Math.max(0, categories.indexOf(prompt.category));
    const visualMeta = [prompt.modelName, prompt.aspectRatio, prompt.resolution, prompt.durationSeconds ? prompt.durationSeconds + "s" : ""].filter(Boolean).slice(0, 3).map(value => '<span class="tag metadata-tag">' + escapeHTML(value) + '</span>').join("");
    return '<article class="prompt-card" style="animation-delay:' + Math.min(index * 25, 150) + 'ms" data-id="' + escapeHTML(prompt.id) + '">' +
      '<div class="card-top"><span class="card-category"><span class="category-glyph">' + GLYPHS[categoryIndex % GLYPHS.length] + '</span><span>' + escapeHTML(prompt.category) + '</span></span><span class="prompt-type-badge">' + escapeHTML(prompt.promptType || "Text") + '</span>' +
      '<div class="card-actions"><button type="button" class="' + (prompt.favorite ? "starred" : "") + '" data-action="favorite" data-id="' + escapeHTML(prompt.id) + '" aria-label="' + (prompt.favorite ? "Remove star" : "Star prompt") + '" title="' + (prompt.favorite ? "Unstar" : "Star") + '">' + (prompt.favorite ? "✳" : "✧") + '</button><button type="button" data-action="more" data-id="' + escapeHTML(prompt.id) + '" aria-label="More actions" title="More actions">···</button></div></div>' +
      (prompt.mediaId ? '<div class="prompt-preview-wrap">' + localPreviewMarkup(prompt) + '</div>' : "") +
      '<button type="button" class="card-title title-button" data-action="open" data-id="' + escapeHTML(prompt.id) + '">' + escapeHTML(prompt.title) + '</button><p class="card-preview">' + escapeHTML(excerpt) + '</p><div class="card-tags">' + tags + extra + visualMeta + '</div>' +
      '<div class="card-bottom"><span>EDITED ' + escapeHTML(formatDate(prompt.updatedAt).toUpperCase()) + '</span><button type="button" data-action="copy" data-id="' + escapeHTML(prompt.id) + '">COPY ↗</button></div></article>';
  }
  
  function updateHeading() { const viewName = activeCategory || ({ all: "All prompts", favorites: "Starred prompts", recent: "Recently added" }[activeView] || "All prompts"); els.breadcrumb.textContent = viewName; els.sectionTitle.innerHTML = escapeHTML(activeCategory || ({ all: "Your library", favorites: "Starred prompts", recent: "Recently added" }[activeView] || "Your library")) + '<span class="heading-period">.</span>'; $$(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.view === activeView && !activeCategory || button.dataset.category === activeCategory && Boolean(activeCategory))); $$(".filter-chip").forEach(button => button.classList.toggle("selected", button.dataset.filter === quickFilter)); }
  function renderCategories() { const container = $("#categoryNav"); container.innerHTML = categories.map((category, index) => { const count = prompts.filter(prompt => prompt.category === category).length; return '<button class="nav-item" type="button" data-category="' + escapeHTML(category) + '"><span class="collection-dot"></span><span>' + escapeHTML(category) + '</span><span class="nav-count">' + count + '</span></button>'; }).join(""); if (activeCategory) { const selected = [...container.querySelectorAll("[data-category]")].find(button => button.dataset.category === activeCategory); if (selected) selected.classList.add("active"); } }
  function renderCategoryOptions() { const previous = els.category.value; els.category.innerHTML = [...categories, "Uncategorized"].map(category => '<option value="' + escapeHTML(category) + '">' + escapeHTML(category) + '</option>').join(""); if ([...els.category.options].some(option => option.value === previous)) els.category.value = previous; }
  function setView(view) { activeView = view; activeCategory = ""; quickFilter = "all"; $("#filterRow").hidden = false; render(); }
  function openEditor(prompt = null) {
    els.form.reset(); selectedLocalFile = null; removeExistingMedia = false; retainedMediaId = prompt?.mediaId || null;
    els.promptId.value = prompt?.id || ""; els.promptId.dataset.mediaType = prompt?.mediaType || "";
    els.title.value = prompt?.title || ""; els.category.value = prompt?.category || "Writing";
    els.tags.value = prompt?.tags?.join(", ") || ""; els.body.value = prompt?.content || "";
    els.promptType.value = prompt?.promptType || "Text"; els.model.value = prompt?.modelName || "";
    els.aspectRatio.value = prompt?.aspectRatio || ""; els.resolution.value = prompt?.resolution || "";
    els.duration.value = prompt?.durationSeconds ?? ""; els.fps.value = prompt?.fps ?? "";
    els.style.value = prompt?.style || ""; els.camera.value = prompt?.cameraMovement || "";
    els.seed.value = prompt?.seed || ""; els.negative.value = prompt?.negativePrompt || "";
    els.bodyCounter.textContent = els.body.value.length.toLocaleString() + " characters";
    els.dialogTitle.innerHTML = (prompt ? "Refine prompt" : "New prompt") + '<span class="heading-period">.</span>';
    els.dialogEyebrow.textContent = prompt ? "SHAPE IT A LITTLE MORE" : "ADD TO THE ARCHIVE";
    setVisualFields(); renderLocalEditorPreview(); els.promptDialog.showModal(); window.setTimeout(() => els.title.focus(), 40);
  }
  
  function closeEditor() { els.promptDialog.close(); }
  function findPrompt(id) { return prompts.find(prompt => prompt.id === id); }
  function openDetail(id) {
    const prompt = findPrompt(id); if (!prompt) return;
    currentDetailId = id; $("#detailCategory").textContent = (prompt.promptType || "Text").toUpperCase() + " · " + prompt.category.toUpperCase();
    $("#detailDate").textContent = "EDITED " + formatDate(prompt.updatedAt, true).toUpperCase();
    $("#detailTitle").textContent = prompt.title; $("#detailBody").textContent = prompt.content;
    $("#detailTags").innerHTML = prompt.tags.map(tag => '<span class="tag">' + escapeHTML(tag) + '</span>').join("");
    els.detailPreview.innerHTML = localPreviewMarkup(prompt, true); els.detailPreview.hidden = !prompt.mediaId;
    metadataMarkup(prompt); els.detailDialog.showModal(); if (prompt.mediaId) void hydrateLocalMedia(els.detailPreview);
  }
  
  async function copyText(text) { try { if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text); else { const area = document.createElement("textarea"); area.value = text; area.style.position = "fixed"; area.style.opacity = "0"; document.body.append(area); area.select(); const ok = document.execCommand("copy"); area.remove(); if (!ok) throw new Error("Copy was not permitted"); } toast("Prompt copied to clipboard."); } catch (error) { toast("Couldn't copy automatically. Open the prompt and copy its text.", "error"); } }
  async function deletePrompt(id) {
    const prompt = findPrompt(id);
    if (!prompt || !window.confirm('Delete "' + prompt.title + '" from your library? This cannot be undone.')) return;
    prompts = prompts.filter(item => item.id !== id);
    if (currentDetailId === id) els.detailDialog.close();
    await removeLocalMedia(prompt.mediaId); save(); render(); toast("Prompt deleted.");
  }
  
  function exportLibrary() { const payload = { app: "Prompt Arch", version: 2, exportedAt: new Date().toISOString(), categories, prompts: prompts.map(({mediaId, mediaType, ...prompt}) => ({...prompt, previewIncluded: false})) }; const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "prompt-arch-library-" + new Date().toISOString().slice(0, 10) + ".json"; document.body.append(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url); toast(prompts.some(p => p.mediaId) ? "Library exported. Local preview files are stored separately and were not included." : "Library export prepared."); }
  function normalizeImportedItem(item, fallbackCategory = "Uncategorized") { if (typeof item === "string") return normalizePrompt({ title: "Imported prompt", content: item, category: fallbackCategory }); if (!item || typeof item !== "object") return null; const content = item.content ?? item.body ?? item.prompt ?? item.text; const title = item.title ?? item.name ?? item.filename ?? "Imported prompt"; if (typeof content !== "string") return null; return normalizePrompt({ ...item, title: String(title), content, category: item.category || fallbackCategory }); }
  async function importFiles(files) { let imported = 0, skipped = 0; for (const file of files) { try { const text = await file.text(); const extension = file.name.split(".").pop().toLowerCase(); if (extension === "json") { const parsed = JSON.parse(text); if (parsed && Array.isArray(parsed.categories)) { categories = [...new Set([...categories, ...parsed.categories.map(safeText).filter(Boolean)])]; } const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.prompts) ? parsed.prompts : [parsed]; for (const item of items) { const prompt = normalizeImportedItem(item, "Uncategorized"); if (!prompt) { skipped++; continue; } if (prompts.some(existing => existing.title === prompt.title && existing.content === prompt.content)) { skipped++; continue; } prompts.unshift(prompt); imported++; } } else { const title = file.name.replace(/\.(txt|md|prompt|prompts)$/i, "").replace(/[-_]+/g, " ").trim() || "Imported prompt"; const content = text.trim(); if (!content) { skipped++; continue; } if (prompts.some(existing => existing.title === title && existing.content === content)) { skipped++; continue; } prompts.unshift(normalizePrompt({ title, content, category: "Uncategorized", tags: extension === "md" ? ["markdown"] : [] })); imported++; } } catch (error) { skipped++; console.error("Failed to import", file.name, error); } } save(); render(); if (imported) toast("Imported " + imported + (imported === 1 ? " prompt" : " prompts") + (skipped ? " · skipped " + skipped : "") + "."); else toast("No new prompts imported" + (skipped ? " · " + skipped + " skipped" : "") + ".", "error"); }
  els.form.addEventListener("submit", async event => {
    event.preventDefault();
    const title = safeText(els.title.value), content = els.body.value.trim();
    if (!title || !content) { toast("Add a title and prompt text first.", "error"); return; }
    const existing = findPrompt(els.promptId.value), now = new Date().toISOString();
    let mediaId = existing?.mediaId || null, mediaType = existing?.mediaType || null;
    try {
      if (selectedLocalFile) {
        const newId = uid(); await storeLocalMedia(newId, selectedLocalFile);
        if (existing?.mediaId) await removeLocalMedia(existing.mediaId);
        mediaId = newId; mediaType = selectedLocalFile.type;
      } else if (removeExistingMedia) {
        if (existing?.mediaId) await removeLocalMedia(existing.mediaId);
        mediaId = null; mediaType = null;
      }
      const item = normalizePrompt({
        id: existing?.id || uid(), title, content, category: els.category.value || "Uncategorized",
        tags: parseTags(els.tags.value), favorite: existing?.favorite || false, createdAt: existing?.createdAt || now, updatedAt: now,
        promptType: els.promptType.value || "Text", modelName: els.model.value, aspectRatio: els.aspectRatio.value,
        resolution: els.resolution.value, durationSeconds: els.duration.value, fps: els.fps.value, style: els.style.value,
        cameraMovement: els.camera.value, seed: els.seed.value, negativePrompt: els.negative.value, mediaId, mediaType
      });
      if (existing) prompts = prompts.map(prompt => prompt.id === existing.id ? item : prompt); else prompts.unshift(item);
      save(); closeEditor(); render(); toast(existing ? "Changes saved." : "Prompt added to your archive.");
      selectedLocalFile = null; retainedMediaId = null; removeExistingMedia = false;
    } catch (error) { toast(error.message || "Could not save this prompt and preview.", "error"); }
  });
  els.body.addEventListener("input", () => { els.bodyCounter.textContent = els.body.value.length.toLocaleString() + " characters"; });
  els.promptType.addEventListener("change", setVisualFields);
  els.template.addEventListener("change", applyLocalTemplate);
  els.previewFile.addEventListener("change", event => {
    const file = event.target.files?.[0] || null;
    if (!file) { selectedLocalFile = null; renderLocalEditorPreview(); return; }
    const isImage = file.type.startsWith("image/"), isVideo = file.type.startsWith("video/");
    if ((!isImage && !isVideo) || (isImage && file.size > 5 * 1024 * 1024) || (isVideo && file.size > 20 * 1024 * 1024)) {
      toast("Choose an image up to 5 MB or a video up to 20 MB.", "error"); event.target.value = ""; selectedLocalFile = null; renderLocalEditorPreview(); return;
    }
    selectedLocalFile = file; removeExistingMedia = false; renderLocalEditorPreview();
  });
  els.removePreview.addEventListener("click", () => { selectedLocalFile = null; removeExistingMedia = true; els.previewFile.value = ""; renderLocalEditorPreview(); });
  els.suggestedTags.addEventListener("click", event => { const button = event.target.closest("[data-suggest-tag]"); if (!button) return; const tag = button.dataset.suggestTag; const tags = parseTags(els.tags.value); if (!tags.includes(tag)) tags.push(tag); els.tags.value = tags.join(", "); button.classList.add("used"); });
  els.typeFilter.addEventListener("change", render);
  $("#newPromptBtn").addEventListener("click", () => openEditor()); $("#newPromptBtnTop").addEventListener("click", () => openEditor()); $("#emptyAddBtn").addEventListener("click", () => openEditor()); $("#closeDialog").addEventListener("click", closeEditor); $("#cancelDialog").addEventListener("click", closeEditor); $("#closeDetail").addEventListener("click", () => els.detailDialog.close());
  $("#detailCopy").addEventListener("click", () => { const prompt = findPrompt(currentDetailId); if (prompt) copyText(promptTextForClipboard(prompt)); }); $("#detailEdit").addEventListener("click", () => { const prompt = findPrompt(currentDetailId); els.detailDialog.close(); if (prompt) openEditor(prompt); });
  $("#addCategoryBtn").addEventListener("click", () => { els.categoryForm.reset(); els.categoryDialog.showModal(); window.setTimeout(() => els.categoryName.focus(), 40); }); $("#closeCategory").addEventListener("click", () => els.categoryDialog.close()); $("#cancelCategory").addEventListener("click", () => els.categoryDialog.close());
  els.categoryForm.addEventListener("submit", event => { event.preventDefault(); const name = safeText(els.categoryName.value); if (!name) return; if (categories.some(category => category.toLocaleLowerCase() === name.toLocaleLowerCase())) { toast("That collection already exists.", "error"); return; } categories.push(name); save(); els.categoryDialog.close(); render(); toast("Collection created."); });
  $("#importBtn").addEventListener("click", () => els.fileInput.click()); $("#footerImportBtn").addEventListener("click", () => els.fileInput.click()); $("#emptyImportBtn").addEventListener("click", () => els.fileInput.click()); els.fileInput.addEventListener("change", event => { const files = [...(event.target.files || [])]; event.target.value = ""; if (files.length) importFiles(files); }); $("#jsonInput").addEventListener("change", event => { const files = [...(event.target.files || [])]; event.target.value = ""; if (files.length) importFiles(files); });
  $("#exportBtn").addEventListener("click", exportLibrary); $("#aboutExport").addEventListener("click", exportLibrary); $("#aboutBtn").addEventListener("click", () => $("#aboutDialog").showModal()); $("#closeAbout").addEventListener("click", () => $("#aboutDialog").close());
  els.search.addEventListener("input", render); els.clearSearch.addEventListener("click", () => { els.search.value = ""; render(); els.search.focus(); }); els.sort.addEventListener("change", render);
  $$(".nav-item[data-view]").forEach(button => button.addEventListener("click", () => { setView(button.dataset.view); els.sidebar.classList.remove("open"); })); $("#categoryNav").addEventListener("click", event => { const button = event.target.closest("[data-category]"); if (!button) return; activeCategory = button.dataset.category; activeView = "all"; quickFilter = "all"; render(); });
  $$(".filter-chip").forEach(button => button.addEventListener("click", () => { quickFilter = button.dataset.filter; if (quickFilter === "favorites") activeView = "favorites"; else if (activeView === "favorites") activeView = "all"; render(); }));
  els.grid.addEventListener("click", event => { const button = event.target.closest("button[data-action]"); if (!button) return; const prompt = findPrompt(button.dataset.id); if (!prompt) return; switch (button.dataset.action) { case "open": openDetail(prompt.id); break; case "copy": copyText(promptTextForClipboard(prompt)); break; case "favorite": prompt.favorite = !prompt.favorite; prompt.updatedAt = new Date().toISOString(); save(); render(); break; case "more": { const action = window.prompt("Enter E to edit, D to delete, or C to cancel.", "E"); if (action?.toLowerCase() === "e") openEditor(prompt); else if (action?.toLowerCase() === "d") void deletePrompt(prompt.id); break; } } });
  $("#gridViewBtn").addEventListener("click", () => { listView = false; els.grid.classList.remove("list-view"); $("#gridViewBtn").classList.add("active"); $("#listViewBtn").classList.remove("active"); }); $("#listViewBtn").addEventListener("click", () => { listView = true; els.grid.classList.add("list-view"); $("#listViewBtn").classList.add("active"); $("#gridViewBtn").classList.remove("active"); });
  const mobileMenu = $("#mobileMenu"), sidebarBackdrop = $("#sidebarBackdrop");
  function setSidebarOpen(open) {
    const shouldOpen = Boolean(open) && window.matchMedia("(max-width: 760px)").matches;
    els.sidebar.classList.toggle("open", shouldOpen);
    mobileMenu.setAttribute("aria-expanded", String(shouldOpen));
    mobileMenu.setAttribute("aria-label", shouldOpen ? "Close navigation" : "Open navigation");
    mobileMenu.querySelector(".menu-glyph").textContent = shouldOpen ? "×" : "☰";
    sidebarBackdrop.hidden = !shouldOpen;
    document.body.classList.toggle("sidebar-open", shouldOpen);
  }
  mobileMenu.addEventListener("click", () => setSidebarOpen(!els.sidebar.classList.contains("open")));
  sidebarBackdrop.addEventListener("click", () => setSidebarOpen(false));
  window.addEventListener("resize", () => { if (!window.matchMedia("(max-width: 760px)").matches) setSidebarOpen(false); });
  els.sidebar.querySelectorAll("a, button").forEach(item => item.addEventListener("click", event => {
    if (event.target.closest("#addCategoryBtn")) return;
    if (window.matchMedia("(max-width: 760px)").matches) setSidebarOpen(false);
  }));
  document.addEventListener("click", event => {
    if (els.sidebar.classList.contains("open") && !els.sidebar.contains(event.target) && !mobileMenu.contains(event.target)) setSidebarOpen(false);
  });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && els.sidebar.classList.contains("open")) { setSidebarOpen(false); mobileMenu.focus(); } });
  document.addEventListener("keydown", event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); els.search.focus(); } if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === "n" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName) && !document.querySelector("dialog[open]")) { event.preventDefault(); openEditor(); } });
  load(); render();
})();
