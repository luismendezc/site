# AlienPacked — Puzzle Generator

Web-based puzzle editor for [AlienPacked](https://github.com/luismendezc), the mobile domino puzzle game built with Godot.

**Live:** [luismendezc.github.io/site/puzzle-generator/](https://luismendezc.github.io/site/puzzle-generator/)

## What is this?

A visual tool for content creators to design puzzle levels for AlienPacked. Create grids, place pieces, define conditions, add monsters, validate your puzzle, and export a ready-to-use JSON file.

## Features

- **Visual grid editor** — Click to toggle blocked cells, right-click to place monsters
- **Range notation** — Type `A1:B2` to select rectangular cell regions instead of listing each cell
- **Click-to-select** — Use "Seleccionar en Cuadrícula" to pick condition cells directly on the grid
- **Monster system** — Define math expressions, answers, and sacrifice pieces for monster cells
- **Validation** — Checks adjacency, piece values, solution completeness, monster ambiguity, and more
- **Prove** — Tests your solution against all conditions to verify the puzzle is solvable
- **Difficulty limits** — Warns (without blocking) when piece/condition/monster counts exceed difficulty guidelines
- **Import/Export JSON** — Round-trip compatible with the game's puzzle format
- **Game-accurate visuals** — AlienSpace1 style with box textures, value colors, animated eyes and mouths

## Difficulty Levels

| ID | Name | Grid |
|---|---|---|
| `extra_facil` | Extra Fácil | 4×4 |
| `facil` | Fácil | 4×4 |
| `medio_bajo` | Medio Bajo | 5×5 |
| `medio_alto` | Medio Alto | 5×5 |
| `dificil_bajo` | Difícil Bajo | 5×5 |
| `dificil_alto` | Difícil Alto | 5×5 |

## How to use

1. **Select difficulty** — Sets the grid size
2. **Add pieces** — Each piece has a left and right value (0–12)
3. **Set up the grid** — Click cells to block them, right-click to add monsters
4. **Define conditions** — Use operators (`>`, `<`, `>=`, `<=`, `=`, `sum`) on cell groups
5. **Build the solution** — Assign each piece to two adjacent cells with their values
6. **Add monster solutions** — Assign sacrifice pieces to each monster
7. **Validate** — Check for structural errors
8. **Prove** — Verify the solution satisfies all conditions
9. **Export JSON** — Download the puzzle file ready for the game

## Condition operators

| Operator | Meaning |
|----------|---------|
| `>` `<` `>=` `<=` | Compare cell value (or sum of multiple cells) against target |
| `=` | All cells in the group must have the same value |
| `sum` | Sum of all cells must equal the target value |

## Tech stack

- Vanilla JavaScript (ES modules, no build step)
- Bootstrap 5 (CDN)
- Canvas API for grid rendering
- Google Fonts (Fredoka)

## Coming soon

- **Pack Generator** — Web-based tool for building complete content packs (config, assets, levels, story, export)

## JSON format

The exported JSON matches the game's puzzle format:

```json
{
  "id": 1,
  "difficulty": "facil",
  "grid_cols": 4,
  "grid_rows": 4,
  "lives": 3,
  "blocked_cells": ["A1", "B1"],
  "monster_cells": [
    {"cell": "C1", "expression": "3*4-2", "display": "3×4−2", "answer": 10}
  ],
  "pieces": [
    {"id": 1, "left": 9, "right": 5}
  ],
  "conditions": [
    {"cells": ["B2", "C2"], "operator": "=", "value": 0},
    {"cells": ["D2", "D3"], "operator": "sum", "value": 9}
  ],
  "solution": [
    {"piece": 1, "cells": ["A2", "B2"], "rotation": 1}
  ],
  "monster_solution": [
    {"monster_cell": "C1", "piece": 2}
  ]
}
```
