# Røntgenprosedyrer

En enkel, rask og stilig side for visning av røntgenprosedyrer ved Sykehuset
Østfold. Prosedyrene er organisert i kort per kroppsregion, med **voksen** og
**barn** synlig side om side. Dokumentene åpnes i ett felles dokumentvindu i
full skjermstørrelse som gjenbrukes for hver prosedyre.

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

## Hvorfor eget dokumentvindu?

Sykehusets dokumentserver sender forespørsler via innloggingstjenesten (SSO),
og nettleseren nekter å dele innloggingen med rammer som er innebygd i sider
fra andre domener (SameSite-regelen). Innebygd visning på selve siden er
derfor ikke mulig så lenge siden hostes på GitHub Pages. I stedet åpnes
dokumentene i ett navngitt vindu i full skjermstørrelse som gjenbrukes for
hver prosedyre – det blir aldri mer enn ett dokumentvindu.

Skulle siden senere flyttes til sykehusets eget nett (samme «site» som
dokumentserveren), kan innebygd visning gjeninnføres. Siden er fire statiske
filer og kan flyttes dit uendret.

## Funksjoner

- Kort per kroppsregion med **Voksen og Barn synlig samtidig**
- Eget kort for administrative prosedyrer («Direkte»)
- Søk på tvers av alt med utheving av treff; kort uten treff skjules
- Dokumentene åpnes i ett gjenbrukt dokumentvindu i full skjermstørrelse
- Varsel når sykehusets dokumentserver ikke nås (utenfor sykehusnettet)
- Lyst og mørkt tema (følger systeminnstilling, kan overstyres – huskes)
- Fungerer på mobil og nettbrett
