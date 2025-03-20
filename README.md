# A Natural Language Interface for Exploring NYC Open Data: Enhancing Public Access to Data

## 1. Abstract

Open data portals are valuable tools that foster research, civic engagement, business insights, and data-driven policymaking. However, these portals often remain underused because they can be difficult to navigate and interpret—particularly for users without specialized technical skills. This thesis proposes a **natural language interface (NLI)** that uses modern AI techniques to simplify data exploration and visualization. As a proof of concept, the system focuses on a subset of [NYC Open Data](https://opendata.cityofnewyork.us/), one of the largest municipal data repositories in the United States.

The NLI enables users to pose everyday questions—such as “Show crime trends in Brooklyn since 2020” or “How many rat sightings have been reported in each borough?”—and automatically returns relevant visualizations. By removing the need for manual data processing, it allows non-technical users to explore open data in a more intuitive and meaningful way.

By integrating established methods of data aggregation and visualization with recent advancements in AI, this thesis illustrates how NLIs can expand access to open data. It also explores the main challenges involved in developing these interfaces and offers practical suggestions for improving user experience. Ultimately, this work aims to promote broader participation and a deeper, data-informed understanding of urban communities.

---

## 2. Introduction

### 2.1 Current Open Data Challenges

Open data portals have advanced government transparency, fueled innovation, and energized community engagement. Yet, their complexity often prevents many people from fully benefiting from them. Although the data itself is publicly available, extracting useful insights typically requires programming or analytical skills. As a result, researchers, policymakers, and community members who lack these skills may struggle to work with open data, limiting its overall impact.

NYC Open Data—one of the most well-known open data portals—faces similar challenges. A 2017 study suggested that many users saw it primarily as a resource for “civic hackers and tech journalists,” highlighting the need to make open data more approachable. Turning raw datasets into actionable information demands expertise that many individuals do not have.

A significant part of the problem lies in **data aggregation and visualization**, which often require specialized knowledge and can be split into two main areas.

---

#### Data Aggregation

Most open data portals assume users can already manage data in its raw form. In practice, two common methods for distributing open data reveal the obstacles that non-technical users often face.

##### Approach 1: File-Based Data Distribution

Several platforms, including [DATA.GOV](https://data.gov/), provide datasets in CSV, Excel, or JSON formats. Though these files are simple to download, they present challenges:

1. **Local Burden**  
   Users must load, clean, filter, and transform the data on their own, typically using tools such as Excel, Python, or R.

2. **Scalability Constraints**  
   Large datasets can overwhelm standard personal computers, making it difficult—or even impossible—to handle the data locally.

##### Approach 2: Portal-Based Aggregation Tools

Other platforms, like [NYC Open Data](https://opendata.cityofnewyork.us/), feature built-in tools for filtering and grouping data before download. Although this can help reduce dataset sizes, it still requires familiarity with concepts like “group-by” and “aggregation methods,” which may discourage users who lack a background in data analysis.

---

#### Data Visualization

Once data is aggregated, users face additional hurdles in transforming it into clear visualizations:

1. **Chart Selection**  
   Choosing the right chart type—bar chart, line chart, scatter plot, or histogram—calls for a basic understanding of visualization principles.

2. **Software Proficiency**  
   Tools like Excel can be intimidating for newcomers. Cleaning date fields, aligning datasets, and arranging variables for a clear visual display are all tasks that may pose barriers to less experienced users.

Although NYC Open Data’s interface provides some useful features—like specifying dimensions and measures—users are still required to learn specialized terminology and workflows. This can discourage those who are not technically inclined.

Overall, while open data portals offer a wealth of information, the skills needed for data aggregation and visualization often exclude many potential users. This situation highlights the importance of a natural language interface that leads users through these processes without requiring advanced technical knowledge.

---

### 2.2 The Proposed Natural Language Interface: Enhancing Open Data Accessibility

This thesis presents a **natural language interface (NLI)** as a solution to the issues outlined above. By allowing users to ask plain-language questions instead of writing code or using complex software, the NLI lowers the barrier to exploring open datasets. The following sections explain why natural language is ideal for data aggregation and visualization, and how modern language models make such an approach increasingly viable.

#### 2.2.1 Why Natural Language Is a Viable Solution

Everyday language naturally includes the core elements needed for **data aggregation** and **data visualization**:

1. **Identifying Key Components**  
   For instance, a query like “How have 311 noise complaints changed over the past five years in Manhattan?” already specifies the dimensions (time and location), measures (number of noise complaints), and filters (Manhattan, past five years). These details form the basis of a data request.

2. **Choosing the Right Chart**  
   Natural language queries can guide the choice of chart type:  
   - A time-based query (“How has it changed over time?”) often calls for a **line chart**.  
   - A query about relationships (“Are rat sightings more frequent in densely populated areas?”) may be best shown as a **scatter plot**.  
   - A request for comparisons (“Which borough had the highest rise in noise complaints?”) often suggests a **bar chart**.

In this manner, everyday language embeds the logic needed for data operations and visualization design. The NLI interprets the user’s request, converts it into steps like filtering and grouping, and then selects a suitable chart—without requiring the user to master technical concepts.

#### 2.2.2 Why This Approach Is Feasible Today

Though the idea of using natural language for data exploration is not new, it was historically challenging to implement accurately. Parsing free-form text often led to errors or misunderstandings. Modern **large language models (LLMs)** have significantly mitigated these issues:

- **Better Semantic Understanding**  
  Contemporary LLMs can interpret nuanced language, including synonyms and ambiguous statements.  
- **Enhanced Contextual Reasoning**  
  These models move beyond simple keyword matching, responding effectively to incomplete or vague queries.

Because of these advancements, an NLI can now reliably decode user questions, translate them into correct data transformations, and produce coherent visual outputs. The next section describes how this thesis applies these concepts to NYC Open Data, from interpreting user requests to displaying final charts.

#### 2.2.3 Relevant Initiatives in the Business Intelligence Field

The field of business intelligence (BI) has seen rapid growth in tools that leverage natural language and conversational analytics, allowing users to pose queries in everyday language. Below are two notable examples:

1. **ThoughtSpot’s “Spotter” Autonomous Agent**  
   ThoughtSpot has led the way in search-based analytics. Their [Spotter](https://www.thoughtspot.com/press-releases/thoughtspot-launches-spotter-the-autonomous-agent-for-analytics) agent goes further by suggesting insights or visualizations automatically—acting like a co-pilot. Spotter can highlight metric changes or correlations without a direct user query, underscoring the move toward AI-driven, self-service analytics.

2. **Looker’s Conversational Analytics**  
   Part of Google Cloud, Looker uses AI agents to handle natural language inquiries. According to [recent discussions](https://www.nojitter.com/ai-automation/conversations-in-collaboration-peter-bailis-with-google-cloud-on-using-ai-agents-for-business-intelligence-and-analytics), Looker’s system can integrate with collaboration tools, and its semantic layer helps interpret ambiguous questions to return relevant charts or metrics.

**Implications for Public Data**  
These BI developments can inform how public open data portals evolve. By incorporating user-friendly, conversational features and proactive insights, such platforms can lower barriers to data analysis—especially for non-technical audiences. Applying these commercial best practices to public portals like NYC Open Data can expand data accessibility and foster greater civic engagement.

### 2.3 Potential Challenge and Strategy

Although large language models (LLMs) have greatly improved the accuracy of natural language interfaces, **hallucination** remains a major concern. Hallucination happens when a model generates information that seems correct but is actually inaccurate or irrelevant. In the context of open data, where incorrect insights can erode trust and lead to bad decisions, it’s essential to minimize this risk.

To address this issue, this work implements a **semantic layer**—a translation layer that aligns everyday language with structured data schemas. The semantic layer helps ensure that user queries map accurately to valid database elements and domain knowledge. It achieves this by:

1. **Database Schema Details**  
   - Listing table names (e.g., `311_requests`)  
   - Specifying column names, data types, and typical values (e.g., *Manhattan, Brooklyn, Queens*)  
   - Defining calculation rules (e.g., `COUNT(*) AS number_of_requests`)

2. **Word Dictionary (Synonyms and Variants)**  
   - Linking common synonyms or alternative phrases (e.g., “noise complaint” = “noise issue”) to the correct field  
   - Supporting flexible matching so user queries map to technical terms properly

By anchoring queries to the semantic layer, the system reduces confusion and lowers the chance of generating unfounded answers. Instead of relying solely on unstructured generation, the NLI validates user requests against known schema elements and synonyms, leading to more accurate data retrieval and visualization.

---

## 3. Treatment

### 3.1 System Architecture

This section outlines how the proposed natural language interface is built and how its components interact. **Figure 1** (below) depicts the overall workflow, from a user’s plain-language query to a final chart. The main goal is to let users explore open data through everyday language rather than having to code or learn complex analysis tools.

**Figure 1**  
![Figure1](https://github.com/takumanken/thesis/blob/main/design_mockup/images/architecture.png?raw=true)

1. **Frontend (Web UI)**  
   - Users enter queries in a text box (e.g., “How have 311 noise complaints changed over the past five years in Manhattan?”).  
   - The **Backend** submits this query to **Google AI Studio (Gemini)** as a prompt.

2. **Google AI Studio (Gemini)**  
   - Gemini processes the query and generates an **aggregation definition** that specifies the needed dimensions, measures, and filters.  
   - Based on the intent of the query, Gemini recommends the best **chart type** (e.g., bar chart, line chart, scatter plot).

3. **SQL Generator**  
   - The system sends Gemini’s aggregation details to the **SQL Generator**.  
   - The SQL Generator creates a SQL query for an **in-memory database**, which stores the relevant datasets for faster response times.

4. **In-Memory Database**  
   - The database runs the SQL query, applying the specified filters and group-by operations.

5. **Chart Visualization**  
   - The system then combines the **aggregated data** with the suggested **chart type**.  
   - The frontend displays a **chart** that aligns with the user’s original question, providing immediate insights.

By orchestrating these components—Web UI, Gemini, SQL Generator, and the in-memory database—into a single pipeline, the system shields users from technical complexities. Users merely type a plain-language question, and the system returns an automated, data-driven visualization.

### 3.2 User Interface

The user interface is designed for simplicity and ease of use, making it accessible to both novices and experienced users. It offers two main screens—a **cover page** for initial queries and a **main page** for interactive exploration—each focused on delivering a smooth user experience.

#### 3.2.1 Cover Page

**Figure 2**  
![Figure2](https://github.com/takumanken/thesis/blob/main/design_mockup/images/cover_page.png?raw=true)

On first visit, the **cover page** greets users with a concise explanation of the system’s purpose. The layout features:

- The system’s name, **“ASK NYC: Conversational Interface for NYC Open Data,”** alongside a brief overview of its mission.  
- A prominent **search box** where users can type natural language queries like “What is the monthly trend of 311 complaints by borough?”  
- A simple dropdown menu for choosing a dataset category (e.g., “311 Requests”), ensuring the query is directed to the correct data.  
- **Example questions** below the search field that guide new users in forming their own queries.

#### 3.2.2 Main Page

**Figure 3**  
![Figure3](https://github.com/takumanken/thesis/blob/main/design_mockup/images/bar_chart.png?raw=true)

After entering a query, users arrive at the **main page**, where the system’s response is displayed. Key elements include:

1. **AI-Generated Chart**  
   - At the center is a **chart** created based on the user’s question.  
   - **Google AI Studio (Gemini)** automatically picks the chart type—bar, line, or table—according to the query’s intent.  
   - Each chart is labeled with a clear title and a timestamp, indicating the data source and timeframe.

2. **Chart Definition Panel**  
   - A side panel displays the **dimensions** (e.g., *Borough, Created Date*), **metrics** (e.g., *Number of Requests*), and **filters** (e.g., *Created Date >= 01/01/2020*) used to produce the chart.  
   - This breakdown helps users understand how their natural language question was translated into data queries.

3. **Chart Type Selector**  
   - A **chart type selector** lets users switch among different chart formats (e.g., bar, line, table), helping them uncover different perspectives on the same data.

4. **Interactive Features**  
   - Additional features—such as a **download button** for exporting visualizations and tooltips for explaining specific data points—enhance the user experience and encourage deeper exploration.
