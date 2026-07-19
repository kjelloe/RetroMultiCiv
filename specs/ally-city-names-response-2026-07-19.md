# Designer-ally response — city-name expansion (11b, 2026-07-19)

Verbatim ally copy answering `ally-city-names-request-2026-07-19.md`. Each list is
APPENDED after the civ's existing `cities` in `data/civs.json` (8 additions per civ,
9 for Aztecs/Mongols, → 16 total each). Printable ASCII, no cross-civ collisions, no
intra-civ repeats.

## Appended names (per civ, in order)

- **Romans** (+8): Mediolanum, Capua, Brundisium, Aquileia, Florentia, Tarentum, Caesarea, Leptis Magna
- **Babylonians** (+8): Nippur, Sippar, Kish, Larsa, Umma, Mari, Eshnunna, Nimrud
- **Germans** (+8): Munich, Dresden, Stuttgart, Hannover, Mainz, Augsburg, Magdeburg, Worms
- **Egyptians** (+8): Luxor, Edfu, Abydos, Amarna, Tanis, Bubastis, Sais, Pelusium
- **Americans** (+8): New Orleans, Los Angeles, Seattle, Denver, Detroit, San Francisco, Dallas, Cincinnati
- **Greeks** (+8): Olympia, Miletus, Ephesus, Pergamon, Thessalonika, Piraeus, Chalcis, Plataea
- **Indians** (+8): Varanasi, Agra, Jaipur, Hyderabad, Patna, Mysore, Surat, Taxila
- **Russians** (+8): Novgorod, Kazan, Yaroslavl, Vladivostok, Volgograd, Novosibirsk, Rostov, Perm
- **Zulus** (+8): Eshowe, Ondini, Nongoma, Nqutu, Vryheid, Mthatha, Empangeni, Mtubatuba
- **French** (+8): Marseilles, Nantes, Strasbourg, Lille, Reims, Dijon, Toulouse, Arles
- **Aztecs** (+9): Cholula, Tula, Xochimilco, Azcapotzalco, Malinalco, Cuauhnahuac, Teopanzolco, Huexotla, Calixtlahuaca
- **Chinese** (+8): Chungking, Sian, Chengtu, Wuhan, Soochow, Foochow, Kunming, Nanchang
- **English** (+8): Manchester, Leeds, Bristol, Oxford, Canterbury, Winchester, Exeter, Leicester
- **Mongols** (+9): Urgench, Merv, Herat, Tashkent, Balkh, Astrakhan, Turfan, Dunhuang, Sarai

## Ally notes (collision audit)
- Thebes stays Egyptian; Greeks get Plataea/Chalcis/Olympia instead.
- Lyons stays French; Romans get the Latin Mediolanum (Milan), not a Gallicized form.
- Londinium skipped (English hold London); Romans get Brundisium/Aquileia.
- Khanbaliq skipped (Chinese have Peking); Mongols get Sarai/Urgench/etc.
- Strasbourg is French only; Germans get Mainz/Worms/Augsburg.

## Implementation
Append to each civ's `cities` array in `data/civs.json` (hand-maintained). Behaviorally
NEUTRAL (names only, no yields/effects) → small golden re-record (createGame/A82a/002
rulesetHash pins move; VERIFY natural rounds/winner unchanged — name lookup touches the
city-spawn path). Cross-platform (browser + Roblox read civs.json). Provenance: original
data curation.
