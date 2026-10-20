(() => {
  "use strict";
  const canonicalOrigin = "https://prompt-arch-orpin.vercel.app";
  if (window.location.hostname === "prompt-arch.pages.dev") {
    const target = new URL(
      window.location.pathname + window.location.search + window.location.hash,
      canonicalOrigin
    );
    window.location.replace(target.href);
  }
})();
