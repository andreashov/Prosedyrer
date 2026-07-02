/*
 * Prosedyredata for røntgenprosedyre-viseren.
 *
 * Slik legger du til/endrer prosedyrer:
 *  - Hver kategori har en "id", et "navn" og et "ikon" (emoji).
 *  - Hver kategori har to lister: "voksen" og "barn".
 *  - Hver prosedyre har et "navn" og en "url" som peker til sykehusets PDF.
 *
 * URL-ene under er eksempler – bytt dem ut med sykehusets ekte lenker.
 */
const PROSEDYRE_DATA = {
  kategorier: [
    {
      id: "hode",
      navn: "Hode / Hals",
      ikon: "🧠",
      voksen: [
        { navn: "CT Caput", url: "https://eksempel.sykehus.no/prosedyrer/ct-caput.pdf" },
        { navn: "CT Caput med kontrast", url: "https://eksempel.sykehus.no/prosedyrer/ct-caput-kontrast.pdf" },
        { navn: "CT Ansikt / Bihuler", url: "https://eksempel.sykehus.no/prosedyrer/ct-bihuler.pdf" },
        { navn: "CT Collum", url: "https://eksempel.sykehus.no/prosedyrer/ct-collum.pdf" },
        { navn: "CT Angio intrakranielt", url: "https://eksempel.sykehus.no/prosedyrer/ct-angio-intrakranielt.pdf" },
        { navn: "Rtg Bihuler", url: "https://eksempel.sykehus.no/prosedyrer/rtg-bihuler.pdf" }
      ],
      barn: [
        { navn: "CT Caput barn", url: "https://eksempel.sykehus.no/prosedyrer/ct-caput-barn.pdf" },
        { navn: "Rtg Bihuler barn", url: "https://eksempel.sykehus.no/prosedyrer/rtg-bihuler-barn.pdf" }
      ]
    },
    {
      id: "thorax",
      navn: "Thorax",
      ikon: "🫁",
      voksen: [
        { navn: "Rtg Thorax front + side", url: "https://eksempel.sykehus.no/prosedyrer/rtg-thorax.pdf" },
        { navn: "Rtg Thorax liggende", url: "https://eksempel.sykehus.no/prosedyrer/rtg-thorax-liggende.pdf" },
        { navn: "CT Thorax", url: "https://eksempel.sykehus.no/prosedyrer/ct-thorax.pdf" },
        { navn: "CT Thorax lavdose", url: "https://eksempel.sykehus.no/prosedyrer/ct-thorax-lavdose.pdf" },
        { navn: "CT Lungeemboli (LE-protokoll)", url: "https://eksempel.sykehus.no/prosedyrer/ct-le.pdf" },
        { navn: "Rtg Ribben", url: "https://eksempel.sykehus.no/prosedyrer/rtg-ribben.pdf" }
      ],
      barn: [
        { navn: "Rtg Thorax barn", url: "https://eksempel.sykehus.no/prosedyrer/rtg-thorax-barn.pdf" },
        { navn: "Rtg Thorax nyfødt", url: "https://eksempel.sykehus.no/prosedyrer/rtg-thorax-nyfodt.pdf" },
        { navn: "CT Thorax barn", url: "https://eksempel.sykehus.no/prosedyrer/ct-thorax-barn.pdf" }
      ]
    },
    {
      id: "abdomen",
      navn: "Abdomen",
      ikon: "🩻",
      voksen: [
        { navn: "Rtg Oversikt abdomen", url: "https://eksempel.sykehus.no/prosedyrer/rtg-oversikt-abdomen.pdf" },
        { navn: "CT Abdomen", url: "https://eksempel.sykehus.no/prosedyrer/ct-abdomen.pdf" },
        { navn: "CT Abdomen 3-fase (lever)", url: "https://eksempel.sykehus.no/prosedyrer/ct-abdomen-3fase.pdf" },
        { navn: "CT Urinveier (stein)", url: "https://eksempel.sykehus.no/prosedyrer/ct-urinveier.pdf" },
        { navn: "CT Colografi", url: "https://eksempel.sykehus.no/prosedyrer/ct-colografi.pdf" }
      ],
      barn: [
        { navn: "Rtg Oversikt abdomen barn", url: "https://eksempel.sykehus.no/prosedyrer/rtg-abdomen-barn.pdf" },
        { navn: "Ultralyd-henvisning barn (invaginasjon)", url: "https://eksempel.sykehus.no/prosedyrer/ul-invaginasjon-barn.pdf" }
      ]
    },
    {
      id: "bekken",
      navn: "Bekken / Hofte",
      ikon: "🦴",
      voksen: [
        { navn: "Rtg Bekken", url: "https://eksempel.sykehus.no/prosedyrer/rtg-bekken.pdf" },
        { navn: "Rtg Hofte", url: "https://eksempel.sykehus.no/prosedyrer/rtg-hofte.pdf" },
        { navn: "CT Bekken", url: "https://eksempel.sykehus.no/prosedyrer/ct-bekken.pdf" }
      ],
      barn: [
        { navn: "Rtg Hofte barn (Lauenstein)", url: "https://eksempel.sykehus.no/prosedyrer/rtg-hofte-barn.pdf" },
        { navn: "Rtg Bekken barn", url: "https://eksempel.sykehus.no/prosedyrer/rtg-bekken-barn.pdf" }
      ]
    },
    {
      id: "columna",
      navn: "Columna",
      ikon: "🦷",
      voksen: [
        { navn: "Rtg Cervicalcolumna", url: "https://eksempel.sykehus.no/prosedyrer/rtg-cervical.pdf" },
        { navn: "Rtg Thoracalcolumna", url: "https://eksempel.sykehus.no/prosedyrer/rtg-thoracal.pdf" },
        { navn: "Rtg Lumbalcolumna", url: "https://eksempel.sykehus.no/prosedyrer/rtg-lumbal.pdf" },
        { navn: "CT Columna traume", url: "https://eksempel.sykehus.no/prosedyrer/ct-columna-traume.pdf" },
        { navn: "Rtg Scoliose (helryggsbilde)", url: "https://eksempel.sykehus.no/prosedyrer/rtg-scoliose.pdf" }
      ],
      barn: [
        { navn: "Rtg Scoliose barn", url: "https://eksempel.sykehus.no/prosedyrer/rtg-scoliose-barn.pdf" }
      ]
    },
    {
      id: "overex",
      navn: "Overekstremitet",
      ikon: "💪",
      voksen: [
        { navn: "Rtg Skulder", url: "https://eksempel.sykehus.no/prosedyrer/rtg-skulder.pdf" },
        { navn: "Rtg Clavicula", url: "https://eksempel.sykehus.no/prosedyrer/rtg-clavicula.pdf" },
        { navn: "Rtg Humerus", url: "https://eksempel.sykehus.no/prosedyrer/rtg-humerus.pdf" },
        { navn: "Rtg Albue", url: "https://eksempel.sykehus.no/prosedyrer/rtg-albue.pdf" },
        { navn: "Rtg Underarm", url: "https://eksempel.sykehus.no/prosedyrer/rtg-underarm.pdf" },
        { navn: "Rtg Håndledd", url: "https://eksempel.sykehus.no/prosedyrer/rtg-handledd.pdf" },
        { navn: "Rtg Hånd / Fingre", url: "https://eksempel.sykehus.no/prosedyrer/rtg-hand.pdf" },
        { navn: "Rtg Scaphoid", url: "https://eksempel.sykehus.no/prosedyrer/rtg-scaphoid.pdf" }
      ],
      barn: [
        { navn: "Rtg Albue barn", url: "https://eksempel.sykehus.no/prosedyrer/rtg-albue-barn.pdf" },
        { navn: "Rtg Håndledd barn", url: "https://eksempel.sykehus.no/prosedyrer/rtg-handledd-barn.pdf" },
        { navn: "Rtg Skjelettalder (venstre hånd)", url: "https://eksempel.sykehus.no/prosedyrer/rtg-skjelettalder.pdf" }
      ]
    },
    {
      id: "underex",
      navn: "Underekstremitet",
      ikon: "🦵",
      voksen: [
        { navn: "Rtg Femur", url: "https://eksempel.sykehus.no/prosedyrer/rtg-femur.pdf" },
        { navn: "Rtg Kne", url: "https://eksempel.sykehus.no/prosedyrer/rtg-kne.pdf" },
        { navn: "Rtg Kne belastet", url: "https://eksempel.sykehus.no/prosedyrer/rtg-kne-belastet.pdf" },
        { navn: "Rtg Legg (crus)", url: "https://eksempel.sykehus.no/prosedyrer/rtg-crus.pdf" },
        { navn: "Rtg Ankel", url: "https://eksempel.sykehus.no/prosedyrer/rtg-ankel.pdf" },
        { navn: "Rtg Fot / Tær", url: "https://eksempel.sykehus.no/prosedyrer/rtg-fot.pdf" },
        { navn: "Rtg Calcaneus", url: "https://eksempel.sykehus.no/prosedyrer/rtg-calcaneus.pdf" }
      ],
      barn: [
        { navn: "Rtg Kne barn", url: "https://eksempel.sykehus.no/prosedyrer/rtg-kne-barn.pdf" },
        { navn: "Rtg Ankel barn", url: "https://eksempel.sykehus.no/prosedyrer/rtg-ankel-barn.pdf" },
        { navn: "Rtg Totalskjelett (barnemishandling)", url: "https://eksempel.sykehus.no/prosedyrer/rtg-totalskjelett-barn.pdf" }
      ]
    }
  ]
};
