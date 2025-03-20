# A Natural Language Interface for Exploring NYC Open Data: Enhancing Public Access to Data

## 1. Abstract

Open data portals are powerful resources that promote research, civic engagement, business insights, and data-driven decision-making across many fields. However, they often go underused because they can be difficult to navigate and interpret—especially for individuals without specialized technical skills. This thesis proposes a **natural language interface (NLI)** that employs modern AI techniques to make data exploration and visualization more intuitive. As a proof of concept, the system focuses on a subset of [NYC Open Data](https://opendata.cityofnewyork.us/), one of the largest municipal data repositories in the United States.

The NLI allows users to ask everyday questions about New York City—such as “Show crime trends in Brooklyn since 2020” or “How many rat sightings have been reported in each borough?”—and automatically returns relevant visualizations. This approach removes the burden of handling data processing, making it easier for users without technical backgrounds to engage with open data in a meaningful way.

By uniting established methods of data aggregation and visualization with recent advances in AI, this thesis demonstrates how NLIs can widen access to open data. It also examines key challenges in developing these interfaces and offers practical strategies to improve usability. Ultimately, the work aims to encourage broader participation and a deeper, data-informed understanding of urban communities.

---

## 2. Introduction

### 2.1 Current Open Data Challenges

Open data portals have improved government transparency, sparked innovation, and inspired community engagement. Despite these achievements, their complexity often stops many people from using them to their full potential. Although the data is publicly available, extracting insights usually requires familiarity with programming or analytical tools. Consequently, researchers, policymakers, and community members without technical skills may find it difficult to work with these datasets, limiting the broader impact of open data.

NYC Open Data—a prominent portal—faces these same hurdles. A 2017 study indicated that many users considered the portal mostly useful for “civic hackers and tech journalists,” illustrating a need to make open data more approachable. Transforming raw data into actionable information involves skills that many do not possess.

A major part of the challenge lies in **data aggregation and visualization**. These tasks frequently demand specialized expertise and can be divided into two main categories.

---

#### Data Aggregation

Most open data portals expect users to have a basic understanding of handling data. In practice, two common approaches to distributing open data highlight the obstacles non-technical users regularly confront.

##### Approach 1: File-Based Data Distribution

Many platforms, including [DATA.GOV](https://data.gov/), offer datasets in CSV, Excel, or JSON formats. While these files are easy to download, they present significant difficulties:

1. **Local Burden**  
   Users must load, clean, filter, and transform the data on their own, often relying on tools like Excel, Python, or R.

2. **Scalability Constraints**  
   Large datasets can quickly overwhelm personal computers, making it hard—or even impossible—for individuals to work with the data locally.

##### Approach 2: Portal-Based Aggregation Tools

Other portals, like [NYC Open Data](https://opendata.cityofnewyork.us/), offer built-in features for filtering and grouping data before downloading. Although these features help reduce dataset size, they still assume users know concepts such as “group-by” and “aggregation methods,” which can discourage people who are not data professionals.

---

#### Data Visualization

After the data is aggregated, users face additional hurdles in presenting it:

1. **Chart Selection**  
   Choosing an appropriate chart type—bar chart, line chart, scatter plot, or histogram—requires understanding fundamental visualization principles.

2. **Software Proficiency**  
   Tools like Excel can be challenging for those without training. Cleaning date fields, aligning data, and arranging variables for clear visual representation can all pose significant barriers.

While NYC Open Data’s interface includes some helpful features—like setting dimensions and measures—it still demands that users learn specialized terminology and workflows. This learning curve can discourage those without technical experience.

In summary, open data portals contain vast amounts of valuable information, but the expertise required for data aggregation and visualization can exclude many potential users. This highlights the importance of a natural language interface that guides people through these steps without requiring advanced technical knowledge.

---

### 2.2 The Proposed Natural Language Interface: Enhancing Open Data Accessibility

This thesis introduces a **natural language interface (NLI)** to address the challenges described above. By enabling users to ask questions in everyday language rather than writing code or navigating complicated tools, the NLI removes a significant barrier to exploring open datasets. The following sections explain why natural language is well-suited for both data aggregation and visualization, and how modern language models make this approach more effective than ever.

#### 2.2.1 Why Natural Language Is a Viable Solution

Everyday language naturally conveys the essential elements for **data aggregation** and **data visualization**:

1. **Identifying Key Components**  
   When someone asks, “How have 311 noise complaints changed over the past five years in Manhattan?” the question already indicates the *dimensions* (time and location), *measures* (number of noise complaints), and *filters* (Manhattan, past five years). The user’s question contains the building blocks needed to create a data request.

2. **Choosing the Right Chart**  
   Natural language queries can also guide the choice of visualization:  
   - A question about trends over time (“How has it changed over time?”) often calls for a **line chart**.  
   - A query about correlations (“Are rat sightings higher in densely populated areas?”) may suggest a **scatter plot**.  
   - A request for comparisons (“Which borough had the highest increase in noise complaints?”) may be best represented by a **bar chart**.

In this way, everyday language encodes key information for data operations and visualization design. The NLI interprets the user’s intent, converts it into relevant steps (like group-bys and filters), and picks an appropriate chart—without requiring the user to learn technical details.

#### 2.2.2 Why This Approach Is Feasible Today

Using natural language to explore data is not a new idea, but historically, it was difficult to do well. Parsing free-form text often led to inaccuracies or confusion. Recent **large language models (LLMs)** have made notable progress in overcoming these obstacles:

- **Better Semantic Understanding**  
  Modern LLMs can interpret subtle language cues, managing synonyms and ambiguous phrases more accurately.
- **Enhanced Contextual Reasoning**  
  These models go beyond keyword matching by handling incomplete or vaguely worded requests in a more robust manner.

Due to these improvements, an NLI can now reliably parse user queries, translate them into the appropriate data transformations, and generate coherent visual results. The next section outlines the steps taken in this thesis to create such an interface for NYC Open Data, from parsing the user’s request to displaying the final chart.

#### 2.2.3 Relevant Initiatives in the Business Intelligence Field

The business intelligence (BI) world has seen a wave of tools featuring natural language and conversational analytics, allowing users to query data in plain language. Two notable examples illustrate this trend:

1. **ThoughtSpot’s “Spotter” Autonomous Agent**  
   ThoughtSpot has long offered search-based analytics. Their [Spotter](https://www.thoughtspot.com/press-releases/thoughtspot-launches-spotter-the-autonomous-agent-for-analytics) agent expands on this by proactively suggesting insights or visualizations—acting like a co-pilot. Spotter can even highlight metric shifts or correlations without a specific query, reflecting the broader shift toward AI-driven self-service analytics.

2. **Looker’s Conversational Analytics**  
   Now part of Google Cloud, Looker uses AI agents for natural language queries. As discussed in [recent discussions](https://www.nojitter.com/ai-automation/conversations-in-collaboration-peter-bailis-with-google-cloud-on-using-ai-agents-for-business-intelligence-and-analytics), Looker’s conversational interface integrates with collaboration tools, and its semantic layer helps interpret ambiguous questions to generate relevant charts or metrics.

**Implications for Public Data**  
These BI developments can guide the evolution of public open data portals. Incorporating user-friendly, conversational features and proactive insights can lower barriers to data exploration—particularly in platforms like NYC Open Data, which cater to a broad, non-technical audience. Adapting industry best practices for public data can promote greater access and encourage civic engagement.

---

## 3. Treatment

### 3.1 System Architecture

This section explains how the proposed natural language interface is designed and how its components operate together. **Figure 1** (below) shows the process: from a user’s question to the system’s final chart output. The primary goal is to enable users to explore open data simply by typing everyday language, without needing to write code or master analytical software.

**Figure 1**  
![Figure1](https://github.com/takumanken/thesis/blob/main/design_mockup/images/architecture.png?raw=true)

1. **Frontend (Web UI)**  
   - Users type their queries in a simple input field (e.g., “How have 311 noise complaints changed over the past five years in Manhattan?”).  
   - The **Backend** sends this query to **Google AI Studio (Gemini)** as a prompt.

2. **Google AI Studio (Gemini)**  
   - Gemini interprets the user’s query and creates a structured **aggregation definition**, determining which dimensions, measures, and filters are required.  
   - Based on the user’s intent, Gemini also recommends the best **chart type** (e.g., bar chart, line chart, scatter plot).

3. **SQL Generator**  
   - The system forwards Gemini’s aggregation details to the **SQL Generator**.  
   - The SQL Generator converts these instructions into a query tailored for an **in-memory database**, where relevant datasets are stored for quick retrieval.

4. **In-Memory Database**  
   - The database runs the query, applying any specified filters and group-bys as needed.

5. **Chart Visualization**  
   - The **aggregated data** is then combined with the **chart type** suggested by Gemini.  
   - The frontend displays a **chart** that matches the user’s original question, enabling quick data insights.

By unifying these components—Web UI, Gemini, SQL Generator, and an in-memory database—into a coherent pipeline, the system hides the technical complexities of data handling. Users simply type a question in everyday language, and an automated chart is returned.

### 3.2 User Interface

The user interface is designed to help both newcomers and experienced users explore NYC Open Data with minimal effort. It offers two main views—a **cover page** for initial queries and a **main page** for interactive exploration—both focused on simplicity and clarity.

#### 3.2.1 Cover Page

**Figure 2**  
![Figure2](https://github.com/takumanken/thesis/blob/main/design_mockup/images/cover_page.png?raw=true)

Upon first visiting the system, users see a **cover page** that briefly outlines its purpose. The design is straightforward, featuring:

- The system’s name, **“ASK NYC: Conversational Interface for NYC Open Data”**, and a concise description of its mission.  
- A prominent **search input box**, where users can enter natural language queries like “What is the monthly trend of 311 complaints by borough?”  
- A simple dropdown to select a dataset category (e.g., “311 Requests”), ensuring the query is directed to the correct data.  
- **Sample questions** listed below the search bar to guide new users and show them how to phrase effective queries.

#### 3.2.2 Main Page

**Figure 3**  
![Figure3](https://github.com/takumanken/thesis/blob/main/design_mockup/images/bar_chart.png?raw=true)

After submitting a query, users move on to the **main page**, which displays the system’s response. Key elements include:

1. **AI-Generated Chart**  
   - A **chart** in the center shows the data based on the user’s question.  
   - **Google AI Studio (Gemini)** chooses the chart type—bar chart, line chart, or table—according to the user’s intent.  
   - Each chart has a clear title and timestamp, indicating its data source and timeframe.

2. **Chart Definition Panel**  
   - A side panel reveals the **dimensions** (e.g., *Borough, Created Date*), **metrics** (e.g., *Number of Requests*), and **filters** (e.g., *Created Date >= 01/01/2020*) applied to generate the chart.  
   - This information helps users see how their natural language query turned into structured data operations.

3. **Chart Type Selector**  
   - A **chart type selector** allows users to switch between different chart styles (e.g., bar, line, table) to explore various perspectives on the same data.

4. **Interactive Features**  
   - Additional interactive features—such as a **download button** for saving visualizations and tooltips explaining data points—enhance the user experience and encourage deeper data exploration.
