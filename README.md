# A Natural Language Interface for exploring NYC Open Data: Making Open Data More Accessible

## 1. Abstract
This thesis addresses a challenge in open data usage: the limited accessibility of open data portals resulting from the technical skills they often require. To overcome this barrier, this project introduces a natural language interface powered by advanced AI technologies, simplifying how users explore and visualize open data. As a proof of concept, we focus on a subset of [NYC Open Data](https://opendata.cityofnewyork.us/), a vast repository of New York City’s public datasets.

By allowing users to ask everyday questions about NYC-such as "show crime trends in Brooklyn since 2020" or "how many rats have been spotted in each borough"-the system dynamically generates relevant visualizations and handles data processing automatically. This approach could lower technical barriers and empowers individuals to gain insights without specialized skills in coding or data transformation. In addition, the interface is sensitive to local nuances: it recognizes colloquialisms ("The Village" for Greenwich Village, "Uppertown" for the area north of 59th Street) and leverages geospatial data (e.g., shapefiles for borough boundaries) to ensure accurate, contextual results.

In developing this solution, this project integrates established data aggregation and data visualization practices with emerging AI techniques, demonstrating how natural language systems can expand public engagement with open data.

## 2. Introduction

### 2.1. Current Open Data Challenges
Open data portals have played an important role in research, civic engagement, business, and decision-making across many sectors. However, many of these portals are potentially at risk of limited accessibility due to the technical skills often required for effective use. NYC Open Data, one of the largest open data portals in the world, appears to face a similar challenge. In fact, [the usability research for NYC Open Data in 2017](https://opendata.cityofnewyork.us/wp-content/uploads/2017/07/Understanding-the-Users-of-Open-Data_Reboot.pdf) stated, "The Open Data Portal is still perceived as a tool for—and predominantly used by—a niche community of civic hackers and tech journalists."

Where does this technical barrier originate? Two potential challenges include:
1. **Data Aggregation:** Users are often expected to accurately convert raw data sets into aggregated formats and clean them for analysis-tasks that typically require programming skills or specialized software.
2. **Data Visualization:** Even after acquiring the right data, creating meaningful charts or maps requires expertise in both visualization techniques (such as data visualization tools or programming languages) and best practices for selecting appropriate chart types.

These barriers can alienate a broad audience, limiting the reach and utility of open data.

### 2.2. Approach of this Project

To address these barriers, this work proposes a natural language interface that streamlines data exploration and visualization. As a proof of concept, we focus on selected datasets from NYC Open Data to demonstrate the viability of the system in a real-world context.

Firstly, by applying advanced natural language processing and automation techniques, this project builds an interface where users can type or speak queries in everyday language. The system interprets users’ requests, retrieves and processes the relevant data, and generates visualizations without requiring manual data manipulation or coding.

For a better user experience, the interface supports local terminology and slang—for example, interpreting “The Village” as Greenwich Village or “uppertown” as areas north of 59th Street. In addition, geospatial data (such as borough boundaries and ZIP code polygons) is integrated to provide context-rich maps and enable spatial analysis.

Lastly, by developing the interface for NYC Open Data, we assess how this approach can be applied to large and diverse open data portals. The system’s performance and user feedback offer valuable insights into how effectively the natural language interface scales across multiple datasets and varying usage scenarios. Looking ahead, this proof of concept could be adapted for other municipal or organizational data platforms, serving as a model for making open data more accessible and user-friendly.

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
