/**
 * Formats a Unix timestamp into a human-readable string.
 * @param timestamp - The Unix timestamp in milliseconds.
 * @returns A formatted date-time string.
 */
export const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString();
};

/**
 * Generates a random hex color.
 * @returns A hex color string (e.g., "#1a2b3c").
 */
export const getRandomColor = (): string => {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};
