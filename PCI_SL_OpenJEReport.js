/**
 * @NScriptType Suitelet
 * @NApiVersion 2.1
 */

const main = (ui, query) => {
  const onRequest = (context) => {
    if (context.request.method === "GET") {
      const form = ui.createForm({ title: "Open JE's Report" });

      const htmlField = form.addField({
        id: "custpage_open_je_report_html",
        type: ui.FieldType.INLINEHTML,
        label: "Open JE Report",
        container: "custpage_filters_group",
      });

      form.addButton({
        id: "custpage_export_to_excel",
        label: "Export to Excel",
        functionName: "exportToExcel",
      });

      form.clientScriptModulePath = "./PCI_CS_renderOpenJEDataReport.js";

      context.response.writePage(form);
    }
  };

  return { onRequest };
};

define(["N/ui/serverWidget", "N/query"], main);
