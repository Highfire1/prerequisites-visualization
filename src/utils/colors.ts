/**
 * Helper function to assign colors based on group
 * Generates a consistent hex color for each group using a hash function
 */
export const getGroupColor = (group: string): string => {
    // If group is empty, use default
    if (!group || group.trim() === '') {
        return "#74b9ff";
    }

    const hash = Array.from(group).reduce((acc, char) => {
        return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);

    // Generate a hex color instead of HSL
    const hue = Math.abs(hash % 360);

    // Convert HSL to RGB for hex color
    const s = 0.8; // saturation
    const l = 0.6; // lightness

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = l - c / 2;

    let r, g, b;
    if (hue < 60) {
        r = c; g = x; b = 0;
    } else if (hue < 120) {
        r = x; g = c; b = 0;
    } else if (hue < 180) {
        r = 0; g = c; b = x;
    } else if (hue < 240) {
        r = 0; g = x; b = c;
    } else if (hue < 300) {
        r = x; g = 0; b = c;
    } else {
        r = c; g = 0; b = x;
    }

    const hexR = Math.round((r + m) * 255).toString(16).padStart(2, '0');
    const hexG = Math.round((g + m) * 255).toString(16).padStart(2, '0');
    const hexB = Math.round((b + m) * 255).toString(16).padStart(2, '0');

    const color = `#${hexR}${hexG}${hexB}`;

    return color;
};
