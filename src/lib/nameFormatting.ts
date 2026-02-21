export function normalizePersonName(value: string): string {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";

  return cleaned
    .toLowerCase()
    .split(" ")
    .map((part) =>
      part
        .split("-")
        .map((hyphenPart) =>
          hyphenPart
            .split("'")
            .map((apostrophePart) =>
              apostrophePart ? apostrophePart.charAt(0).toUpperCase() + apostrophePart.slice(1) : apostrophePart
            )
            .join("'")
        )
        .join("-")
    )
    .join(" ");
}
