(function () {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  const header = document.querySelector("[data-header]");
  function updateHeader() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  }
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  const revealEls = document.querySelectorAll("[data-reveal]");
  if (revealEls.length && !prefersReducedMotion) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        });
      },
      { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    revealEls.forEach((el, i) => {
      el.style.setProperty("--stagger", `${Math.min(i, 8) * 45}ms`);
      io.observe(el);
    });
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  /** Wix static: swap /fill/ or /fit/ segment for a larger /fit/ URL (lightbox only). */
  const LIGHTBOX_MAX_SIDE = 1920;

  function wixUrlFit(url, maxSide) {
    if (!url || typeof url !== "string") return url;
    if (!url.includes("static.wixstatic.com")) return url;
    const next = url.replace(
      /\/(fill|fit)\/w_\d+,h_\d+[^/]*/,
      `/fit/w_${maxSide},h_${maxSide},al_c,q_90,usm_0.66_1.00_0.01,enc_avif,quality_auto`
    );
    return next !== url ? next : url;
  }

  function prefetchImage(url) {
    if (!url || typeof url !== "string") return;
    const im = new Image();
    im.decoding = "async";
    im.src = url;
  }

  function imgAspectRatio(img) {
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      return img.naturalWidth / img.naturalHeight;
    }
    const w = Number(img.getAttribute("width"));
    const h = Number(img.getAttribute("height"));
    if (w > 0 && h > 0) return w / h;
    return 1;
  }

  function galleryColCount() {
    if (window.matchMedia("(min-width: 1100px)").matches) return 3;
    if (window.matchMedia("(min-width: 640px)").matches) return 2;
    return 1;
  }

  function sealGalleryOrder(gallery) {
    const direct = Array.from(gallery.querySelectorAll(":scope > .case-fig"));
    if (direct.length) {
      direct.forEach((fig, i) => {
        if (fig.dataset.galleryOrder === undefined) fig.dataset.galleryOrder = String(i);
      });
      return;
    }
    Array.from(gallery.querySelectorAll(".case-fig")).forEach((fig, i) => {
      if (fig.dataset.galleryOrder === undefined) fig.dataset.galleryOrder = String(i);
    });
  }

  function orderedFigures(gallery) {
    return Array.from(gallery.querySelectorAll(".case-fig:not(.is-broken)")).sort(
      (a, b) => Number(a.dataset.galleryOrder) - Number(b.dataset.galleryOrder)
    );
  }

  function balanceCaseGallery(gallery) {
    sealGalleryOrder(gallery);
    const broken = Array.from(gallery.querySelectorAll(".case-fig.is-broken"));
    const ordered = orderedFigures(gallery);
    const colCount = galleryColCount();

    ordered.forEach((fig) => {
      const img = fig.querySelector("img");
      const ar = img ? imgAspectRatio(img) : 1;
      fig.classList.remove("case-fig--landscape", "case-fig--portrait", "case-fig--squarish");
      if (ar >= 1.2) fig.classList.add("case-fig--landscape");
      else if (ar <= 0.85) fig.classList.add("case-fig--portrait");
      else fig.classList.add("case-fig--squarish");
    });

    if (colCount === 1) {
      gallery.replaceChildren(...ordered, ...broken);
      gallery.classList.remove("case-gallery--masonry");
      gallery.classList.add("case-gallery--stack");
      return;
    }

    const heights = Array(colCount).fill(0);
    const cols = heights.map(() => {
      const el = document.createElement("div");
      el.className = "case-gallery__col";
      return el;
    });

    ordered.forEach((fig) => {
      const img = fig.querySelector("img");
      const ar = img ? imgAspectRatio(img) : 1;
      const est = 1 / ar;
      let pick = 0;
      let min = heights[0];
      for (let c = 1; c < colCount; c += 1) {
        if (heights[c] < min) {
          min = heights[c];
          pick = c;
        }
      }
      heights[pick] += est;
      cols[pick].appendChild(fig);
    });

    gallery.replaceChildren(...cols);
    broken.forEach((fig) => gallery.appendChild(fig));
    gallery.classList.add("case-gallery--masonry");
    gallery.classList.remove("case-gallery--stack");
  }

  let balanceGalleriesTimer = 0;
  function scheduleBalanceCaseGalleries() {
    clearTimeout(balanceGalleriesTimer);
    balanceGalleriesTimer = window.setTimeout(() => {
      document.querySelectorAll(".case-gallery").forEach(balanceCaseGallery);
    }, 140);
  }

  function initCaseGalleryLightbox() {
    const galleries = document.querySelectorAll(".case-gallery");
    if (!galleries.length) return;

    galleries.forEach((gallery) => {
      gallery.querySelectorAll(".case-fig img").forEach((img) => {
        const orig = (img.getAttribute("src") || img.src || "").trim();
        img.setAttribute("data-original-src", orig);
        img.setAttribute("data-full-src", wixUrlFit(orig, LIGHTBOX_MAX_SIDE));
        img.addEventListener(
          "error",
          () => {
            const fig = img.closest(".case-fig");
            if (fig) fig.classList.add("is-broken");
            scheduleBalanceCaseGalleries();
          },
          { once: true }
        );
        img.addEventListener("load", () => scheduleBalanceCaseGalleries(), { passive: true });
      });
    });

    const lb = document.createElement("div");
    lb.className = "lightbox";
    lb.id = "gallery-lightbox";
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    lb.setAttribute("aria-label", "Image slideshow");
    lb.innerHTML = [
      '<div class="lightbox__backdrop" tabindex="-1" aria-hidden="true"></div>',
      '<button type="button" class="lightbox__close" aria-label="Close gallery">×</button>',
      '<div class="lightbox__inner">',
      '  <div class="lightbox__stage">',
      '    <button type="button" class="lightbox__btn lightbox__btn--prev" aria-label="Previous image">‹</button>',
      '    <div class="lightbox__img-wrap"><img class="lightbox__img" alt="" decoding="async" /></div>',
      '    <button type="button" class="lightbox__btn lightbox__btn--next" aria-label="Next image">›</button>',
      "  </div>",
      '  <p class="lightbox__counter"></p>',
      "</div>",
    ].join("");

    lb.setAttribute("aria-hidden", "true");
    document.body.appendChild(lb);

    const imgEl = lb.querySelector(".lightbox__img");
    const counterEl = lb.querySelector(".lightbox__counter");
    const btnPrev = lb.querySelector(".lightbox__btn--prev");
    const btnNext = lb.querySelector(".lightbox__btn--next");
    const btnClose = lb.querySelector(".lightbox__close");
    const backdrop = lb.querySelector(".lightbox__backdrop");

    let list = [];
    let index = 0;
    let loadGen = 0;

    function sourcesFromGallery(gallery) {
      return orderedFigures(gallery).map((fig) => {
        const im = fig.querySelector("img");
        const preview = im.getAttribute("data-original-src") || im.src;
        const full = im.getAttribute("data-full-src") || preview;
        return { preview, full };
      });
    }

    function show(i) {
      if (!list.length) return;
      index = (i + list.length) % list.length;
      const item = list[index];
      const gen = ++loadGen;
      counterEl.textContent = `${index + 1} / ${list.length}`;

      imgEl.classList.remove("is-upgrading");
      imgEl.src = item.preview;

      function afterUpgrade() {
        if (gen !== loadGen) return;
        imgEl.classList.remove("is-upgrading");
        prefetchImage(list[(index + 1) % list.length].full);
        prefetchImage(list[(index - 1 + list.length) % list.length].full);
      }

      if (item.full === item.preview) {
        afterUpgrade();
        return;
      }

      imgEl.classList.add("is-upgrading");
      const loader = new Image();
      loader.decoding = "async";
      loader.onload = () => {
        if (gen !== loadGen) return;
        imgEl.src = item.full;
        afterUpgrade();
      };
      loader.onerror = () => {
        if (gen !== loadGen) return;
        afterUpgrade();
      };
      loader.src = item.full;
    }

    function open(gallery, startIndex) {
      list = sourcesFromGallery(gallery);
      if (!list.length) return;
      index = startIndex;
      show(index);
      lb.classList.add("is-open");
      lb.setAttribute("aria-hidden", "false");
      document.documentElement.classList.add("lightbox-open");
      document.body.classList.add("lightbox-open");
      btnClose.focus();
    }

    function close() {
      loadGen += 1;
      lb.classList.remove("is-open");
      lb.setAttribute("aria-hidden", "true");
      document.documentElement.classList.remove("lightbox-open");
      document.body.classList.remove("lightbox-open");
      imgEl.classList.remove("is-upgrading");
      imgEl.removeAttribute("src");
    }

    galleries.forEach((gallery) => {
      gallery.querySelectorAll(".case-fig").forEach((fig) => {
        fig.setAttribute("role", "button");
        fig.setAttribute("tabindex", "0");
        fig.setAttribute("aria-label", "View image in slideshow");
      });

      function visibleFigs() {
        return orderedFigures(gallery);
      }

      gallery.addEventListener("click", (e) => {
        const fig = e.target.closest(".case-fig");
        if (!fig || !gallery.contains(fig) || fig.classList.contains("is-broken")) return;
        if (e.target.closest("a")) return;
        e.preventDefault();
        const items = visibleFigs();
        const i = items.indexOf(fig);
        if (i < 0) return;
        open(gallery, i);
      });

      gallery.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const fig = e.target.closest(".case-fig");
        if (!fig || !gallery.contains(fig) || fig.classList.contains("is-broken")) return;
        e.preventDefault();
        const items = visibleFigs();
        const i = items.indexOf(fig);
        if (i < 0) return;
        open(gallery, i);
      });
    });

    btnPrev.addEventListener("click", () => show(index - 1));
    btnNext.addEventListener("click", () => show(index + 1));
    btnClose.addEventListener("click", close);
    backdrop.addEventListener("click", close);

    lb.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") show(index - 1);
      if (e.key === "ArrowRight") show(index + 1);
    });

    galleries.forEach((g) => sealGalleryOrder(g));
    scheduleBalanceCaseGalleries();
    window.addEventListener("load", () => scheduleBalanceCaseGalleries(), { passive: true });
    window.addEventListener("resize", () => scheduleBalanceCaseGalleries(), { passive: true });
  }

  initCaseGalleryLightbox();
})();
