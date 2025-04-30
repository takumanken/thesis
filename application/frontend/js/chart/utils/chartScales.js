/**
 * Unified scale creation utilities for all chart types
 */
import { chartColors } from "./chartColors.js";
import { determineTimeGrain } from "./chartUtils.js";
/**
 * Creates a linear scale for measure values with appropriate padding
 * @param {Array} data - Dataset
 * @param {string|Function} valueAccessor - Field name or accessor function for values
 * @param {Array} range - Output range [min, max]
 * @param {number} paddingFactor - Domain padding multiplier (default 1.05)
 * @param {boolean} includeZero - Whether to always include zero in domain
 * @returns {d3.scaleLinear} Configured linear scale
 */
export function createMeasureScale(data, valueAccessor, range, paddingFactor = 1.05, includeZero = true) {
  // Handle string accessor vs function accessor
  const getValue = typeof valueAccessor === "string" ? (d) => +d[valueAccessor] || 0 : valueAccessor;

  // Calculate max value with safeguards
  const maxValue = d3.max(data, getValue) || 0;

  // Create scale with appropriate domain
  const scale = d3
    .scaleLinear()
    .domain([includeZero ? 0 : d3.min(data, getValue) || 0, maxValue * paddingFactor])
    .range(range)
    .nice();

  return scale;
}

/**
 * Creates a band scale for categorical dimensions
 * @param {Array} categories - Array of category values
 * @param {Array} range - Output range [min, max]
 * @param {number} padding - Padding between bands (0-1)
 * @returns {d3.scaleBand} Configured band scale
 */
export function createCategoryScale(categories, range, padding = 0.2) {
  return d3.scaleBand().domain(categories).range(range).padding(padding);
}

/**
 * Creates a percentage scale (0-100% or 0-1)
 * @param {Array} range - Output range [min, max]
 * @param {boolean} normalized - If true, domain is [0,1], otherwise [0,100]
 * @returns {d3.scaleLinear} Configured percentage scale
 */
export function createPercentageScale(range, normalized = true) {
  return d3
    .scaleLinear()
    .domain([0, normalized ? 1 : 100])
    .range(range);
}

/**
 * Creates a color scale for categorical data
 * @param {Array} domain - Array of category values
 * @param {Array} colors - Optional custom color array
 * @returns {d3.scaleOrdinal} Configured color scale
 */
export function createColorScale(domain, colors = chartColors.mainPalette) {
  return d3.scaleOrdinal().domain(domain).range(colors);
}

/**
 * Creates a value scale for stacked data
 * @param {Array} stackedData - D3 stack data
 * @param {boolean} isPercentage - Whether scale is for percentage view
 * @param {Array} range - Output range [min, max]
 * @returns {d3.scaleLinear} Configured scale for stacked values
 */
export function createStackScale(stackedData, isPercentage, range) {
  return isPercentage
    ? createPercentageScale(range)
    : d3
        .scaleLinear()
        .domain([0, d3.max(stackedData, (layer) => d3.max(layer, (d) => d[1])) || 0])
        .range(range)
        .nice();
}

/**
 * Create time scale based on data type
 * @param {Array} data - Dataset containing time values
 * @param {boolean} isNumericTime - Whether time is numeric
 * @param {number} width - Width for scale range
 * @param {string} timeField - Name of the time field (default: 'time')
 * @param {string} timeGrain - Granularity of time (e.g., 'year', 'month', 'week', 'day')
 * @returns {d3.Scale} Appropriate time scale
 */
export function createTimeScale(data, isNumericTime, width, timeField = "time", timeGrain) {
  // Get data extent
  const extent = d3.extent(data, (d) => d[timeField]);

  // Determine time grain if not provided
  if (!timeGrain) {
    // Import is at the top of file, so this should work
    timeGrain = determineTimeGrain(timeField);
  }

  // Apply appropriate padding based on time grain
  if (!isNumericTime && extent[0] && extent[1]) {
    const padding = {
      year: 30 * 24 * 60 * 60 * 1000, // ~1 month padding for yearly data
      month: 15 * 24 * 60 * 60 * 1000, // 15 days padding for monthly data (half month)
      week: 3 * 24 * 60 * 60 * 1000, // 3 days padding for weekly data
      day: 12 * 60 * 60 * 1000, // 12 hours padding for daily data
    };

    const paddingAmount = padding[timeGrain] || padding.day;
    extent[0] = new Date(extent[0].getTime() - paddingAmount);
    extent[1] = new Date(extent[1].getTime() + paddingAmount);
  }

  // Create the appropriate scale
  const scale = isNumericTime
    ? d3.scaleLinear().domain(extent).range([0, width])
    : d3.scaleTime().domain(extent).range([0, width]);

  return scale;
}
