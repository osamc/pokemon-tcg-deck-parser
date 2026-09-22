# pokemon-tcg-deck-parser

Parse Pokémon TCG Live (`ptcgl`) and Limitless (`limitless`) deck exports, then look up the cards through the [TCGdex TypeScript SDK](https://tcgdex.dev/sdks/typescript).

The library is built to be reused across projects: parsing is synchronous and local, lookups are cached, and the API is queried per **unique set** rather than once per card.

## Install

```bash
npm i pokemon-tcg-deck-parser
```

## Usage

```ts
import { DeckParser, parseDecklist, detectFormat } from "pokemon-tcg-deck-parser";

const parser = new DeckParser({
  lang: "en",
  cacheTTL: 60 * 60 * 24, // 24h SDK cache
  concurrency: 4,         // max parallel TCGdex requests
  hydrate: "resume",      // or "full" for complete card objects
});

const deck = await parser.parseAndResolve(`
Pokémon: 2
3 Chien-Pao ex PAL 61
1 Nest Ball SVI 181
Energy: 1
2 Basic {W} Energy SVE 11
Total Cards: 6
`);

deck.cards.forEach((entry) => {
  console.log(entry.quantity, entry.name, entry.tcgdexId, entry.card?.image);
});
```

Share one parser instance across a process so set lists, abbreviation maps, and SDK responses stay cached.

## Debug web app

```bash
npm run dev
```

Serves a small tester at [http://localhost:5174](http://localhost:5174). Paste a decklist (or load a sample), parse locally, or resolve through TCGdex and inspect cards, warnings, and debug JSON.

## Parse without hitting the API

```ts
const parsed = parseDecklist(text); // or parser.parse(text)
const format = detectFormat(text);  // "ptcgl" | "limitless" | "unknown"
```

## Reuse an existing TCGdex client

```ts
import TCGdex from "@tcgdex/sdk";
import { DeckParser } from "pokemon-tcg-deck-parser";

const tcgdex = new TCGdex("en");
tcgdex.setCacheTTL(60 * 60 * 24);

const parser = new DeckParser({ tcgdex, hydrate: "full" });
```

## Formats

Both formats are quantity + name, optionally followed by set code and collector number.

### PTCGL export

```
Pokémon: 10
3 Chien-Pao ex PAL 61
Trainer: 18
1 Switch SVI 194 PH
Energy: 3
11 Basic {W} Energy Energy 29
2 Basic {W} Energy SVE 11 PH
Total Cards: 60
```

Handles `PH` foil markers, `{W}` energy shorthand, and PTCGL's pseudo `Energy` set.

### Limitless export

Copy as text from the Limitless deck builder:

```
Pokémon: 13
3 Charcadet SSP 32
Trainer: 27
4 Nest Ball SVI 181
Energy: 20
10 Fighting Energy SVE 22
```

Pass `{ format: "ptcgl" }` or `{ format: "limitless" }` to skip auto-detection.

## How lookups stay cheap

1. Parse the list locally.
2. Collect **unique** set codes.
3. Resolve those codes in batch through TCGdex (`abbreviation.official` and `tcgOnline`), with a small alias table for promo codes (`PR-SW` → `swshp`, `SVE` → `sve`, …).
4. Fetch each unique set **once**. Set payloads already include every card brief (`id`, `localId`, `name`, `image`), so a 60-card deck that uses 10 sets costs about 10 cached set requests — not 60 card requests.
5. Match collector numbers locally (padding, `TG`/`GG` gallery sets, promo IDs). `RR` is treated as both Rising Rivals and Team Rocket Returns and disambiguated by card name; Limitless `TRR` maps to Team Rocket Returns.
6. Name search is only used for leftovers (basic Energy-set lines, ALT prints, name-only rows).
7. `hydrate: "full"` then fetches each **unique** matched card id, still through the SDK cache and a concurrency cap.
8. Confirm each matched card's category. Set briefs do not include one, and a missing or wrong section divider can file trainers under Pokémon. Resolved ids are checked with filtered card-list queries — one query per category (`Pokemon`, `Trainer`, `Energy`) per chunk of ids, not one request per card. When the API disagrees, the card's `category` is corrected and a warning is recorded. `hydrate: "full"` already returns `category`, so those decks skip the extra queries.

The SDK cache TTL defaults to 24 hours. Repeat parses of overlapping decks should mostly be cache hits.

## Result shape

```ts
{
  format: "ptcgl",
  totalCards: 60,
  cards: [
    {
      quantity: 3,
      name: "Chien-Pao ex",
      setCode: "PAL",
      number: "61",
      category: "pokemon",
      tcgdexId: "sv02-061",
      card: { id: "sv02-061", localId: "061", name: "Chien-Pao ex", image: "..." }
    }
  ],
  unresolved: [],
  warnings: []
}
```

Unresolved rows stay in `cards` with `unresolvedReason`, and are also listed on `unresolved`.

## License

MIT
