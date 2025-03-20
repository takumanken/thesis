# A Natural Language Interface for Exploring NYC Open Data: Enhancing Public Access to Data

## 1. Abstract

Open data portals are valuable resources for research, civic engagement, business insights, and data-driven policymaking. However, these portals are often underused because they can be complex to navigate—especially for people without technical expertise. This thesis proposes a **natural language interface (NLI)** that leverages modern AI techniques to simplify data exploration and visualization. As a proof of concept, the system focuses on a subset of [NYC Open Data](https://opendata.cityofnewyork.us/), one of the largest municipal data repositories in the United States.

With this NLI, users can pose everyday questions—such as “Show crime trends in Brooklyn since 2020” or “How many rat sightings have been reported in each borough?”—and receive relevant visualizations automatically. By reducing the need for manual data processing, the NLI helps non-technical users explore open data in a more intuitive and meaningful way.

By combining established methods of data aggregation and visualization with recent advances in AI, this thesis demonstrates how NLIs can broaden access to open data. It also discusses the main challenges of creating such interfaces and offers practical strategies to enhance user experience. Ultimately, this work aims to encourage broader participation and a deeper, data-informed understanding of urban communities.

---

## 2. Introduction

### 2.1 Current Open Data Challenges

Open data portals have improved government transparency, inspired innovation, and strengthened community engagement. Despite these benefits, many people find it difficult to fully use these portals. Although the information is publicly available, interpreting it often requires programming or analytical skills. This limitation can prevent researchers, policymakers, and community members from gaining insights that could drive informed decisions.

NYC Open Data—one of the most prominent open data portals—faces similar issues. A 2017 study noted that many users saw it as a platform mainly for “civic hackers and tech journalists,” highlighting the need to make open data more accessible. Converting raw datasets into useful information requires expertise that many users do not possess.

A significant part of the challenge lies in **data aggregation and visualization**, which typically demand specialized knowledge. These tasks can be divided into two main areas:

---

#### Data Aggregation

Most open data portals assume users can manage raw data on their own. In practice, two common approaches to distributing open data demonstrate the hurdles that non-technical users frequently encounter.

##### Approach 1: File-Based Data Distribution

Many platforms, including [DATA.GOV](https://data.gov/), provide datasets in CSV, Excel, or JSON formats. While these files are easy to download, they come with certain challenges:

1. **Local Burden**  
   Users have to load, clean, filter, and transform the data themselves, usually relying on tools such as Excel, Python, or R.

2. **Scalability Constraints**  
   Large datasets can exceed the capabilities of a standard computer, making it difficult—or even impossible—to process them locally.

##### Approach 2: Portal-Based Aggregation Tools

Portals like [NYC Open Data](https://opendata.cityofnewyork.us/) offer built-in tools for filtering and grouping data prior to download. Although this approach helps reduce dataset sizes, users must still understand operations like “group-by” and “aggregation methods,” which can be daunting for those without a data background.

---

#### Data Visualization

After data is aggregated, users face additional challenges when trying to present it clearly:

1. **Chart Selection**  
   Picking the right chart type—such as a bar chart, line chart, scatter plot, or histogram—requires a basic understanding of visualization principles.

2. **Software Proficiency**  
   Tools like Excel can be intimidating, especially for new users. Tasks like cleaning date fields, aligning data, and structuring variables can deter those with limited technical skills.

While NYC Open Data’s interface includes features like setting dimensions and measures, it still assumes familiarity with specialized terms and workflows. This requirement may discourage people who are less technically inclined.

In summary, although open data portals contain a wealth of information, the skills needed to aggregate and visualize data can exclude many potential users. This situation shows the value of a natural language interface that helps users carry out these tasks without extensive technical knowledge.

---

### 2.2 The Proposed Natural Language Interface: Enhancing Open Data Accessibility

This thesis introduces a **natural language interface (NLI)** to address the challenges described above. By allowing users to ask questions in everyday language—rather than writing code or using complicated tools—the NLI removes a major barrier to exploring open datasets. The following sections discuss why natural language is well-suited for data aggregation and visualization, and how modern language models make this approach increasingly practical.

#### 2.2.1 Why Natural Language Is a Viable Solution

Everyday language naturally encompasses the key elements necessary for **data aggregation** and **data visualization**:

1. **Identifying Key Components**  
   Consider a query such as “How have 311 noise complaints changed over the past five years in Manhattan?” This question already specifies the dimensions (time and location), measures (number of noise complaints), and filters (Manhattan, five-year timeframe). These components form the foundation of a data request.

2. **Choosing the Right Chart**  
   Natural language queries also hint at the most effective chart type:  
   - A time-based query (“How has it changed over time?”) often suggests a **line chart**.  
   - A query about relationships (“Are rat sightings more frequent in densely populated areas?”) may fit a **scatter plot**.  
   - A request for comparisons (“Which borough had the highest rise in noise complaints?”) may call for a **bar chart**.

By capturing both the data requirements and the likely visualization style, everyday language provides a strong basis for automating data operations and chart selection. The NLI interprets user intent, applies the necessary filters and groupings, and recommends a suitable chart without requiring technical skills from the user.

#### 2.2.2 Why This Approach Is Feasible Today

Using natural language to explore data is not new, but it has traditionally been difficult to implement reliably. Free-form text often led to errors or misinterpretations. However, modern **large language models (LLMs)** have made significant progress in addressing these issues:

- **Better Semantic Understanding**  
  Contemporary LLMs can parse nuanced language, including synonyms and ambiguous expressions.  
- **Enhanced Contextual Reasoning**  
  These models go beyond keyword matching, enabling them to handle incomplete or vaguely worded queries more robustly.

Thanks to these advances, an NLI can now more consistently interpret user queries, convert them into accurate data transformations, and produce coherent visual outputs. The following sections outline how these ideas are applied to NYC Open Data, from parsing user requests to displaying the final charts.

#### 2.2.3 Relevant Initiatives in the Business Intelligence Field

The business intelligence (BI) sector has recently seen a surge in tools that use natural language and conversational analytics, making it easier for users to query data in plain language. Below are two notable examples:

1. **ThoughtSpot’s “Spotter” Autonomous Agent**  
   ThoughtSpot has long been a leader in search-based analytics. Their [Spotter](https://www.thoughtspot.com/press-releases/thoughtspot-launches-spotter-the-autonomous-agent-for-analytics) agent adds proactive features, suggesting insights or visualizations before the user even asks. This reflects the industry shift toward AI-driven, self-service analytics.

2. **Looker’s Conversational Analytics**  
   Part of Google Cloud, Looker uses AI agents to process natural language queries. As described in [recent discussions](https://www.nojitter.com/ai-automation/conversations-in-collaboration-peter-bailis-with-google-cloud-on-using-ai-agents-for-business-intelligence-and-analytics), the platform integrates with collaboration tools and relies on a semantic layer to interpret ambiguous questions, returning relevant charts or metrics.

**Implications for Public Data**  
These BI developments can guide future enhancements to open data portals. Integrating user-friendly, conversation-based features and proactive insights can significantly lower the entry barriers—particularly for non-technical users. Applying industry best practices to public portals like NYC Open Data can widen access to data and support deeper civic engagement.

### 2.3 Potential Challenge and Strategy

Even though large language models (LLMs) have greatly improved natural language interfaces, **hallucination** remains a significant concern. Hallucination occurs when a model confidently provides information that is incorrect or unrelated to the source data. In the context of open data, unreliable answers can undermine trust and lead to poor decisions, so it is essential to manage this risk effectively.

To address this challenge, this thesis adopts a **semantic layer** that aligns natural language queries with structured data. This layer ensures that user requests correspond to valid database fields, data types, and transformations. It includes:

1. **Database Schema Details**  
   - Table names (e.g., `311_requests`)  
   - Column names, data types, and typical values (e.g., “Manhattan,” “Brooklyn,” “Queens”)  
   - Calculation rules (e.g., `COUNT(*) AS number_of_requests`)

2. **Word Dictionary (Synonyms and Variants)**  
   - Links common synonyms or alternative phrases (e.g., “noise complaint” = “noise issue”) to the correct fields  
   - Provides flexible matching between user queries and relevant technical terms

3. **Chart Type Selection**  
   - Recommends charts based on query intent (e.g., bar chart for comparison, line chart for time series) and data attributes (categorical, numerical, etc.).  

By anchoring user requests to this semantic layer, the system reduces errors and prevents misleading outputs. Instead of generating free-form responses, the NLI can validate queries against structured metadata, resulting in more accurate and trustworthy data retrieval and visualization.

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
