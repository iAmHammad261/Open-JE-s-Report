# Open JE's Report

## Description

This report identifies journal entries that have been created against a customer but have **not** been applied to offset the customer's liability. As a result, these journals do not appear in the customer's related records, making it difficult to reconcile outstanding balances.

---

## Tools & Architecture

The solution is built using three scripts that work together:

### 1. Suitelet — UI Builder
Acts as the frontend creator. It generates an HTML field that serves as the container for the report data rendered by the Client Script.

### 2. Client Script — Grid & Functionality
Attached to the first Suitelet, this script is responsible for:
- Loading **AG Grid** to render the report data in an interactive table
- Providing **Excel export functionality** for the report
- Saving the rendered HTML back into the field created by the UI Builder Suitelet

### 3. Suitelet — Data Provider
Handles all backend data operations, including:
- Fetching relevant **journal entries** from the system
- Retrieving associated **customer data**
- Structuring and returning the data required to populate the report

---


