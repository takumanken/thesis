import { state } from "../state.js";
import { CHART_DIMENSIONS } from "../constants.js";

function renderMap(container) {
  const dataset = state.dataset;
  const geoDim = state.aggregationDefinition.geo_dimension[0];
  const measure = state.aggregationDefinition.measures[0].alias;

  if (!(geoDim === "borough" || geoDim === "neighborhood_name" || geoDim === "county")) {
    container.innerHTML = `<p>Geo dimension "${geoDim}" is not supported for map visualization.</p>`;
    return;
  }

  const aggregatedData = {};
  dataset.forEach((d) => {
    let region;
    if (geoDim === "borough") {
      region = d[geoDim].toUpperCase();
    } else if (geoDim === "county") {
      region = d[geoDim].toUpperCase();
    } else {
      region = d[geoDim];
    }
    if (region && region !== "Unspecified" && !(region in aggregatedData)) {
      aggregatedData[region] = +d[measure];
    }
  });

  const maxVal = d3.max(Object.values(aggregatedData));
  const colorScale = d3.scaleSequential(d3.interpolateOrRd).domain([0, maxVal]);

  const width = CHART_DIMENSIONS.width || 800;
  const height = CHART_DIMENSIONS.height || 600;
  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

  d3.json("assets/geojson/2020_nyc_neighborhood_tabulation_areas_nta.geojson").then((geojsonData) => {
    const projection = d3.geoMercator().fitSize([width, height], geojsonData);
    const path = d3.geoPath().projection(projection);
    const countyMapping = {
      BRONX: "BRONX",
      BROOKLYN: "KINGS",
      MANHATTAN: "NEW YORK",
      QUEENS: "QUEENS",
      "STATEN ISLAND": "RICHMOND",
    };

    geojsonData.features.forEach((feature) => {
      let regionName;
      if (geoDim === "borough") {
        regionName = feature.properties.boroname.toUpperCase();
      } else if (geoDim === "neighborhood_name") {
        regionName = feature.properties.ntaname;
      } else if (geoDim === "county") {
        regionName = countyMapping[feature.properties.boroname.toUpperCase()];
        feature.properties.county = regionName;
      }
      feature.properties.aggValue = regionName && regionName !== "UNSPECIFIED" ? aggregatedData[regionName] || 0 : 0;
    });

    svg
      .selectAll("path")
      .data(geojsonData.features)
      .enter()
      .append("path")
      .attr("d", path)
      .attr("fill", (d) => colorScale(d.properties.aggValue))
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 0.5);

    svg
      .selectAll("path")
      .on("mouseover", function (event, d) {
        let displayName;
        if (geoDim === "borough") {
          displayName = d.properties.boroname;
        } else if (geoDim === "county") {
          displayName = d.properties.county + " County";
        } else {
          displayName = d.properties.ntaname;
        }
        const tooltip = d3
          .select(container)
          .append("div")
          .attr("class", "tooltip")
          .style("position", "absolute")
          .style("background", "#fff")
          .style("padding", "5px")
          .style("border", "1px solid #000")
          .html(`<strong>${displayName}</strong><br><strong>${measure}:</strong> ${d.properties.aggValue}`);
        tooltip.style("left", event.pageX + 5 + "px").style("top", event.pageY + 5 + "px");
      })
      .on("mouseout", () => {
        d3.select(container).select(".tooltip").remove();
      });

    const legendWidth = 300;
    const legendHeight = 10;
    const legendX = width - legendWidth - 20;
    const legendY = height - 40;

    const legend = svg.append("g").attr("class", "legend").attr("transform", `translate(${legendX}, ${legendY})`);

    const defs = svg.append("defs");
    const gradient = defs
      .append("linearGradient")
      .attr("id", "legend-gradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%");
    gradient.append("stop").attr("offset", "0%").attr("stop-color", colorScale(0));
    gradient.append("stop").attr("offset", "100%").attr("stop-color", colorScale(maxVal));

    legend
      .append("rect")
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#legend-gradient)");

    const legendScale = d3.scaleLinear().domain([0, maxVal]).range([0, legendWidth]);
    const legendAxis = d3.axisBottom(legendScale).ticks(5);
    legend.append("g").attr("transform", `translate(0, ${legendHeight})`).call(legendAxis);
  });
}

export default renderMap;
