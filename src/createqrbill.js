/*! *****************************************************************************
Licensed under the GPL, Version 3.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at https://www.gnu.org/licenses/gpl-3.0.en.html

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

***************************************************************************** */
import { generateQRPDF } from "./generateqrpdf";
import { generateQRConfig } from "./qrconfig";
import {
  getCurrency,
  getDocument,
  getLanguageCode,
  getReferenceCode,
  showError,
  showProgress,
} from "./utils";

/**
 * Checks if the IBAN is a QR-IBAN (IID between 30000-31999)
 * QR-IBAN requires QRR reference (27 digits)
 * Regular IBAN accepts SCOR (RF...) or NON (empty) reference
 * @param {String} iban IBAN to check
 * @returns {Boolean} True if QR-IBAN
 */
const isQRIBAN = (iban) => {
  const cleanIban = iban.replace(/\s/g, "");
  const iid = parseInt(cleanIban.substring(4, 9), 10);
  return iid >= 30000 && iid <= 31999;
};

export const createQRBill = async (frm) => {
  showProgress(10, "getting data...");
  var customer = ""

  // If customer name exists separately
  if (!frm.doc.customer_name) {
    customer = frm.doc.customer
  } else {
    customer = frm.doc.customer_name
  }

  const amount = frm.doc.outstanding_amount;
  const company = frm.doc.company;
  const language = getLanguageCode(frm.doc.language);
  const bank = await getDocument("Swiss QR Bill Settings", company);
  const bankAccount = bank.bank_account;
  const currency = getCurrency(frm.doc.currency);
  if (!currency) return;

  const companyAddress = await getDocument("Address", frm.doc.company_address);
  const customerAddress = await getDocument(
    "Address",
    frm.doc.customer_address
  );
  const { iban } = await getDocument("Bank Account", bankAccount);

  // Determine reference based on IBAN type
  // QR-IBAN (IID 30000-31999) requires QRR reference (27 digits)
  // Regular IBAN accepts SCOR (RF...) or NON (empty) reference
  let reference = "";
  const userReference = frm.doc.reference_number_full || "";
  const cleanUserRef = userReference.replace(/\s/g, "");

  if (isQRIBAN(iban)) {
    // QR-IBAN: Must use QRR reference (27 digits)
    // If user provided a 27-digit reference, use it; otherwise generate one
    if (/^\d{27}$/.test(cleanUserRef)) {
      reference = cleanUserRef;
    } else {
      // Auto-generate QRR reference from document name
      reference = getReferenceCode(frm.docname);
      console.log(`QR-IBAN detected: Auto-generated QRR reference ${reference}`);
    }
  } else {
    // Regular IBAN: Use SCOR (RF...) reference or NON (empty)
    if (cleanUserRef !== "") {
      const isSCORReference = /^RF\d{2}[A-Z0-9]{1,21}$/i.test(cleanUserRef);
      if (!isSCORReference) {
        showError(`Invalid SCOR reference format: "${userReference}". For regular IBAN, reference must be empty or start with RF (e.g., RF18...).`);
        return;
      }
      reference = cleanUserRef;
    }
    // If empty, NON reference type is used (no reference)
  }

  showProgress(40, "generating pdf...");

  const companyCountry = await getDocument("Country", companyAddress.country);
  const customerCountry = await getDocument("Country", customerAddress.country);

  const companyAddressCode = companyCountry.code.toUpperCase();
  const customerAddressCode = customerCountry.code.toUpperCase();

  const config = generateQRConfig(
    currency,
    amount,
    company,
    companyAddress,
    companyAddressCode,
    iban,
    customer,
    customerAddress,
    customerAddressCode,
    reference
  );

  // frm.docname is correct
  generateQRPDF(config, frm.docname, frm, language);

};
