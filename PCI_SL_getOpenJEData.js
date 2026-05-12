/**
 * @NScriptType Suitelet
 * @NApiVersion 2.1
 */

const main = (query) => {


  const removeFullyPaidInvoices = (finalData) => {
  for (const entityData of Object.values(finalData)) {
    for (const [invoiceId, invoiceData] of Object.entries(entityData.invoices)) {
      if (parseFloat(invoiceData.remaining_amount) === 0) {
        delete entityData.invoices[invoiceId];
      }
    }
  }
  return finalData;
};

  const getOpenJEData = (journalsOfCustomers, invoicesOfCustomers) => {
    const finalData = {};

    for (const [entityId, journalsOfEntity] of Object.entries(
      journalsOfCustomers,
    )) {
      const invoicesOfEntity = invoicesOfCustomers[entityId];

      if (invoicesOfEntity) {
        const allRelatedJournalIds = Object.values(invoicesOfEntity).flatMap(
          (invoiceData) =>
            invoiceData.invoice_related_journals.map((j) =>
              String(j.journal_id),
            ),
        );

        for (const [transId, linesOfTrans] of Object.entries(
          journalsOfEntity,
        )) {
          const entityName =
            Object.values(linesOfTrans)[0]?.journalEntityName ?? "";

          if (!allRelatedJournalIds.includes(transId)) {
            if (!finalData[entityId])
              finalData[entityId] = {
                entityName,
                missingJournals: {},
                invoices: {},
              };

            finalData[entityId].missingJournals[transId] = linesOfTrans;

            finalData[entityId].invoices = invoicesOfEntity;
          }
        }
      }
    }

    return removeFullyPaidInvoices(finalData);
  };

  const prepareJournalOfCustomerResults = (data) => {
    const finalData = {};
    data.forEach((row) => {
      const {
        trans_entity_id,
        trans_id,
        trans_tranid,
        line_id,
        account_full_name,
        trans_amount,
        trans_entity,
        trans_date,
        trans_status,
        trans_project,
      } = row;

      if (!finalData[trans_entity_id]) finalData[trans_entity_id] = {};

      if (!finalData[trans_entity_id][trans_id])
        finalData[trans_entity_id][trans_id] = {};

      if (!finalData[trans_entity_id][trans_id][line_id])
        finalData[trans_entity_id][trans_id][line_id] = {
          journalTranID: "",
          journalAccount: "",
          journalAmount: "",
          journalDate: "",
        };

      finalData[trans_entity_id][trans_id][line_id] = {
        journalEntityName: trans_entity,
        journalTranID: trans_tranid,
        journalAccount: account_full_name,
        journalAmount: trans_amount,
        journalDate: trans_date,
        journalStatus: trans_status,
        journalProject: trans_project,
      };

    });

    return finalData;
  };

  const prepareInvoiceData = (data) => {
    const finalData = {};

    data.forEach((row) => {
      const {
        invoice_entity_id,
        invoice_id,
        invoice_tranid,
        journal_id,
        journal_tranid,
      } = row;

      if (!finalData[row.invoice_entity_id])
        finalData[row.invoice_entity_id] = {};

      if (!finalData[row.invoice_entity_id][row.invoice_id])
        finalData[row.invoice_entity_id][row.invoice_id] = {
          entity_name: "",
          invoice_tranid: "",
          invoice_related_journals: [],
          total_amount: 0,
          paid_amount: 0,
          remaining_amount: 0,
        };

      finalData[row.invoice_entity_id][row.invoice_id].invoice_tranid =
        invoice_tranid;

      finalData[row.invoice_entity_id][row.invoice_id].remaining_amount =
        row.invoice_remaining_amount;
      finalData[row.invoice_entity_id][row.invoice_id].total_amount =
        row.invoice_total;
      finalData[row.invoice_entity_id][row.invoice_id].paid_amount =
        row.invoice_paid_amount;

      finalData[row.invoice_entity_id][row.invoice_id].entity_name =
        row.invoice_entity;

      finalData[row.invoice_entity_id][
        row.invoice_id
      ].invoice_related_journals.push({
        journal_id,
        journal_tranid,
      });
    });

    return finalData;
  };

  const runSQL = (sql) => {
    var pagedResults = query.runSuiteQLPaged({
      query: sql,
      pageSize: 1000,
    });

    let finalResults = [];
    pagedResults.pageRanges.forEach(function (pageRange) {
      var currentPage = pagedResults.fetch({ index: pageRange.index });
      var results = currentPage.data.asMappedResults();
      finalResults = finalResults.concat(results);
    });

    return finalResults;
  };

  const onRequest = (context) => {
    if (context.request.method != "POST")
      context.response.write({
        output: JSON.stringify({ error: "Invalid request method" }),
      });

    const JOURNAL_SQL = `
                  SELECT 
                      TL.id as line_id,
                      T.id as trans_id,
                      T.tranid as trans_tranid,
                      T.trandate as trans_date,
                      BUILTIN.DF(T.custbody1) as trans_project,
                      TL.entity as trans_entity_id,
                      BUILTIN.DF(TL.ENTITY) as trans_entity,
                      REGEXP_SUBSTR(BUILTIN.DF(T.status), '[^:]+$') as trans_status,

                      (ACC.acctnumber || ' ' ||  ACC.fullname) as account_full_name,
                      TL.creditforeignamount as trans_amount,
                      BUILTIN.DF(ACC.id) as trans_account
                  FROM TRANSACTION T
                      INNER JOIN TRANSACTIONLINE TL ON (TL.transaction = T.id)
                      INNER JOIN TRANSACTIONACCOUNTINGLINE TAL ON (TAL.transaction = TL.transaction AND TAL.transactionline = TL.id)
                      LEFT JOIN ACCOUNT ACC ON (ACC.id = TAL.account)
                      LEFT JOIN ENTITY E
                      ON (E.id = TL.entity)
                  WHERE T.type = 'Journal' AND TL.creditforeignamount IS NOT NULL AND ACC.parent = '3051' AND 
                      BUILTIN.DF(T.status) <> 'Journal : Rejected' AND TL.entity IS NOT NULL
                      ORDER BY T.tranid`;

    const CUSTOMERS_INVOICE_SQL = `
                  SELECT
                        DISTINCT  
                        T.id as invoice_id,
                        T.tranid as invoice_tranid,
                        T.entity as invoice_entity_id,
                        BUILTIN.DF(T.entity) as invoice_entity,
                        T.foreigntotal as invoice_total,
                        T.foreignamountpaid as invoice_paid_amount,
                        T.foreignamountunpaid as invoice_remaining_amount,
                        RT.id as journal_id,
                        RT.tranid as journal_tranid
                  FROM TRANSACTION T
                        LEFT JOIN NEXTTRANSACTIONLINELINK NTLL
                        ON ( NTLL.previousdoc = T.id)
                        LEFT JOIN TRANSACTION RT 
                        ON ( RT.type = 'Journal' 
                        AND  RT.id = NTLL.nextdoc)
                  WHERE T.type = 'CustInvc' 
                        ORDER BY T.tranid`;

    const customerInvoiceResults = runSQL(CUSTOMERS_INVOICE_SQL);

    const journalCustomerResults = runSQL(JOURNAL_SQL);

    const preparedJournalOfCustomerResults = prepareJournalOfCustomerResults(
      journalCustomerResults,
    );

    const preparedInvoiceDataResult = prepareInvoiceData(
      customerInvoiceResults,
    );

    const finalData = getOpenJEData(
      preparedJournalOfCustomerResults,
      preparedInvoiceDataResult,
    );

    context.response.write({
      output: JSON.stringify(finalData),
    });
  };

  return {
    onRequest,
  };
};

define(["N/query"], main);
