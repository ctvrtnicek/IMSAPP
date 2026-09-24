<!-- Reference only: test cases from SPECS (process_guide.md describes the current system). -->

# Phase 3E -- Additional Test Scenarios

## TC-3E-005a: Document Processing -- Regex Provider
**Prerequisites:** AI_DOCUMENT_PROCESSOR_ENABLED = true. DOCUMENT_PROCESSOR_PROVIDER = "regex". PO exists with 1 line.
**Steps:**
1. Log in as supplier or admin.
2. Open PO -> Import Serials -> Import from Document.
3. Upload a CSV file containing:
   ```
   Serial,Product
   A400M-5001,V400M
   A400M-5002,V400M
   A400M-5003,V400M
   ```
4. Review extraction results.
5. Enter Shipment Reference.
6. Confirm.
**Expected:** Regex parser extracts 3 serials. Confirmation page shows editable table. On confirm, 3 serials created in EXPECTING state.

## TC-3E-005b: Document Processing -- Switch to Claude API
**Prerequisites:** Admin role. ANTHROPIC_API_KEY configured with valid key.
**Steps:**
1. Log in as Admin.
2. Go to Admin -> System Config.
3. Change DOCUMENT_PROCESSOR_PROVIDER from "regex" to "claude_api".
4. Save.
**Expected:** Config updated. Provider now set to "claude_api".

## TC-3E-005c: Document Processing -- Claude API Provider
**Prerequisites:** DOCUMENT_PROCESSOR_PROVIDER = "claude_api". ANTHROPIC_API_KEY valid. PO exists.
**Steps:**
1. Log in as supplier or admin.
2. Open PO -> Import Serials -> Import from Document.
3. Upload a PDF or image of a packing list with serial numbers in free-form layout.
4. Review extraction results.
5. Edit any incorrect extractions.
6. Enter Shipment Reference.
7. Confirm.
**Expected:** Claude API extracts serial numbers from unstructured document. Confirmation page shows editable table with extracted data. User can correct errors. On confirm, serials created in EXPECTING state. Provider shown as "claude_api" in results.

## TC-3E-005d: Document Processing -- Disabled
**Prerequisites:** AI_DOCUMENT_PROCESSOR_ENABLED = false.
**Steps:**
1. Attempt to upload a document for extraction.
**Expected:** Error message: "Document processor is disabled. Enable in Admin -> System Config."
