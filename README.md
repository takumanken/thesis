# Project Title
**AskNYC: A Conversational Interface for NYC Open Data**

## 1. Abstract
This thesis explores the creation of a novel user experience with [NYC Open Data](https://opendata.cityofnewyork.us/), a massive municipal dataset that provides valuable insights into New York City. Its primary goal is to develop a conversational interface that facilitates data aggregation and visualization through natural language interaction. By integrating state-of-the-art generative AI with established data aggregation and visualization methods, this research aims to improve the usability of open data while expanding accessibility to a wide range of users. A comprehensive literature review examines both historical and contemporary initiatives in natural language interfaces for data aggregation and the principles of map selection. The resulting findings will guide system development and optimization, ultimately improving the way diverse user groups interact with open data.

## 2. Background and Motivation

### 2-1. Background
Although **NYC Open Data** can benefit a wide range of users—from students to data scientists—the current interface requires a specific set of skills and conditions that can limit accessibility:

- **Data Aggregation Skills**  
  - Understanding of data aggregation terminology (e.g., dimensions, measures)
  - Proficiency in data aggregation tasks (e.g., aggregation vs. non-aggregation, pre-/post-aggregation filters, and creating new calculations)

- **Data Visualization Skills**  
  - Ability to select the appropriate chart type (e.g., using a bar chart for category comparisons)  
  - Familiarity with data visualization tools (e.g., existing UIs, Excel, Tableau, or programming languages like R/Python)

- **Other Accessibility Challenges**  
  - **Language**: The interface is primarily available in English, potentially excluding non-English-speaking users  

### 2-2. Motivation
To develop an interface that expands accessibility to a wider range of users, the following requirements are crucial:

- **Automated Data Aggregation**  
  - Automatic detection and application of suitable aggregations (dimension or measure, pre-/post-aggregation filters)  
  - Capability to generate new calculations based on user requests (e.g., cumulative amounts, year-over-year, week-over-week)  
- **Automated Data Visualization**
    - Intelligent chart selection aligned with established best practices for chart usage

- **Multi-Language Interface**  
  - Support for multiple languages to accommodate users with varying linguistic backgrounds


## 3. Treatment

### 3.1 Research
A comprehensive study will be conducted on the key areas related to the system, including **data aggregation**, **data visualization**, and **large language models (LLMs).**

#### 3.1.1 Data Aggregation with Natural Language
- **Historical Efforts**: Previous research and implementations of natural language interfaces for data retrieval.
- **Current Initiatives**: State-of-the-art techniques and advancements in enabling natural language-driven data aggregation.

#### 3.1.2 Data Visualization and Chart Selection
- **Historical Approaches**: Past research on automated chart selection based on user queries.
- **Current Trends**: Modern data visualization initiatives incorporating natural language interaction.

#### 3.1.3 Evaluating Vanilla LLM Capabilities and Solutions
A structured assessment of the raw capabilities of large language models will be conducted:

- **3.1.3.1 Vanilla LLM Capability Assessment**
    - **Data Aggregation Accuracy**: Can the LLM interpret user queries correctly and execute precise data queries?  
    - **Chart Selection Accuracy**: Can the LLM suggest the appropriate chart type for given queries?  
    - **Code Generation Accuracy**: Can the LLM generate functional and error-free code for data visualization?  

- **3.1.3.2 Solution Design Based on Assessment Findings**
    - Developing strategies to enhance LLM performance based on identified limitations.


### 3.2 System Design & Development
Based on research findings, the system's user experience (UI/UX) and architecture will be designed and implemented.

#### 3.2.1 System Design
- **UI/UX Design**
    - Developing an intuitive natural language interface.
    - Identifying essential UI components to facilitate user interaction.
- **System Architecture**
    - Structuring the backend and frontend components.
    - Defining workflows for query processing and visualization generation.

#### 3.2.2 System Development
- **Implementation** of the designed system, incorporating insights from research.
- **Testing & Iteration** to refine functionality and improve performance.


## 4. Evaluation & Conclusion

### 4.1 UI/UX Evaluation
- Assessing the impact of the conversational interface on user interaction with NYC Open Data.
- **Comparative Analysis**: Evaluating improvements over existing UI/UX models.

### 4.2 System Performance Evaluation
- **Data Aggregation Accuracy**: Measuring the correctness of LLM-driven data queries.
- **Chart Selection Accuracy**: Assessing the effectiveness of LLM-powered chart selections.

### 4.3 Future Work & Improvements
- Identifying potential enhancements for system accuracy and usability.
- Exploring future integration with evolving AI and data visualization technologies.


## 5. Literature Review
### 5-1. Chart Selection
- Cleveland, William S., and Robert McGill. “Graphical Perception: Theory, Experimentation, and Application to the Development of Graphical Methods.” Journal of the American Statistical Association 79, no. 387 (1984): 531–54. https://doi.org/10.2307/2288400.
- Chambers, John M. Graphical methods for data analysis. Boca Raton, FL: CRC Press, 2018. 
- Ware, Colin. Information Visualization : Perception for Design. Waltham, Ma: Morgan Kaufmann, 2019.

### 5-2. Natural Language Query to Database
- Androutsopoulos, I., G.D. Ritchie, and P. Thanisch. “Natural Language Interfaces to Databases – an Introduction.” Natural Language Engineering 1, no. 1 (1995): 29–81. https://doi.org/10.1017/S135132490000005X.
- Woods, William A. The Lunar Sciences Natural Language Information System: Final Report. Cambridge, Mass. :Bolt, Beranek and Newman, inc., 1972.
- Lei, Fangyu, Jixuan Chen, Yuxiao Ye, Ruisheng Cao, Dongchan Shin, Hongjin Su, Zhaoqing Suo, et al. “Spider 2.0: Evaluating Language Models on Real-World Enterprise Text-To-SQL Workflows.” arXiv.org, 2024. https://arxiv.org/abs/2411.07763.