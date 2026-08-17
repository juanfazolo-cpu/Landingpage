(function () {
  const PROMO_POPUP_STORAGE_KEY = "taldo-promo-popup-seen";
  const PROMO_POPUP_DELAY_MS = 2500;
  const WHATSAPP_BASE = "https://wa.me/5511910634551?text=";
  const WHATSAPP_10 =
    "Olá! Vim pelo site e quero usar meu desconto de 10% na primeira compra.";
  const WHATSAPP_15 =
    "Olá! Me cadastrei no site e quero usar meu desconto de 15% (10% + 5%) na primeira compra.";

  function getUrlParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch (error) {
      return null;
    }
  }

  function markPromoSeen() {
    try {
      window.localStorage.setItem(PROMO_POPUP_STORAGE_KEY, "1");
    } catch (error) {
      // Ignore storage errors in private mode or restricted browsers.
    }
  }

  function trackEvent(eventName, payload) {
    const eventPayload = Object.assign(
      {
        event: eventName,
        page_location: window.location.href,
      },
      payload || {}
    );

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(eventPayload);

    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, {
        event_category: "lead",
        event_label: payload && payload.cta_label ? payload.cta_label : eventName,
        transport_type: "beacon",
      });
    }
  }

  function openWhatsApp(message) {
    window.open(WHATSAPP_BASE + encodeURIComponent(message), "_blank", "noopener,noreferrer");
  }

  async function submitLead(form, options) {
    const formData = new FormData(form);
    const email = String(formData.get("email") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const consent = formData.get("consent_email") === "1";
    const requirePhone = Boolean(options && options.requirePhone);

    if (!email) {
      throw new Error("Informe um e-mail válido.");
    }

    if (requirePhone && !phone) {
      throw new Error("Informe seu WhatsApp / telefone.");
    }

    if (!consent) {
      throw new Error("Marque o consentimento para receber e-mails.");
    }

    const payload = {
      name,
      email,
      phone,
      company: String(formData.get("company") || "").trim(),
      consent_email: true,
      source: (options && options.source) || "landing",
      page_url: window.location.href,
      referrer: document.referrer || null,
      utm_source: getUrlParam("utm_source"),
      utm_medium: getUrlParam("utm_medium"),
      utm_campaign: getUrlParam("utm_campaign"),
      utm_content: getUrlParam("utm_content"),
      utm_term: getUrlParam("utm_term"),
    };

    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(result.detail || result.error || "Falha ao cadastrar");
        }

    trackEvent("email_signup", {
      source: payload.source,
      cta_label: payload.source,
    });

    return result;
  }

  function bindLeadForm(form, config) {
    if (!form) {
      return;
    }

    const statusEl = document.getElementById(config.statusId);
    const submitButton = document.getElementById(config.submitId);

    function setStatus(message, type) {
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

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (submitButton) {
        submitButton.disabled = true;
      }
      setStatus("Enviando...", null);

      try {
        await submitLead(form, {
          source: config.source,
          requirePhone: config.requirePhone,
        });

        form.reset();
        setStatus(config.successMessage, "is-success");

        if (typeof config.onSuccess === "function") {
          config.onSuccess();
        }
      } catch (error) {
        setStatus(
          error && error.message ? error.message : "Não foi possível cadastrar agora. Tente de novo.",
          "is-error"
        );
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
        }
      }
    });
  }

  const promoPopup = document.getElementById("promo-popup");

  if (promoPopup) {
    const closeButton = promoPopup.querySelector(".promo-popup-close");
    const dismissButton = promoPopup.querySelector(".promo-popup-dismiss");
    const skipLink = promoPopup.querySelector(".promo-popup-skip");
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
        markPromoSeen();
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

    if (skipLink) {
      skipLink.addEventListener("click", () => {
        markPromoSeen();
        trackEvent("whatsapp_budget_click", {
          cta_label: "popup-desconto-10-sem-cadastro",
          discount: "10",
        });
      });
    }

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

    bindLeadForm(document.getElementById("promo-lead-form"), {
      statusId: "promo-lead-status",
      submitId: "promo-lead-submit",
      source: "popup-desconto-15",
      requirePhone: true,
      successMessage: "Cadastro ok! Abrindo o WhatsApp com 15%...",
      onSuccess: function () {
        markPromoSeen();
        trackEvent("whatsapp_budget_click", {
          cta_label: "popup-desconto-15-com-cadastro",
          discount: "15",
        });
        openWhatsApp(WHATSAPP_15);
        window.setTimeout(function () {
          closePromoPopup(true);
        }, 600);
      },
    });
  }

  const whatsappButtons = document.querySelectorAll("[data-whatsapp-cta]");

  whatsappButtons.forEach((button) => {
    if (button.classList.contains("promo-popup-skip")) {
      return;
    }

    button.addEventListener("click", () => {
      trackEvent("whatsapp_budget_click", {
        cta_label: button.dataset.ctaLabel || "sem-label",
      });
    });
  });

  bindLeadForm(document.getElementById("lead-form"), {
    statusId: "lead-form-status",
    submitId: "lead-form-submit",
    source: "landing-contato",
    requirePhone: false,
    successMessage: "Pronto! Você entrou na lista da Taldo.",
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
