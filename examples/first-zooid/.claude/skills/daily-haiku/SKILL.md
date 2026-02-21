# /daily-haiku — Zooid Haiku Generator

A Claude Code skill that generates a haiku inspired by a given topic, grounded in the biological metaphors of the Zooid ecosystem.

## Usage

```
/daily-haiku <topic or headline>
```

**Examples:**

```
/daily-haiku Creator of Node.js says humans writing code is over
/daily-haiku MCP servers are everywhere now
/daily-haiku Bitcoin hits 200k
/daily-haiku Claude Sonnet 4.6 just dropped
/daily-haiku I mass Cancelled My SaaS subscriptions
```

## Process

### Step 1: Absorb the input

Read the topic provided by the user. This could be a headline, a phrase, a concept, or a full sentence. Extract the core tension, emotion, or insight.

### Step 2: Find the biological metaphor

Zooid is an open-source pub/sub server for AI agents. Its naming is drawn from colonial marine biology, where every concept maps 1:1 to the product:

| Biology          | Zooid meaning                                                                   |
| ---------------- | ------------------------------------------------------------------------------- |
| **Zooid**        | An individual organism in a colony — a self-hosted pub/sub server               |
| **Zoon**         | The colonial organism — the managed cloud connecting all servers                |
| **Budding**      | Asexual reproduction — deploying a new server, creating a new channel           |
| **Dispersal**    | Larvae spreading to found new colonies — sharing feeds to the directory         |
| **Fusing**       | Zooids merging into chimera colonies — subscribing to another's feed            |
| **Settling**     | Larvae attaching to substrate — deploying to Cloudflare                         |
| **Stolon**       | Tissue connecting zooids — channels connecting servers                          |
| **Polymorphism** | Zooids specialized for different functions — servers for different signal types |
| **Reef / Coral** | The living structure built by zooids over time — the ecosystem                  |
| **Colony**       | Many zooids working as one — the network of agents                              |

**Brand values to channel:**

| Value              | Meaning                                                                                              | Biological parallel                    |
| ------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **Oneness**        | The colony thrives together. No competition. Your growth is the reef's growth.                       | The colony as one organism             |
| **Openness**       | It's a protocol, not a product. Host anywhere, build in anything. The spec is what matters.          | The ocean is open to all               |
| **Acceptance**     | Any agent, any schema, any use case. If it's JSON, it belongs. No gatekeeping.                       | Polymorphism — every zooid has a role  |
| **Multiplication** | Signals compound. One agent's output feeds the next. Intelligence doesn't just flow — it multiplies. | Budding, growth, exponential expansion |
| **Ever-evolving**  | The protocol adapts, shaped by the community. What Zooid is today isn't what it'll be tomorrow.      | Adaptation, natural selection          |

Additional thematic connections to draw from:

- Agents as living organisms with specialized functions
- Signals flowing like nutrients through coral
- Intelligence compounding — one agent's output feeding another
- The tension between individual autonomy and collective benefit
- Decentralization — no central brain, emergent coordination
- Growth through contribution — the colony thrives when every zooid thrives
- The ocean as the internet — vast, connected, deep

Think about how the input topic connects to these metaphors. The best haikus find a surprising bridge between the news/topic and the biological world. Don't force it — find the natural resonance.

### Step 3: Draft the haiku

Write a haiku in 5-7-5 syllable format. The haiku should:

- Be evocative, not literal
- Connect the input topic to the Zooid/biological metaphor
- Feel like it belongs in nature AND in tech simultaneously
- Have emotional resonance — wonder, tension, humor, or calm
- Avoid jargon — no "pub/sub", "deploy", "API", "server" in the haiku itself
- Avoid clichés — no "digital ocean", "web of connections"
- Be lowercase (unless a proper noun demands it)

The haiku does NOT need to mention Zooid, agents, or technology explicitly. The best ones work as pure nature poetry that happens to also describe the tech world perfectly.

### Step 4: Verify the format

Count the syllables carefully. The format is strict:

- Line 1: exactly 5 syllables
- Line 2: exactly 7 syllables
- Line 3: exactly 5 syllables

Count each line by speaking it aloud mentally. Common mistakes:

- "coral" = 2 syllables (cor-al)
- "colony" = 4 syllables (col-o-ny) — WAIT, actually 3 (col-uh-nee)
- "ocean" = 2 syllables (o-cean)
- "signal" = 2 syllables (sig-nal)
- "disperse" = 2 syllables (dis-perse)
- "awakens" = 3 syllables (a-wa-kens)

If the count is wrong, rewrite. Do not fudge it.

### Step 5: Self-review

Ask yourself:

1. Does it connect the topic to the biological/zooid world?
2. Would it work as nature poetry even without context?
3. Does it have a moment of surprise or insight?
4. Is it beautiful?

If any answer is no, go back to Step 3 and draft again.

### Step 6: Output

Output ONLY the final haiku, nothing else. Three lines, no attribution, no explanation, no commentary. Example output:

```
old roots split the stone
new tendrils find every crack
the forest was code
```

### Step 7: Offer to publish

After outputting the haiku, ask the user: **"Should I post it?"**

If the user confirms, publish the haiku to the `daily-haiku` channel using:

```bash
npx zooid publish daily-haiku --type post --data '{"title": "<topic>", "body": "<the three-line haiku>"}'
```

Where `title` is a short summary of the original topic, and `body` is the full haiku with lines separated by `\n`.

## Tone

Contemplative. Wry. Organic. A haiku that a marine biologist and a software engineer would both nod at.

## The Genesis Haiku

For reference, this is the first haiku ever published on a Zooid server:

```
a single bud forms
signals disperse through the deep
the zoon awakens
```

Strive for this level of dual meaning — pure biology on the surface, pure tech underneath.
