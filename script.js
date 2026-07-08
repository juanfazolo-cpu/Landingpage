(function () {
  const PROMO_POPUP_STORAGE_KEY = "taldo-promo-popup-seen";
  const PROMO_POPUP_DELAY_MS = 2500;

  const promoPopup = document.getElementById("promo-popup");

  if (promoPopup) {
    const closeButton = promoPopup.querySelector(".promo-popup-close");
    const dismissButton = promoPopup.querySelector(".promo-popup-dismiss");
    const dialog = promoPopup.querySelector(".promo-popup-dialog");
    let popupTimerId = null;

    function closePromoPopup(markAsSeen) {
      if (popupTimerId !== null) {
        window.clearTimeout(popupTimerId);
        popupTimerId = null;
      }

      promoPopup.hidden = true;
      promoPopup.setAttribute("aria-hidden", "true");

      if (markAsSeen) {
        try {
          window.localStorage.setItem(PROMO_POPUP_STORAGE_KEY, "1");
        } catch (error) {
          // Ignore storage errors in private mode or restricted browsers.
        }
      }
    }

    function openPromoPopup() {
      promoPopup.hidden = false;
      promoPopup.setAttribute("aria-hidden", "false");
    }

    function shouldShowPromoPopup() {
      try {
        return !window.localStorage.getItem(PROMO_POPUP_STORAGE_KEY);
      } catch (error) {
        return true;
      }
    }

    if (shouldShowPromoPopup()) {
      popupTimerId = window.setTimeout(openPromoPopup, PROMO_POPUP_DELAY_MS);
    }

    closeButton.addEventListener("click", () => closePromoPopup(true));
    dismissButton.addEventListener("click", () => closePromoPopup(true));

    promoPopup.addEventListener("click", (event) => {
      if (event.target === promoPopup) {
        closePromoPopup(true);
      }
    });

    dialog.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !promoPopup.hidden) {
        closePromoPopup(true);
      }
    });
  }

  const whatsappButtons = document.querySelectorAll("[data-whatsapp-cta]");

  whatsappButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.classList.contains("promo-popup-cta")) {
        try {
          window.localStorage.setItem(PROMO_POPUP_STORAGE_KEY, "1");
        } catch (error) {
          // Ignore storage errors in private mode or restricted browsers.
        }
      }

      const eventPayload = {
        event: "whatsapp_budget_click",
        cta_label: button.dataset.ctaLabel || "sem-label",
        page_location: window.location.href,
      };

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(eventPayload);

      if (typeof window.gtag === "function") {
        window.gtag("event", "whatsapp_budget_click", {
          event_category: "lead",
          event_label: eventPayload.cta_label,
          transport_type: "beacon",
        });
      }

      if (window.console && typeof window.console.info === "function") {
        window.console.info("WhatsApp CTA tracked", eventPayload);
      }
    });
  });

  const lightbox = document.getElementById("lightbox");

  if (lightbox) {
    const lightboxImage = lightbox.querySelector(".lightbox-content img");
    const lightboxCaption = lightbox.querySelector(".lightbox-content figcaption");
    const closeButton = lightbox.querySelector(".lightbox-close");
    const galleryCards = document.querySelectorAll("[data-lightbox]");

    function closeLightbox() {
      lightbox.hidden = true;
      lightbox.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    function openLightbox(card) {
      const image = card.querySelector("img");
      const caption = card.querySelector("figcaption");

      if (!image) {
        return;
      }

      lightboxImage.src = image.src;
      lightboxImage.alt = image.alt;
      lightboxCaption.textContent = caption ? caption.textContent : image.alt;
      lightbox.hidden = false;
      lightbox.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    galleryCards.forEach((card) => {
      card.addEventListener("click", () => openLightbox(card));
    });

    closeButton.addEventListener("click", closeLightbox);

    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) {
        closeLightbox();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !lightbox.hidden) {
        closeLightbox();
      }
    });
  }
})();
