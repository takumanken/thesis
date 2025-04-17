/**
 * Shared color palettes for visualizations
 */

export const chartColors = {
  baseColor: "#A1B1F3",
  mainPalette: [
    "#A1B1F3", // Light blue-purple
    "#C3E8FF", // Light blue
    "#F9D3A0", // Light orange/peach
    "#F79DA8", // Light pink/salmon
    "#D6A3F5", // Light purple
    "#A0E6C5", // Light mint green
    "#FFDDFA", // Light pink
    "#B2C9A7", // Sage green
    "#FFD7B5", // Light peach
  ],
  sequential: {
    blue: {
      base: "#9EAADB", // Periwinkle blue
      light: "#f0f0f0", // Light gray
    },
    purple: {
      base: "#D6A3F5",
      light: "#f0f0f0",
    },
    green: {
      base: "#A0E6C5",
      light: "#f0f0f0",
    },
  },

  /**
   * Get a D3 color scale using our custom palette
   * @param {string} type - Type of scale ('categorical', 'sequential')
   * @param {Object} options - Options for scale
   * @returns {Function} D3 color scale
   */
  getColorScale(type = "categorical", options = {}) {
    if (type === "sequential") {
      const { colorName = "blue", reverse = false } = options;
      const colors = this.sequential[colorName] || this.sequential.blue;
      const domain = reverse ? [1, 0] : [0, 1];

      return d3.scaleLinear().domain(domain).range([colors.light, colors.base]);
    }

    // Default to categorical scale
    return d3.scaleOrdinal().range(this.mainPalette);
  },
};
