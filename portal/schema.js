"use strict";

(() => {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://gervasio.sbs/#website",
        url: "https://gervasio.sbs/",
        name: "Portafolio de Gervasio Torres",
        inLanguage: "es-CL",
      },
      {
        "@type": "Person",
        "@id": "https://gervasio.sbs/#gervasio-torres",
        name: "Gervasio Torres Soza",
        url: "https://gervasio.sbs/",
        image: "https://gervasio.sbs/capturas/gervasio-social.jpg",
        jobTitle: "Analista Programador y egresado de Ingeniería Informática",
        sameAs: ["https://github.com/Gervasio02"],
        knowsAbout: [
          "Desarrollo web full stack",
          "React",
          "TypeScript",
          "Python",
          "Node.js",
          "PostgreSQL",
          "Pruebas automatizadas",
          "Docker",
        ],
      },
      {
        "@type": "ProfilePage",
        "@id": "https://gervasio.sbs/#profile",
        url: "https://gervasio.sbs/",
        name: "Gervasio Torres · Portafolio",
        mainEntity: { "@id": "https://gervasio.sbs/#gervasio-torres" },
        isPartOf: { "@id": "https://gervasio.sbs/#website" },
        inLanguage: "es-CL",
      },
    ],
  };

  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(structuredData);
  document.head.append(script);
})();
