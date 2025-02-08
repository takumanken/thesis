# Democratizing Urban Data: A Natural Language Interface for Exploring NYC Open Data

## 1. Abstract
This work explores a novel user experience that enables natural language interactions with public datasets. To demonstrate this concept, we focus on developing an interface tailored specifically for a subset of datasets from [NYC Open Data](https://opendata.cityofnewyork.us/), a comprehensive repository of New York City public data.

The first goal of this project is to lower the technical barrier associated with data aggregation and visualization. By allowing users to simply ask questions—such as "show crime trends in Brooklyn since 2020" or "how many rats have been spotted in each borough"—the interface dynamically generates customized visualizations that capture user intent and perform accurate data processing.

The second goal is to build a system finely tuned to the unique aspects of NYC Open Data. This includes handling local synonyms and slang (e.g., interpreting "The Village" as Greenwich Village or "uppertown" as the area around 59th Street extending northward) and integrating geospatial data (using shape files for borough boundaries, zip codes, etc.) to provide contextually relevant maps.

To guide development, this research synthesizes insights from both historical and cutting-edge work in natural language processing, data aggregation, and chart selection techniques, balancing traditional principles with modern AI technologies.

## 2. Introduction

### 2-1. Current Challenges of Open Data
Traditionally, open data providers like NYC Open Data offer access to information through several methods:

- **File Downloads**: e.g., CSV, TSV, Excel files.
- **APIs**
- **Exploratory Interfaces**: Visualization platforms.

While these methods serve certain user groups well, they inherently require a specialized skill set:

- **Data Transformation**: The ability to implement custom data transformation and aggregation logic using software or programming languages.
- **Data Visualization**: Knowledge of visualization best practices and the use of visualization tools or programming languages.

Since open data is intended for a broad audience, these technical requirements can pose significant barriers to widespread adoption and effective use. This project, therefore, explores innovative solutions to overcome these challenges.

### 2-2. Project Scope
This project aims to develop an interface that enables the following user experiences:

#### 2-2-1. Querying Data and Building Visualizations Through Natural Language
To address the limitations of traditional interfaces, this application will provide the following capabilities:
- **Natural Querying:** Users can obtain the data they need by simply describing their requirements in everyday language.
- **Instant Visualization**: A single, dynamically generated visualization is created in response to the user's query without requiring data visualization expertise.
These features are designed to make NYC Open Data accessible to a broader range of users, including those without technical backgrounds.

#### 2-2-2. Tailoring exploratory to NYC Open Data
To further customize the experience for NYC Open Data users, the following enhancements will be incorporated:
- **Local Terminology Handling:** Recognizing and correctly interpreting NYC-specific terms (e.g., "The Village" for Greenwich Village).
- **Geospatial Integration:** Utilizing off-the-shelf shape data (e.g., zip code boundaries) to create contextually relevant map visualizations.
These features will provide capabilities that one-size-fits-all services, such as conventional business intelligence tools, cannot offer.

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
