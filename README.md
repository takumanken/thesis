# A Natural Language Interface for Exploring NYC Open Data: Enhancing the Accessibility of Public Datasets

## 1. Abstract
Open data portals are invaluable resources, providing information for research, civic engagement, business intelligence, and informed decision-making across various sectors. Despite this potential, they often remain underutilized due to the advanced technical expertise required to navigate, manipulate, and interpret the data. This thesis addresses this challenge by introducing a natural language interface (NLI) powered by advanced AI technologies, designed to streamline data exploration and visualization. As a proof of concept, the system is tailored to a subset of [NYC Open Data](https://opendata.cityofnewyork.us/), one of the most extensive public repositories of municipal data in the United States.

The NLI allows users to pose everyday questions about New York City, such as "Show crime trends in Brooklyn since 2020" or "How many rat sightings have been reported in each borough?" The system then automatically generates relevant visualizations while handling the complex data processing and transformations behind the scenes. By minimizing the technical burden typically associated with open data exploration, this approach democratizes access, enabling individuals without specialized coding or data analysis skills to gain meaningful insights and actively engage with their city’s data.

Through the integration of established data aggregation and visualization practices with cutting-edge AI methodologies, this thesis demonstrates how natural language interfaces can transform public engagement with open data. It also identifies key developmental challenges for such systems and proposes practical solutions aimed at enhancing the user experience for open data portals—ultimately encouraging broader participation and a deeper, data-driven understanding of our communities.

---

## 2. Introduction

### 2.1 Current Open Data Challenges
Open data portals have significantly advanced transparency, innovation, and community engagement. However, their inherent complexity can limit widespread adoption. Although they offer a wealth of information, harnessing that information often requires advanced technical skills, such as programming and data analytics. Researchers, public officials, and community members without these skills frequently struggle to navigate, process, and derive actionable insights from the available datasets. This skills gap significantly reduces the potential impact of these valuable resources.

NYC Open Data, despite being one of the most widely used open data portals in the world, faces a similar challenge. Usability research from 2017 reported that the portal remains largely perceived as a specialized tool for a relatively small community of “civic hackers and tech journalists,” underscoring the need to make open data more accessible to the broader public. To unlock the full potential of open data and widen its appeal, it is crucial to examine how raw data is typically transformed into meaningful information.

In particular, the processes of data aggregation and visualization demand specialized knowledge—posing major hurdles for individuals without a technical background. These challenges can be broadly grouped as follows:

---

#### Data Aggregation
Most open data portals assume a baseline proficiency in data aggregation. Two common methods of distributing open data—**Approach 1** and **Approach 2**—illustrate the difficulties non-technical users may face.

##### Approach 1: File-Based Data Distribution
Many datasets, including those on [DATA.GOV](https://data.gov/), are available for download as CSV, Excel, or JSON files. This simplicity, however, introduces several obstacles:

1. **Local Burden**: Users bear full responsibility for loading, cleaning, filtering, and transforming the data locally, requiring familiarity with a variety of analytical tools and techniques (e.g., Excel, Python, or R).  
2. **Scalability Constraints**: Large datasets can exceed the average user’s computing capacity. Handling massive files locally becomes cumbersome or impossible, thereby deterring those with limited computing resources.

##### Approach 2: Portal-Based Aggregation Tools
Alternatively, platforms like [NYC Open Data](https://opendata.cityofnewyork.us/) provide interfaces for filtering, grouping, and other advanced operations before data is downloaded. This can help manage large datasets but still imposes a different technical hurdle: users must understand underlying concepts such as filtering criteria, group-by operations, and aggregation methods. While second nature to data professionals, these concepts can be unfamiliar and daunting for the average user.

---

#### Data Visualization
Even after overcoming data aggregation challenges, users must still visualize the data effectively:

1. **Chart Selection**: Identifying the most appropriate chart for a given dataset and objective requires knowledge of data visualization principles and a clear understanding of different chart types (e.g., bar charts, line charts, scatter plots, histograms).  
2. **Software Proficiency**: Popular tools like Excel can be intimidating for those without experience. Managing variables, correctly formatting dates, and ensuring proper alignment of data can all present significant barriers to creating clear and accurate visualizations.

NYC Open Data’s visualization interface attempts to address some of these issues by allowing users to define “dimensions” and “measures.” However, it still demands learning a specialized interface and grasping basic concepts in data analysis—both of which can deter non-technical users.

In summary, while open data portals offer a wealth of raw material for analysis, they also place substantial technical demands on their users. The complexity of both data aggregation and visualization can be especially discouraging for newcomers, limiting the scope and depth of public engagement. This situation highlights the need for a natural language interface—one that alleviates the technical burden by guiding users through data aggregation and visualization steps without requiring direct interaction with complex operations.

### 2.2 Requirements for a More Accessible User Experience
An integrated web application capable of translating everyday language into the technical operations needed for open data exploration offers a compelling solution to these challenges. By enabling users to type questions such as “How have 311 noise complaints changed over the past five years in Manhattan?” and automating the required data manipulation and visualization, such an interface can significantly simplify the user experience.

Two main features are particularly important:

1. **Automated Data Aggregation**  
   Dynamically filtering, grouping, and merging datasets based on user queries relieves individuals from having to download, configure, or manually manipulate data files. This allows them to focus on asking questions rather than performing complex data preparation.  

2. **Automated Visualization Selection**  
   Suggesting or generating a suitable chart type aligned with both the user’s intent and the underlying data structure reduces the need for specialized knowledge of data visualization principles.

By incorporating these capabilities, the proposed interface can expand the reach of platforms like NYC Open Data to a far wider audience, encouraging spontaneous exploration and deeper engagement. When users can simply ask questions in natural language, they are more likely to interact with open data and glean valuable insights—ultimately broadening public participation and fostering greater community awareness of data-driven trends and policy issues.
