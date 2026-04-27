#!/usr/bin/env python3
"""
Generate a heatmap from Bogotá survey data.

Usage:
    python3 scripts/generate-heatmap.py --input data/survey-urban-fine.json --output heatmap-bogota.png
"""

import json
import argparse
from pathlib import Path

try:
    import matplotlib.pyplot as plt
    import matplotlib.colors as mcolors
    import numpy as np
except ImportError:
    print("Missing dependencies. Install with: pip install matplotlib numpy")
    raise


def load_survey(path: str):
    with open(path) as f:
        return json.load(f)


def generate_heatmap(data: dict, output: str, title: str = "Bogotá Insights Score Heatmap"):
    results = data.get("results", [])
    if not results:
        print("No results found in survey data")
        return

    lats = [r["lat"] for r in results]
    lngs = [r["lng"] for r in results]
    scores = [r["scores"]["overall"] for r in results]
    total_pois = [r["total_pois"] for r in results]

    # Mask empty points (score 25 with 0 POIs) for cleaner visualization
    urban_mask = [p > 0 for p in total_pois]
    urban_lats = [l for l, m in zip(lats, urban_mask) if m]
    urban_lngs = [l for l, m in zip(lngs, urban_mask) if m]
    urban_scores = [s for s, m in zip(scores, urban_mask) if m]

    fig, axes = plt.subplots(1, 2, figsize=(16, 7))

    # --- Plot 1: All points ---
    ax1 = axes[0]
    scatter1 = ax1.scatter(
        lngs, lats, c=scores, cmap="RdYlGn", vmin=25, vmax=100,
        s=80, alpha=0.85, edgecolors="black", linewidths=0.3
    )
    ax1.set_xlabel("Longitude")
    ax1.set_ylabel("Latitude")
    ax1.set_title(f"{title}\nAll survey points (n={len(results)})")
    cbar1 = plt.colorbar(scatter1, ax=ax1, label="Overall Score")
    cbar1.set_ticks([25, 40, 55, 70, 85, 100])

    # --- Plot 2: Urban points only ---
    ax2 = axes[1]
    if urban_scores:
        scatter2 = ax2.scatter(
            urban_lngs, urban_lats, c=urban_scores, cmap="RdYlGn", vmin=25, vmax=100,
            s=100, alpha=0.9, edgecolors="black", linewidths=0.3
        )
        ax2.set_xlabel("Longitude")
        ax2.set_ylabel("Latitude")
        ax2.set_title(f"Urban points only (n={len(urban_scores)})\nMedian: {int(np.median(urban_scores))} | Mean: {int(np.mean(urban_scores))}")
        cbar2 = plt.colorbar(scatter2, ax=ax2, label="Overall Score")
        cbar2.set_ticks([25, 40, 55, 70, 85, 100])

    plt.tight_layout()
    plt.savefig(output, dpi=200, bbox_inches="tight")
    print(f"Heatmap saved to: {output}")


def generate_category_heatmaps(data: dict, output: str):
    """Generate a 2x3 grid of category heatmaps."""
    results = data.get("results", [])
    if not results:
        return

    lats = [r["lat"] for r in results]
    lngs = [r["lng"] for r in results]
    total_pois = [r["total_pois"] for r in results]
    urban_mask = [p > 0 for p in total_pois]

    categories = ["transport", "commerce", "education", "health", "recreation"]
    fig, axes = plt.subplots(2, 3, figsize=(18, 11))
    axes = axes.flatten()

    for idx, cat in enumerate(categories):
        ax = axes[idx]
        cat_scores = [r["scores"][cat] for r in results]
        urban_lats = [l for l, m in zip(lats, urban_mask) if m]
        urban_lngs = [l for l, m in zip(lngs, urban_mask) if m]
        urban_scores = [s for s, m in zip(cat_scores, urban_mask) if m]

        if urban_scores:
            scatter = ax.scatter(
                urban_lngs, urban_lats, c=urban_scores, cmap="RdYlGn", vmin=25, vmax=100,
                s=60, alpha=0.85, edgecolors="black", linewidths=0.2
            )
            ax.set_title(f"{cat.capitalize()} (median: {int(np.median(urban_scores))})")
            ax.set_xlabel("Longitude")
            ax.set_ylabel("Latitude")
            plt.colorbar(scatter, ax=ax, label="Score")

    # Hide extra subplot
    axes[5].axis("off")

    plt.suptitle("Bogotá Insights — Category Score Heatmaps (Urban Points)", fontsize=14)
    plt.tight_layout()
    plt.savefig(output, dpi=200, bbox_inches="tight")
    print(f"Category heatmaps saved to: {output}")


def main():
    parser = argparse.ArgumentParser(description="Generate heatmap from survey data")
    parser.add_argument("--input", required=True, help="Path to survey JSON")
    parser.add_argument("--output", default="heatmap-bogota.png", help="Output PNG path")
    parser.add_argument("--categories", action="store_true", help="Also generate category heatmaps")
    args = parser.parse_args()

    data = load_survey(args.input)
    out_path = Path(args.output)

    generate_heatmap(data, str(out_path))

    if args.categories:
        cat_path = out_path.parent / f"categories-{out_path.name}"
        generate_category_heatmaps(data, str(cat_path))


if __name__ == "__main__":
    main()
