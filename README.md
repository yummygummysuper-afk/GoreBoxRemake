# GBRemake — Prototype 0.1

A small original 3D browser sandbox built with Three.js and Vite. It is an homage to physics-sandbox games, not a copy of original game assets.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. For a production build, run `npm run build`.

## Publish on GitHub Pages

The repo includes a GitHub Actions workflow at `.github/workflows/deploy.yml`, and Vite uses relative asset paths so the build works under a repository subpath.

1. Create a GitHub repository and push these project files to its `main` (or `master`) branch.
2. In the repository, open **Settings → Pages** and set the deployment source to **GitHub Actions**.
3. The workflow builds and publishes on every push. When it finishes, the Pages URL appears under **Settings → Pages** and in the deployment job. It will usually look like `https://USERNAME.github.io/REPOSITORY/`.

## Controls

### Desktop

- **W/A/S/D** — move; **Shift** — sprint; **Space** — jump
- **Drag with the mouse** — look around in first person
- **Left click** — use the selected tool; **Right click** — spawn the selected prop or NPC
- **Reality Crusher:** hold left click on a target to grab it; mouse wheel removes the focused item
- **G** — drop non-starting gear; **E** — sit on a nearby chair or pick up dropped gear
- **1 / 2** — fists / Reality Crusher; **Esc** — sandbox menu

### Mobile

- **Left virtual stick** — move; **drag the open right side** — look around
- Tap **USE**, **↑**, **E**, **+**, **−**, or **G** for tool, jump, interact, spawn, delete, or drop
- Tap the **menu** button in the HUD to open the sandbox panel

## Prototype features

- Plains and Test Range maps, with a clearly marked slide ramp and three test balls
- First-person controls, low-poly mannequin characters, simple wander/chase-and-tag AI, props and hand-built physics
- Visible abstract hit particles, six graphics presets, live renderer options, audio sliders and 20 language choices
- Synthesized menu ambience and interface sounds (the browser enables audio after the first interaction)
- Responsive menus and touch controls

Impacts are deliberately stylized and non-graphic: abstract red/orange sparks and physics reactions only. There is no blood or dismemberment.
