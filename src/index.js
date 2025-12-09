/*! *****************************************************************************
Licensed under the GPL, Version 3.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at https://www.gnu.org/licenses/gpl-3.0.en.html

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

***************************************************************************** */
import { createQRBill } from "./createqrbill";

window.frappe.ui.form.on("Sales Invoice", {
  on_submit: (frm) => {

    if(frm.doc.docstatus == 1) {
      return;
    }

    createQRBill(frm);
  },

  before_submit: (frm) => {

    if(frm.doc.docstatus == 1) {
      return;
    }
    // Copy reference_number_full to esr_reference_code for bank reconciliation
    if (frm.doc.reference_number_full) {
      frm.doc.esr_reference_code = frm.doc.reference_number_full;
    }
  },
  refresh: (frm) => {
    frm.add_custom_button("Create QR Bill", function () {
      createQRBill(frm);
    });
  },
});