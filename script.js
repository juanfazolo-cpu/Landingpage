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

  function getUrlParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch (error) {
      return null;
    }
  }

  const leadForm = document.getElementById("lead-form");

  if (leadForm) {
    const statusEl = document.getElementById("lead-form-status");
    const submitButton = document.getElementById("lead-form-submit");

    function setLeadStatus(message, type) {
      if (!statusEl) {
        return;
      }
      statusEl.hidden = !message;
      statusEl.textContent = message || "";
      statusEl.classList.remove("is-error", "is-success");
      if (type) {
        statusEl.classList.add(type);
      }
    }

    leadForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const formData = new FormData(leadForm);
      const email = String(formData.get("email") || "").trim();
      const consent = formData.get("consent_email") === "1";

      if (!email) {
        setLeadStatus("Informe um e-mail válido.", "is-error");
        return;
      }

      if (!consent) {
        setLeadStatus("Marque o consentimento para receber e-mails.", "is-error");
        return;
      }

      const payload = {
        name: String(formData.get("name") || "").trim(),
        email,
        phone: String(formData.get("phone") || "").trim(),
        company: String(formData.get("company") || "").trim(),
        consent_email: true,
        source: "landing-contato",
        page_url: window.location.href,
        referrer: document.referrer || null,
        utm_source: getUrlParam("utm_source"),
        utm_medium: getUrlParam("utm_medium"),
        utm_campaign: getUrlParam("utm_campaign"),
        utm_content: getUrlParam("utm_content"),
        utm_term: getUrlParam("utm_term"),
      };

      submitButton.disabled = true;
      setLeadStatus("Enviando...", null);

      try {
        const response = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(result.error || "Falha ao cadastrar");
        }

        leadForm.reset();
        setLeadStatus("Pronto! Você entrou na lista da Taldo.", "is-success");

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          event: "email_signup",
          source: payload.source,
          page_location: window.location.href,
        });

        if (typeof window.gtag === "function") {
          window.gtag("event", "email_signup", {
            event_category: "lead",
            event_label: payload.source,
            transport_type: "beacon",
          });
        }
      } catch (error) {
        setLeadStatus(
          error && error.message ? error.message : "Não foi possível cadastrar agora. Tente de novo.",
          "is-error"
        );
      } finally {
        submitButton.disabled = false;
      }
    });
  }

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
