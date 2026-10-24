# Treasure Kingdom art

Production assets for **이안이의 보물찾기 잘하자**. Created on 2026-10-24 with the built-in `image_gen` tool, using original game-specific prompts. No image-generation API/CLI fallback was used. These are AI-generated game assets, not captured gameplay. Gameplay screenshots are in `docs/treasure-kingdom/`.

## Shipped files

| File | Role | Dimensions |
|---|---|---|
| `kingdom-ruined.webp` | Title / ruined kingdom | 1672×941 |
| `kingdom-restored.webp` | Restored kingdom, same composition | 1672×941 |
| `terrain.webp` | 2×2 ground atlas: jungle / coast / observatory / garden | 1536×1024 |
| `props.webp` | 4×3 transparent environment atlas | 1448×1086 |
| `hero.webp` | 4×2 walking atlas, east and north | 1536×1024 |
| `actors.webp` | 4×3 transparent atlas: mid guardians / final guardians / expedition contacts | 1448×1086 |

Selected PNGs were copied into the project as WebP at quality 92. No semantic content was edited during conversion. Original tool outputs remain under `/Users/byunginsong/.codex/generated_images/01a16e0e-6082-7f52-b199-5fa4b8d65ced/`. The renderer crops atlas cells to alpha bounds, normalizes the hero's alpha for readability, uses mirrored ground repeats at play resolution and applies in-game color grading, depth, shadows and lighting. All runtime effects are authored in code. Phaser is MIT licensed; see its installed package for its license.

## Prompt set and source outputs

### Ruined kingdom

Source: `exec-63b3fac9-d60d-4dce-a6ad-98dd3fc23609.png`.

> Use case: stylized-concept. Create a finished cinematic key art background for a polished exploration adventure game aimed at ages 10-13, sophisticated independent-game festival quality. Wide 16:9, 1920x1080 or higher. An original solitary young explorer with a weathered midnight-blue long coat, copper scarf, dark trousers, leather satchel and a small brass lantern, seen from behind in the lower right, stands on a ruined stone bridge looking at a monumental ruined kingdom across a chasm. Ancient stone city with a broken circular celestial mechanism rising above it, shafts of pale afternoon light cut through atmospheric teal fog, gold motes of lost energy drift along the bridge. Layered depth, painterly hand-painted 2.5D game art, refined architectural detail, textural stone, ferns, restrained deep greens and slate blues with amber light. Mysterious and adventurous, resilient and hopeful, not scary or violent. Composition: lower right explorer, kingdom center-right, far left 40 percent remains dark atmospheric negative space suitable for title and menu overlay. No words, no text, no UI, no logo, no borders, no smiling objects, no chibi, no nursery or preschool aesthetic, no round toy trees, no pastel cream palette. A real evocative game world, not a website hero graphic.

### Restored kingdom

Edit of the ruined kingdom with `referenced_image_paths`; source: `exec-e5139995-eda1-4793-b892-eb0378bc0280.png`.

> Precise scene restoration edit for the ending of this exploration game. Preserve EXACT camera, composition, explorer in lower right, chasm, terrain, building positions, bridge geometry and blank dark left 40 percent for title overlay. Restore the ruined kingdom in place: repair broken towers and bridge, reconnect the giant celestial ring above the central palace into a complete working bronze mechanism lit with delicate amber energy, warm illuminated windows in the same buildings, subtle living greenery and hanging gardens on the same architecture, modest blue-and-gold banners on the restored towers. Atmosphere shifts to hopeful clear dawn with a few warm shafts of light but left side stays dark and quiet. A lived-in repaired kingdom, coherent and mature, no confetti, no cartoon colors, no new central buildings, no people crowds. Same premium painterly 2.5D realistic-stylized game artwork. No words, no text, no UI, no logos.

### Ground atlas

Initial source: `exec-85d0afdb-40a8-45f1-95f0-1cd38f693b54.png`. The initial image had gaps unsuitable for movement. The final edited ground is `exec-87e930a0-0539-428b-b59a-4628e435ead7.png`.

> Use case: stylized-concept. Create a production game terrain TEXTURE ATLAS, exactly a 2x2 grid of four equal rectangular panels, no gutter, no dividers, no text, no labels. Entire image ideally 3840x2560. Each quadrant is a different playable top-down 2.5D adventure terrain, same bird's-eye camera 60 degrees down, approximately 1900 by 1320 game units. Style: beautifully painted stylized indie exploration game for ages 10-13, rich natural materials, detailed ground surfaces, cinematic ambient occlusion, painterly realistic scale, NOT toy-like, NOT cute, NOT pixel art. Top-left: mossy ancient jungle plateau with weathered slate-paved routes branching around fern-covered ruins and a turquoise stream, dark emerald olive grasses, sandstone engravings. Top-right: tide-swept coastal island, weathered salt-white stones, pale dry sand paths, shallow cyan pools, shipwreck timbers flat on sand and shell fragments, navy water at extreme edges. Bottom-left: mysterious moon observatory terrain, slate-purple fractured basalt with bronze astronomical markings, translucent blue mineral seams, metallic abandoned walkways and dark indigo space at extreme edges. Bottom-right: an enormous overgrown botanical sanctuary viewed at tiny human scale, deep green moss, twisted ground roots, stone garden pathways, amber fungal spores and shallow dew pools. Every panel is almost entirely flat traversable terrain. Many wide open paths and clearings, no tall trees, no tall mushrooms, no standing characters, no bosses, no buildings, no player, no UI, no glowing collectibles, no text. Tall objects will be added separately as depth-sorted sprites. Ground-only game asset, the full panels must remain top-down traversable land and not a scenic side view. Similar detail and illumination in all quadrants, upper left key light.

Final edit:

> Revise this game terrain atlas to make it usable as WALKABLE GROUND. Preserve exact 2x2 equal quadrant layout, beautiful painterly detail and four world color palettes. Critical change: EVERY quadrant must be a single CONTINUOUS nearly FLAT GROUND PLANE from edge to edge. Fill ALL deep chasms, gaps, staircases, large streams and water between platforms with continuous ground, stone paving, soil and shallow small puddles. No cliffs, no sheer vertical drops, no bridges, no sea through the center. Especially bottom-left: complete continuous slate-purple moon floor with engraved brass astronomical lines and blue mineral veins, not floating islands. Top-left: continuous mossy stone and earth floor with engraved ruins and fern texture, only shallow small pools at extreme edges. Top-right: continuous flat sand, weathered nautical paving and shells, no large rocks, no upright shipwrecks, no sea except a very thin edge. Bottom-right: continuous mossy botanical floor with ground-level roots and paving, only tiny mushrooms and ground plants, no enormous vines overhanging paths. Broad flat open clearings. No tall objects, no trees, no standing rocks, no buildings. This is the base ground texture; all obstacles are added separately in the engine. Retain high-detail textured indie game look, no toy shapes, no UI, no text, no people.

### Environment props

Transparent output: `exec-e6b8e6a1-c5fa-48fb-8e8d-36f8e22e4982.png`.

> Use case: stylized-concept. Create a crisp 4-column by 3-row game PROP SPRITE ATLAS with genuinely TRANSPARENT background, no text, no gridlines. Twelve separate complete objects, each centered in its own equal cell, generous transparent padding, no object crossing cell boundaries. Orthographic three-quarter top-down 2.5D adventure game view (camera 60 degrees down), consistent upper-left illumination and painterly material detail, premium indie game artwork for ages 10-13, grounded stylized proportions not cute/chibi/toy. Layout exactly: row1 col1 an ancient dark emerald broadleaf jungle tree with angular irregular canopy and twisted mossy trunk; col2 a tall windswept coastal palm with long natural fronds; col3 a jagged translucent azure mineral cluster on dark basalt; col4 a group of huge weathered ochre mushrooms with textured caps and roots, no white polka dots. Row2 col1 an engraved mossy stone archway; col2 an old nautical compass monument with bronze astrolabe on a stone pedestal; col3 a broken lunar telescope on a basalt pedestal; col4 a stone garden gate covered in intertwined vines. Row3 col1 a fern and moss-covered jagged rock; col2 a sunken wooden treasure coffer with tarnished brass bands; col3 a standing ancient energy obelisk with bronze frame and pale amber crystal; col4 an antique beacon lantern on a carved stone plinth. Show each object from its front at a fixed camera angle, fully visible including base. Do not bake broad cast shadows outside object footprints. Dense quality textures, controlled highlights, readable silhouettes. No faces, no characters, no letters, no UI, no floor/background. Transparent image required.

### Explorer

Initial output: `exec-2bdbd2e0-d192-4a4a-bdcc-8b2bbc1d1443.png`. Final transparent extraction: `exec-559e6517-f64d-474c-94d0-94caa620e084.png`.

> Use case: stylized-concept. Production character sprite sheet for an original premium 2.5D top-down exploration adventure game aimed at ages 10-13. Genuinely transparent background. Exactly TWO rows, FOUR columns, equal cells, each full-body figure entirely inside its cell with generous transparent padding. Row1: same young human adventurer, four walking frames moving east/right at a three-quarter bird's-eye camera angle 60 degrees down. Row2: same adventurer four walking frames moving north/away from viewer. Character has realistic stylized human proportions, slim silhouette, small head, weathered dark navy hooded long coat reaching knees, burnt copper scarf, charcoal trousers, tall worn brown boots, small brown leather satchel, warm brass lantern in one hand. Not chibi, not baby, not cute, no huge head, no big cartoon eyes, no explorer pith helmet. Painterly hand-painted game art with detailed folds, metal and leather, matching a mysterious ancient-ruins adventure. Consistent scale, lantern glows amber without huge halo, upper-left lighting. Each of the 8 frames has same consistent foot baseline and head height, varying arms and legs in a natural walking cycle. No ground, no floor, no broad cast shadows, no text, no letters, no UI, no borders. Useful as an actual sprite atlas, strong readable dark silhouette, not a concept sheet.

Extraction edit:

> Background extraction edit. Remove the ENTIRE brown/black gradient background from this sprite atlas, leaving genuinely transparent alpha everywhere except the eight complete characters and their lanterns. Preserve every character, frame, pose, clothing detail, exact 4x2 layout and scale. No ground or cast shadow, no color matte behind sprites. This MUST be usable transparent game sprites, not an image of sprites on a dark background. Keep each character fully separate within its cell. Do not change the character art.

### Guardians and contacts

Transparent output: `exec-68494199-b096-4234-b1f9-fc785bf3b963.png`.

> Production sprite atlas for a premium 2.5D top-down ancient-kingdom exploration adventure aimed at ages 10-13. Exactly 4 COLUMNS x 3 ROWS equal cells, 12 full-body separate figures on GENUINELY TRANSPARENT background. NO colored background, no brown gradient, no floor, no text, no grid lines. Each sprite fully contained with generous padding, same bird's-eye orthographic camera 60 degrees down, upper-left key light, hand-painted sophisticated textured materials, imposing but not horror, no gore, no cute cartoon eyes, no chibi. Row1 four mid-boss guardians: col1 a tall angular moss-covered stone automaton with a thin amber visor and bronze ancient joints; col2 a massive armored crab with weathered bronze shell; col3 a hovering angular lunar sentinel drone with indigo armor and an amber energy core; col4 a thorn-armored knight with bark armor and a long leafy cape. Row2 four final guardians: col1 a muscular prehistoric dinosaur guardian in cracked carved stone armor with moss, natural dinosaur proportions; col2 a majestic armored octopus deep-sea sentinel with bronze crown-like plates and curled tentacles; col3 a levitating celestial guardian with floating dark stone geometric armor sections around a bright amber core and bronze orbit rings; col4 an enormous ancient tree guardian with intricate roots, pale golden leaf crown and carved stone mask. Row3 four friendly adult quest characters, slim realistic stylized human proportions: col1 a rugged archaeologist man with olive cloak and a map; col2 a woman navigator with navy coat and brass telescope; col3 a slender utilitarian brass-and-ceramic survey robot with a single blue lens, not a toy; col4 a hooded botanical archivist woman with green cloak and an ancient book. All twelve share the same mature textured painterly indie-game aesthetic, detailed readable silhouettes. Each is an isolated actual game sprite with transparent alpha, no ground shadows extending into adjacent cells.

## Runtime terrain and recovery effects

The trail mask in `treasureTerrain.js` reuses the original terrain atlas as a surface texture and paints it through the same segment geometry used by navigation and collision. Hearts and hazard pools are original Canvas drawings in `treasureArt.js`; their gradient, bank, algae, grit and bubble layers are generated locally, without additional image generation or third-party assets. Current gameplay captures and reproducible verification are in `docs/treasure-kingdom/`.


## Cheering citizens

`citizens-cheering.webp`, 1536×1024 RGBA, converted at quality 92 from built-in image generation output `exec-63e976d8-eadf-4c64-888b-3bf7d6466938.png` in the same generated-images directory. Created for the stage-clear homecoming sequence. The first 490 pixels of the atlas are composited as a complete group in CSS, preserving all hands and feet without cutting individual cells.

Prompt summary: an original 4-column, 2-row transparent atlas of four realistically proportioned kingdom citizens in navy, copper, olive and muted teal, raising their hands and cheering in two poses, with mature painterly cloth/leather details, warm upper-left lighting, no ground or text, matching the existing adventure art. Source alpha was verified and preserved.
