# Røntgenprosedyrer

En enkel, rask og stilig side for visning av røntgenprosedyrer ved Sykehuset
Østfold. Prosedyrene er organisert etter anatomisk plassering og delt inn i
**voksen** og **barn**. PDF-dokumentene åpnes direkte i høyre del av siden.

**Siden er publisert her: <https://andreashov.github.io/Prosedyrer/>**

## Legge til og endre prosedyrer

Alle prosedyrer ligger i [`prosedyrer_rontgen.json`](prosedyrer_rontgen.json).
Hver kategori har et navn, en pasienttype (`voksen` eller `barn`) og en liste
med prosedyrer (navn + URL til sykehusets PDF):

```json
{
  "kategori": "Thorax / Abdomen",
  "type": "pasient",
  "pasienttype": "voksen",
  "prosedyrer": [
    { "navn": "RG Thorax / Cor", "url": "https://…/DOK14399.pdf" }
  ]
}
```

Kategorier med `"type": "administrativ"` vises i en egen seksjon nederst i
menyen, uavhengig av voksen/barn-valget.

Rediger filen direkte på GitHub (blyantikonet) og commit til `main` – siden
publiseres automatisk på nytt i løpet av et par minutter.

## Publisering (GitHub Pages)

Siden publiseres automatisk til GitHub Pages av workflowen i
[`.github/workflows/pages.yml`](.github/workflows/pages.yml) hver gang det
pushes til `main`. Ingen byggeverktøy kreves – siden er ren HTML/CSS/JS.

## Viktig om PDF-visning i siden

PDF-ene vises i en innebygd ramme (`iframe`). Dette fungerer så lenge
dokumentserveren **tillater innbygging** (dvs. ikke sender
`X-Frame-Options: DENY/SAMEORIGIN` eller en blokkerende
`Content-Security-Policy: frame-ancestors`). Hvis et dokument ikke vises,
bruk knappen **«Ny fane»** øverst til høyre for å åpne det i en egen fane.

## Funksjoner

- Kategorier etter anatomisk plassering, med antall prosedyrer per kategori
- Bryter for **Voksen / Barn** (valget huskes)
- Egen seksjon for administrative prosedyrer
- Søk på tvers av alle kategorier med utheving av treff
- PDF-visning i høyre panel, med «Åpne i ny fane» som fallback
- Lyst og mørkt tema (følger systeminnstilling, kan overstyres – huskes)
- Fungerer på mobil og nettbrett
