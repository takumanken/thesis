# A Natural Language Interface for Exploring NYC Open Data: Enhancing Public Access to Data

## 1. Abstract

Open data portals are critical resources that promote research, civic engagement, business insights, and data-driven decision-making across many fields. However, these portals often remain underused because they can be complex to navigate, manipulate, and interpret without specialized technical skills. This thesis proposes a natural language interface (NLI) that uses modern AI techniques to make data exploration and visualization more intuitive. As a proof of concept, the system focuses on a subset of [NYC Open Data](https://opendata.cityofnewyork.us/), one of the largest municipal data repositories in the United States.

The NLI enables users to pose everyday questions about New York City—such as “Show crime trends in Brooklyn since 2020” or “How many rat sightings have been reported in each borough?”—and automatically returns relevant visualizations. This approach frees users from the burden of handling data processing, allowing those without technical backgrounds to engage with open data in a meaningful way.

By combining established methods of data aggregation and visualization with recent advancements in AI, this thesis demonstrates how NLIs can make open data more accessible. It also examines the core challenges of developing such interfaces, offering practical strategies to enhance usability. Ultimately, this work aims to encourage broader participation and a deeper, data-informed understanding of urban communities.

---

## 2. Introduction

### 2.1 Current Open Data Challenges

Open data portals have significantly advanced government transparency, sparked innovation, and fostered community engagement. Despite these benefits, their complexity often prevents many individuals from taking full advantage of them. Although the data is publicly available, extracting insights usually requires advanced skills in programming and analytics. As a result, researchers, policymakers, and community members who lack technical expertise may struggle to work with these datasets, diminishing the impact of open data.

NYC Open Data, one of the most prominent portals, faces similar hurdles. A 2017 study found that many users considered it a tool primarily for “civic hackers and tech journalists,” indicating a need to make open data more approachable for everyday users. Unlocking the full potential of such resources requires an understanding of how to transform raw data into meaningful information.

A key part of this problem involves data aggregation and visualization—tasks that often demand specialized knowledge. These challenges generally fall into two main categories:

---

#### Data Aggregation

Most open data portals assume users already have a basic ability to handle data. In practice, two standard approaches to distributing open data highlight the difficulties non-technical users frequently encounter.

##### Approach 1: File-Based Data Distribution

Platforms such as [DATA.GOV](https://data.gov/) often provide datasets as CSV, Excel, or JSON files. Although these formats are straightforward, they present a few significant challenges:

1. **Local Burden**  
   Users must load, clean, filter, and transform the data themselves using tools like Excel, Python, or R.

2. **Scalability Constraints**  
   Large datasets can overwhelm typical computers, making it hard or impossible to work with the data locally.

##### Approach 2: Portal-Based Aggregation Tools

Other portals, including [NYC Open Data](https://opendata.cityofnewyork.us/), offer built-in tools that let users filter and group data before downloading it. While this feature helps manage large datasets, it still requires familiarity with terms like “group-by operations” and “aggregation methods,” which can deter those who are not data professionals.

---

#### Data Visualization

Once the data is aggregated, users face additional challenges in visualizing it:

1. **Chart Selection**  
   Selecting an effective chart type—such as a bar chart, line chart, scatter plot, or histogram—requires a grasp of basic data visualization principles.

2. **Software Proficiency**  
   Tools like Excel can be intimidating for users who lack training. Managing variables, cleaning date fields, and aligning data for clear visual representations can all create significant barriers.

While NYC Open Data’s interface offers helpful features (such as setting dimensions and measures), it still demands that users learn specialized workflows and terminology. This requirement may discourage people who lack technical backgrounds.

In short, open data portals contain a wealth of information, but the expertise required for data aggregation and visualization can exclude many potential users. This reality highlights the need for a natural language interface that guides users through these processes, removing the need for advanced technical knowledge.

---

### 2.2 The Proposed Natural Language Interface: Enhancing Open Data Accessibility

This thesis introduces a **natural language interface (NLI)** as a solution to the challenges described above. By enabling users to ask questions in everyday language rather than writing code or juggling complex software tools, the NLI reduces the barriers to exploring open datasets. The following sections explain why natural language is well-suited for data aggregation and visualization, and how modern large language models have made this approach more practical than ever before.

#### 2.2.1 Why Natural Language Is a Viable Solution

Day-to-day language naturally encompasses the key elements required for both **data aggregation** and **data visualization**:

1. **Identifying Key Components**  
   When a user asks, “How have 311 noise complaints changed over the past five years in Manhattan?” the question already specifies dimensions (time and location), measures (number of noise complaints), and filters (Manhattan, past five years). In other words, the query implicitly contains the parameters needed to build the data request, provided the user is somewhat aware of the data fields available.

2. **Choosing the Right Chart**  
   Natural language queries also hint at the best visualization approach. For example:  
   - A question about trends (“How has it changed over time?”) typically calls for a line chart.  
   - A query about correlations (“Do more rat sightings happen in densely populated areas?”) suggests a scatter plot.  
   - A request for comparisons (“Which borough had the highest increase in noise complaints?”) points to a bar chart.

In this way, natural language inherently encodes the information needed for data operations and visualization choices. The NLI interprets the user’s intent, translates it into the necessary steps (such as group-by clauses or filters), and automatically selects a suitable chart—without requiring the user to learn technical details.

#### 2.2.2 Why This Approach Is Feasible Today

Although using natural language for data exploration is not new, it was historically difficult to implement accurately. Parsing free-form queries often led to errors or misunderstandings. However, the advent of **large language models (LLMs)** has overcome many of these obstacles:

- **Better Semantic Understanding**  
  Modern LLMs can interpret nuanced language, handling synonyms and ambiguous phrases.
- **Improved Contextual Reasoning**  
  These models go beyond simple keyword matching, allowing them to address incomplete or vaguely worded queries in a more robust way.

Thanks to these improvements, an NLI can now reliably parse user queries, map them to the required data transformations, and generate visual results. The next section outlines how this thesis applies these concepts to develop an interface for NYC Open Data, covering everything from parsing user requests to presenting a final chart.

---

## 3. Treatment

### 3.1 System Architecture

This section describes how the proposed natural language interface is built and how its components work together. **Figure 1** (below) illustrates the entire process: starting from a user’s question and ending with a visual representation of the data. The system’s primary goal is to let users explore open data by posing everyday questions, without writing code or mastering analytical tools.

Figure 1
![Figure1](https://github.com/takumanken/thesis/blob/main/design_mockup/images/architecture.png?raw=true)


1. **Web UI**  
   - Users type queries into a simple input field (for example, “How have 311 noise complaints changed over the past five years in Manhattan?”).  
   - After submission, the **Backend** forwards the query as a prompt to **Google AI Studio (Gemini)**.

2. **Google AI Studio (Gemini)**  
   - Gemini is responsible for turning the user’s query into a structured **aggregation definition**, identifying which dimensions, measures, and filters are needed.  
   - Based on the user’s intent, Gemini also recommends the best **chart type** (e.g., bar chart, line chart, scatter plot).

3. **SQL Generator**  
   - After receiving the aggregation details from Gemini, the system passes them to the **SQL Generator**.  
   - The SQL Generator then constructs a query specific to an **in-memory database**, which houses the relevant datasets for faster access.

4. **In-Memory Database**  
   - This database retrieves the requested data, applying the necessary filters and group-by operations defined in the SQL query.

5. **Chart Visualization**  
   - The **Aggregated Data** from the database is combined with the **Chart Type** recommended by Gemini.  
   - The frontend then displays a **Chart** that aligns with the original question, allowing users to gain insights quickly.

By uniting these components—Web UI, Gemini, SQL Generator, and the in-memory database—into a cohesive pipeline, the system shields users from the complexities of data handling. They simply ask a question in plain language and receive an automated, data-driven chart in response.

### 3.2 User Interface

The user interface is designed to give users a smooth and intuitive way to explore NYC Open Data. It features two main screens—one for initial queries and one for interactive exploration—each tailored to support users with different levels of experience.

#### 3.2.1 Cover Page

Figure 2
![Figure2](https://github.com/takumanken/thesis/blob/main/design_mockup/images/cover_page.png?raw=true)

When users first visit the system, they see a **cover page** that explains its purpose. The layout is minimalist, featuring the system’s name, **“ASK NYC: Conversational Interface for NYC Open Data,”** along with a brief tagline describing its mission.

A prominent **search input box** is positioned in the center, where users can type natural language queries like, “What is the monthly trend of 311 complaints by borough?” A simple dropdown menu allows users to pick a dataset category (e.g., “311 Requests”), ensuring their question targets the correct data source.

Below the search field, **sample questions** demonstrate common ways to phrase queries and showcase the range of questions the interface can handle. This guided approach helps newcomers formulate effective queries.

#### 3.2.2 Main Page

Figure 3
![Figure3](https://github.com/takumanken/thesis/blob/main/design_mockup/images/bar_chart.png?raw=true)

After submitting a query, users are taken to the **main page**, which displays the system’s response. The main page includes several key elements:

1. **AI-Generated Chart**  
   - At the center is the **AI-generated chart**, showing the data based on the user’s query.  
   - Depending on the question, the system will automatically select a **chart type** (e.g., bar chart, line chart, or table) through **Google AI Studio (Gemini)**.  
   - Each chart is accompanied by a title and a timestamp, clarifying the data source and timeframe.

2. **Chart Definition Panel**  
   - A **Chart Definition** panel on the side reveals the dimensions (e.g., *Borough, Created Date*), metrics (e.g., *Number of Requests*), and filters (e.g., *Created Date >= 01/01/2020*) applied to create the chart.  
   - This helps users understand how the system converted their natural language query into structured data operations.

3. **Chart Type Selector**  
   - For flexibility, users can **switch chart types** (for example, from a bar chart to a line chart or a table), letting them view the same data in different ways and uncover more insights.

4. **Interactive Features**  
   - Interactive elements—such as a **download button** for exporting visualizations and tooltips for detailed data point explanations—enhance the user experience.
