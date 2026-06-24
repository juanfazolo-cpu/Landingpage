(function () {
  const whatsappButtons = document.querySelectorAll("[data-whatsapp-cta]");

  whatsappButtons.forEach((button) => {
    button.addEventListener("click", () => {
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
})();
