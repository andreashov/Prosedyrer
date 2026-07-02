# Røntgenprosedyrer

En enkel, rask og stilig side for visning av røntgenprosedyrer. Prosedyrene er
organisert etter anatomisk plassering (hode, thorax, abdomen osv.) og delt inn
i **voksen** og **barn**. PDF-dokumentene åpnes direkte i høyre del av siden.

## Bruk

Siden er helt statisk – ingen byggeverktøy eller server kreves:

- Åpne `index.html` direkte i en nettleser, **eller**
- host mappen på en hvilken som helst statisk webserver / GitHub Pages /
  sykehusets intranett.

## Legge til og endre prosedyrer

Alle prosedyrer ligger i [`data.js`](data.js). Hver kategori har en liste for
`voksen` og en for `barn`, og hver prosedyre har et navn og en URL til
sykehusets PDF:

```js
{
  id: "thorax",
  navn: "Thorax",
  ikon: "🫁",
  voksen: [
    { navn: "Rtg Thorax front + side", url: "https://…/rtg-thorax.pdf" },
  ],
  barn: [
    { navn: "Rtg Thorax barn", url: "https://…/rtg-thorax-barn.pdf" },
  ]
}
```

Lagre filen og last siden på nytt – ferdig.

> **Merk:** URL-ene i `data.js` er eksempler. Bytt dem ut med sykehusets
> ekte lenker.

## Viktig om PDF-visning i siden

PDF-ene vises i en innebygd ramme (`iframe`). Dette fungerer så lenge
sykehusets server **tillater innbygging** (dvs. ikke sender
`X-Frame-Options: DENY/SAMEORIGIN` eller en blokkerende
`Content-Security-Policy: frame-ancestors`). Hvis et dokument ikke vises,
er det som regel serveren som blokkerer innbygging – da kan knappen
**«Ny fane»** øverst til høyre brukes for å åpne dokumentet i en egen fane.

## Funksjoner

- Kategorier etter anatomisk plassering, med antall prosedyrer per kategori
- Bryter for **Voksen / Barn** (valget huskes)
- Søk på tvers av alle kategorier med utheving av treff
- PDF-visning i høyre panel, med «Åpne i ny fane» som fallback
- Lyst og mørkt tema (følger systeminnstilling, kan overstyres – huskes)
- Fungerer på mobil og nettbrett
